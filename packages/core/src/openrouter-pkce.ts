import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { Context, Deferred, Duration, Effect, Layer, Schema } from "effect"
import { makeGlobalNode } from "./effect/app-node"

export const LOOPBACK_HOST = "127.0.0.1"
export const CALLBACK_PATH = "/callback"
export const AUTHORIZATION_ENDPOINT = "https://openrouter.ai/auth"
export const DEFAULT_TIMEOUT_MS = 10 * 60_000

const CALLBACK_METHOD = "GET"
const VERIFIER_BYTES = 64
const STATE_BYTES = 32

export class InvalidTimeout extends Schema.TaggedErrorClass<InvalidTimeout>()("OpenRouterPKCE.InvalidTimeout", {}) {
  override get message() {
    return "OpenRouter PKCE timeout is invalid."
  }
}

export class RandomnessError extends Schema.TaggedErrorClass<RandomnessError>()("OpenRouterPKCE.RandomnessError", {
  value: Schema.Literals(["verifier", "state"]),
}) {
  override get message() {
    return "OpenRouter PKCE randomness failed."
  }
}

export class ListenerError extends Schema.TaggedErrorClass<ListenerError>()("OpenRouterPKCE.ListenerError", {
  operation: Schema.Literals(["listen", "close"]),
}) {
  override get message() {
    return "OpenRouter PKCE callback listener failed."
  }
}

export class MissingState extends Schema.TaggedErrorClass<MissingState>()("OpenRouterPKCE.MissingState", {}) {
  override get message() {
    return "OpenRouter PKCE callback state is missing."
  }
}

export class InvalidState extends Schema.TaggedErrorClass<InvalidState>()("OpenRouterPKCE.InvalidState", {}) {
  override get message() {
    return "OpenRouter PKCE callback state is invalid."
  }
}

export class MissingCode extends Schema.TaggedErrorClass<MissingCode>()("OpenRouterPKCE.MissingCode", {}) {
  override get message() {
    return "OpenRouter PKCE authorization code is missing."
  }
}

export class ProviderDenied extends Schema.TaggedErrorClass<ProviderDenied>()("OpenRouterPKCE.ProviderDenied", {}) {
  override get message() {
    return "OpenRouter denied authorization."
  }
}

export class MalformedCallback extends Schema.TaggedErrorClass<MalformedCallback>()(
  "OpenRouterPKCE.MalformedCallback",
  {},
) {
  override get message() {
    return "OpenRouter PKCE callback is malformed."
  }
}

export class Timeout extends Schema.TaggedErrorClass<Timeout>()("OpenRouterPKCE.Timeout", {}) {
  override get message() {
    return "OpenRouter PKCE authorization timed out."
  }
}

export class Cancelled extends Schema.TaggedErrorClass<Cancelled>()("OpenRouterPKCE.Cancelled", {}) {
  override get message() {
    return "OpenRouter PKCE authorization was cancelled."
  }
}

export type Error =
  | InvalidTimeout
  | RandomnessError
  | ListenerError
  | MissingState
  | InvalidState
  | MissingCode
  | ProviderDenied
  | MalformedCallback
  | Timeout
  | Cancelled

export type Request = {
  readonly method?: string
  readonly url?: string
}

export type ResponseWriter = {
  readonly respond: (status: number) => void
}

export type RequestHandler = (request: Request, response: ResponseWriter) => void

export type Listener = {
  readonly port: number
  readonly close: () => Effect.Effect<void, ListenerError>
}

export interface ServerBoundary {
  readonly listen: (input: { readonly host: typeof LOOPBACK_HOST; readonly port: 0; readonly onRequest: RequestHandler }) => Effect.Effect<Listener, ListenerError>
}

export interface RandomBoundary {
  readonly bytes: (size: number) => Uint8Array
}

export type StartOptions = {
  readonly timeoutMs?: number
}

export type Result = {
  readonly code: string
  readonly codeVerifier: string
  readonly callbackUrl: string
}

export type Flow = {
  readonly authorizationUrl: string
  readonly callbackUrl: string
  readonly wait: Effect.Effect<Result, Exclude<Error, InvalidTimeout | RandomnessError | ListenerError>>
  readonly cancel: Effect.Effect<void, ListenerError>
}

