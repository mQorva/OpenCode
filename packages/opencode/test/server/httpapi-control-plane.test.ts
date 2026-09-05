import { NodeHttpServer } from "@effect/platform-node"
import { describe, expect } from "bun:test"
import { Context, Effect, Layer, Option, Ref } from "effect"
import { HttpBody, HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { MoveSession } from "@opencode-ai/core/control-plane/move-session"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import type { SessionSchema } from "@opencode-ai/core/session/schema"
import { InstanceStore } from "../../src/project/instance-store"
import { Session } from "../../src/session/session"
import { SessionRunState } from "../../src/session/run-state"
import { Auth } from "../../src/auth"
import { Config } from "../../src/config/config"
import { Installation } from "../../src/installation"
import { ServerAuth } from "../../src/server/auth"
import { RootHttpApi } from "../../src/server/routes/instance/httpapi/api"
import { controlHandlers } from "../../src/server/routes/instance/httpapi/handlers/control"
import { controlPlaneHandlers } from "../../src/server/routes/instance/httpapi/handlers/control-plane"
import { globalHandlers } from "../../src/server/routes/instance/httpapi/handlers/global"
import { authorizationLayer } from "../../src/server/routes/instance/httpapi/middleware/authorization"
import { schemaErrorLayer } from "../../src/server/routes/instance/httpapi/middleware/schema-error"
import { testEffect } from "../lib/effect"

const input = MoveSession.Input.make({
  sessionID: SessionV2.ID.make("ses_move"),
  destination: { directory: AbsolutePath.make("/destination") },
  moveChanges: true,
})
const called = Ref.makeUnsafe<MoveSession.Input | undefined>(undefined)

const apiLayer = HttpRouter.serve(
  HttpApiBuilder.layer(RootHttpApi).pipe(
    Layer.provide([controlHandlers, controlPlaneHandlers, globalHandlers]),
    Layer.provide([authorizationLayer, schemaErrorLayer]),
    // Raw HttpApi routes expose an opaque handler context at the request boundary.
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    HttpRouter.provideRequest(Layer.succeedContext(Context.empty() as Context.Context<unknown>)),
  ),
  { disableListenLog: true, disableLogger: true },
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provide(Layer.mock(Auth.Service)({})),
  Layer.provide(Layer.mock(Config.Service)({})),
  Layer.provide(Layer.mock(Installation.Service)({})),
  Layer.provide(
    Layer.mock(MoveSession.Service)({
      moveSession: (value) => Ref.set(called, value),
    }),
  ),
  Layer.provide(instanceGuards()),
  Layer.provide(ServerAuth.Config.configLayer({ password: Option.none(), username: "opencode" })),
)
// The move route asks the session's own instance whether a turn is running, so both services have
// to answer here. `busy` decides what that instance reports back.
function instanceGuards(options: { busy?: boolean; directory?: string } = {}) {
  const directory = AbsolutePath.make(options.directory ?? "/source")
  const runState = Layer.succeed(
    SessionRunState.Service,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    {
      assertNotBusy: (sessionID: SessionV2.ID) =>
        options.busy ? Effect.fail(new Session.BusyError({ sessionID })) : Effect.void,
    } as unknown as SessionRunState.Interface,
  )
  const sessions = Layer.succeed(
    SessionV2.Service,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    {
      get: (sessionID: SessionV2.ID) => Effect.succeed({ id: sessionID, location: { directory } }),
    } as unknown as SessionV2.Interface,
  )
  const instances = Layer.succeed(
    InstanceStore.Service,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    {
      provide: (_input: unknown, effect: Effect.Effect<unknown, unknown, never>) =>
        effect.pipe(Effect.provide(runState)),
    } as unknown as InstanceStore.Interface,
  )
  return Layer.mergeAll(sessions, instances)
}

const it = testEffect(apiLayer)

const busyLayer = HttpRouter.serve(
  HttpApiBuilder.layer(RootHttpApi).pipe(
    Layer.provide([controlHandlers, controlPlaneHandlers, globalHandlers]),
    Layer.provide([authorizationLayer, schemaErrorLayer]),
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    HttpRouter.provideRequest(Layer.succeedContext(Context.empty() as Context.Context<unknown>)),
  ),
  { disableListenLog: true, disableLogger: true },
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provide(Layer.mock(Auth.Service)({})),
  Layer.provide(Layer.mock(Config.Service)({})),
  Layer.provide(Layer.mock(Installation.Service)({})),
  Layer.provide(
    Layer.mock(MoveSession.Service)({
      moveSession: (value) => Ref.set(called, value),
    }),
  ),
  Layer.provide(instanceGuards({ busy: true })),
  Layer.provide(ServerAuth.Config.configLayer({ password: Option.none(), username: "opencode" })),
)
const itBusy = testEffect(busyLayer)

describe("control-plane HttpApi", () => {
  it.live("moves a session through the root control-plane route", () =>
    Effect.gen(function* () {
      const response = yield* HttpClientRequest.post("/experimental/control-plane/move-session").pipe(
        HttpClientRequest.setBody(HttpBody.jsonUnsafe(input)),
        HttpClient.execute,
      )

      expect(response.status).toBe(204)
      expect(yield* Ref.get(called)).toEqual(input)
    }),
  )

  itBusy.live("refuses to move a session whose turn is still running", () =>
    Effect.gen(function* () {
      yield* Ref.set(called, undefined)
      const response = yield* HttpClientRequest.post("/experimental/control-plane/move-session").pipe(
        HttpClientRequest.setBody(HttpBody.jsonUnsafe(input)),
        HttpClient.execute,
      )

      expect(response.status).toBe(400)
      // The move must not reach the service at all, or the session would be relocated anyway.
      expect(yield* Ref.get(called)).toBeUndefined()
    }),
  )
})