export interface Interface {
  readonly start: (options?: StartOptions) => Effect.Effect<Flow, InvalidTimeout | RandomnessError | ListenerError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenRouterPKCE") {}

export type Dependencies = {
  readonly random?: RandomBoundary
  readonly server?: ServerBoundary
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

export function make(dependencies: Dependencies = {}): Interface {
  const random = dependencies.random ?? { bytes: (size: number) => randomBytes(size) }
  const server = dependencies.server ?? nodeServer

  return {
    start: (options = {}) =>
      Effect.gen(function* () {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return yield* new InvalidTimeout()

        const verifier = yield* randomValue(random, VERIFIER_BYTES, "verifier")
        const state = yield* randomValue(random, STATE_BYTES, "state")
        const challenge = createCodeChallenge(verifier)
        const listener = yield* Deferred.make<Result, Exclude<Error, InvalidTimeout | RandomnessError | ListenerError>>()
        let settled = false
        let closed = false
        let callbackUrl = ""

        const close = Effect.suspend(() => {
          if (closed) return Effect.void
          closed = true
          return listenerHandle.close()
        })

        const settle = (result: Result | Exclude<Error, InvalidTimeout | RandomnessError | ListenerError>) => {
          if (settled) return
          settled = true
          const completion = result instanceof Error ? Deferred.fail(listener, result) : Deferred.succeed(listener, result)
          Effect.runFork(completion.pipe(Effect.andThen(close), Effect.ignore))
        }

        const onRequest: RequestHandler = (request, response) => {
          if (settled) {
            response.respond(409)
            return
          }
          if (request.method !== CALLBACK_METHOD) {
            response.respond(405)
            return
          }

          let url: URL
          try {
            url = new URL(request.url ?? "", callbackUrl)
          } catch {
            response.respond(400)
            settle(new MalformedCallback())
            return
          }
          if (url.pathname !== CALLBACK_PATH) {
            response.respond(404)
            return
          }

          const receivedState = url.searchParams.get("state")
          if (receivedState === null) {
            response.respond(400)
            settle(new MissingState())
            return
          }
          if (receivedState !== state) {
            response.respond(400)
            settle(new InvalidState())
            return
          }

          if (url.searchParams.has("error")) {
            response.respond(400)
            settle(new ProviderDenied())
            return
          }
          const code = url.searchParams.get("code")
          if (!code) {
            response.respond(400)
            settle(new MissingCode())
            return
          }

          response.respond(200)
          settle({ code, codeVerifier: verifier, callbackUrl })
        }

        const listenerHandle = yield* server.listen({ host: LOOPBACK_HOST, port: 0, onRequest })
        const callback = new URL(`http://${LOOPBACK_HOST}:${listenerHandle.port}${CALLBACK_PATH}`)
        callback.searchParams.set("state", state)
        callbackUrl = callback.toString()
        const authorization = new URL(AUTHORIZATION_ENDPOINT)
        authorization.searchParams.set("callback_url", callbackUrl)
        authorization.searchParams.set("code_challenge", challenge)
        authorization.searchParams.set("code_challenge_method", "S256")

        const wait = Effect.timeoutOrElse(Deferred.await(listener), {
            duration: Duration.millis(timeoutMs),
            orElse: () =>
              Effect.sync(() => {
                settled = true
              }).pipe(Effect.andThen(Effect.fail(new Timeout()))),
          }).pipe(
          Effect.onInterrupt(() => Effect.sync(() => void (settled = true))),
          Effect.ensuring(close.pipe(Effect.ignore)),
        )
        const cancel = Effect.suspend(() => {
          if (settled) return close
          settled = true
          return Deferred.fail(listener, new Cancelled()).pipe(Effect.andThen(close), Effect.asVoid)
        })

        return { authorizationUrl: authorization.toString(), callbackUrl, wait, cancel }
      }),
  }
}

const nodeServer: ServerBoundary = {
  listen: (input) =>
    Effect.tryPromise({
      try: () =>
        new Promise<Listener>((resolve, reject) => {
          const httpServer = createServer((request, response) => handleRequest(input.onRequest, request, response))
          const failed = () => {
            if (httpServer.listening) httpServer.close(() => reject(new Error("listen")))
            else reject(new Error("listen"))
          }
          httpServer.once("error", failed)
          httpServer.listen({ host: input.host, port: input.port }, () => {
            httpServer.off("error", failed)
            const address = httpServer.address()
            if (!address || typeof address === "string" || address.address !== LOOPBACK_HOST || address.port <= 0) {
              failed()
              return
            }
            resolve({ port: address.port, close: () => closeNodeServer(httpServer) })
          })
        }),
      catch: () => new ListenerError({ operation: "listen" }),
    }),
}

const layer = Layer.succeed(Service, Service.of(make()))

export const node = makeGlobalNode({ service: Service, layer, deps: [] })

function randomValue(random: RandomBoundary, size: number, value: "verifier" | "state") {
  return Effect.try({
    try: () => {
      const bytes = random.bytes(size)
      if (bytes.byteLength !== size) throw new Error("randomness")
      return Buffer.from(bytes).toString("base64url")
    },
    catch: () => new RandomnessError({ value }),
  })
}

function handleRequest(handler: RequestHandler, request: IncomingMessage, response: ServerResponse) {
  handler(
    { method: request.method, url: request.url },
    {
      respond: (status) => {
        if (response.writableEnded) return
        response.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" })
        response.end(status === 200 ? "Authorization complete." : "Authorization failed.")
      },
    },
  )
}

function closeNodeServer(server: Server) {
  return Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve()
          return
        }
        server.close((error) => (error ? reject(error) : resolve()))
      }),
    catch: () => new ListenerError({ operation: "close" }),
  })
}

export * as OpenRouterPKCE from "./openrouter-pkce"
