import { ProductTask } from "@opencode-ai/core/product-task"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { AgentV2 } from "@opencode-ai/core/agent"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { Session } from "@/session/session"
import { ProductRun } from "@opencode-ai/schema/product-run"
import { ProductTask as ProductTaskSchema } from "@opencode-ai/schema/product-task"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ApiNotFoundError, ConflictError, InvalidRequestError, UnknownError, notFound } from "../errors"
import {
  BeginRunPayload,
  CreateTaskPayload,
  LinkSessionPayload,
  StartRunPayload,
  TransitionRunPayload,
  UpdateTaskPayload,
} from "../groups/product-task"

const invalidRequest = () =>
  new InvalidRequestError({ message: "Die Aktion kann mit diesen Daten nicht ausgeführt werden." })

const conflict = () => new ConflictError({ message: "Die Aktion steht im Konflikt mit dem aktuellen Aufgabenstand." })

const unknown = () => new UnknownError({ message: "Die Produktdaten konnten nicht verarbeitet werden." })

const mapProductTaskError = <A>(effect: Effect.Effect<A, ProductTask.Error>) =>
  effect.pipe(
    Effect.catchTag("ProductTask.InvalidTransitionError", () => Effect.fail(invalidRequest())),
    Effect.catchTag("ProductTask.NotFoundError", () => Effect.fail(notFound("Die angeforderte Produktressource wurde nicht gefunden."))),
    Effect.catchTag("ProductTask.ConflictError", () => Effect.fail(conflict())),
    Effect.catchTag("ProductTask.StaleVersionError", () => Effect.fail(conflict())),
    Effect.catchTag("ProductTask.PersistenceError", () => Effect.fail(unknown())),
  )

export const productTaskHandlers = HttpApiBuilder.group(InstanceHttpApi, "product-task", (handlers) =>
  Effect.gen(function* () {
    const productTask = yield* ProductTask.Service
    const sessions = yield* SessionV2.Service
    const legacySessions = yield* Session.Service

    const list = Effect.fn("ProductTaskHttpApi.list")(
      (ctx: {
        params: { projectID: ProductTaskSchema.Info["projectID"] }
        query: { includeArchived?: boolean }
      }) => mapProductTaskError(productTask.listTasks(ctx.params.projectID, ctx.query.includeArchived)),
    )

    const create = Effect.fn("ProductTaskHttpApi.create")(function* (ctx: {
      params: { projectID: ProductTaskSchema.Info["projectID"] }
      payload: typeof CreateTaskPayload.Type
    }) {
      return yield* mapProductTaskError(productTask.createTask({ projectID: ctx.params.projectID, ...ctx.payload }))
    })

    const get = Effect.fn("ProductTaskHttpApi.get")((ctx: { params: { taskID: ProductTaskSchema.ID } }) =>
      mapProductTaskError(productTask.getTask(ctx.params.taskID)),
    )

    const update = Effect.fn("ProductTaskHttpApi.update")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: typeof UpdateTaskPayload.Type
    }) {
      return yield* mapProductTaskError(
        productTask.updateTask({
          taskID: ctx.params.taskID,
          expectedVersion: ctx.payload.expectedVersion,
          patch: {
            title: ctx.payload.title,
            description: ctx.payload.description,
            position: ctx.payload.position,
          },
        }),
      )
    })

    const archive = Effect.fn("ProductTaskHttpApi.archive")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: { expectedVersion: number }
    }) {
      return yield* mapProductTaskError(productTask.archiveTask(ctx.params.taskID, ctx.payload.expectedVersion))
    })

    const restore = Effect.fn("ProductTaskHttpApi.restore")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: { expectedVersion: number }
    }) {
      return yield* mapProductTaskError(productTask.restoreTask(ctx.params.taskID, ctx.payload.expectedVersion))
    })

    const beginRun = Effect.fn("ProductTaskHttpApi.beginRun")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: typeof BeginRunPayload.Type
    }) {
      return yield* mapProductTaskError(
        productTask.beginRun(ctx.params.taskID, ctx.payload.expectedVersion, ctx.payload.trigger),
      )
    })

    const startRun = Effect.fn("ProductTaskHttpApi.startRun")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: typeof StartRunPayload.Type
    }) {
      const task = yield* mapProductTaskError(productTask.getTask(ctx.params.taskID))
      const sessionRecorded = yield* sessions
        .get(ctx.payload.sessionID)
        .pipe(Effect.as(true), Effect.catch(() => Effect.succeed(false)))
      const session = yield* sessions.create({
        id: ctx.payload.sessionID,
        agent: AgentV2.ID.make(ctx.payload.agent),
        model: {
          id: ModelV2.ID.make(ctx.payload.model.modelID),
          providerID: ProviderV2.ID.make(ctx.payload.model.providerID),
          variant: ctx.payload.model.variant ? ModelV2.VariantID.make(ctx.payload.model.variant) : undefined,
        },
        location: { directory: AbsolutePath.make(ctx.payload.directory) },
      })
      const started = yield* mapProductTaskError(
        productTask.startRun(
          ctx.params.taskID,
          ctx.payload.expectedVersion,
          ctx.payload.trigger,
          ctx.payload.sessionID,
        ),
      ).pipe(
        Effect.catch((error) =>
          (sessionRecorded ? Effect.void : legacySessions.remove(session.id).pipe(Effect.catch(() => Effect.void))).pipe(
            Effect.andThen(Effect.fail(error)),
          ),
        ),
      )
      const run =
        started.run.status === "queued"
          ? yield* sessions
              .prompt({
                id: SessionMessage.ID.make(ctx.payload.messageID),
                sessionID: ctx.payload.sessionID,
                prompt: ctx.payload.prompt,
              })
              .pipe(
                Effect.andThen(mapProductTaskError(productTask.transitionRun(started.run.id, "running"))),
                Effect.catch(() =>
                  mapProductTaskError(productTask.transitionRun(started.run.id, "cancelled")).pipe(
                    Effect.andThen(Effect.fail(unknown())),
                  ),
                ),
              )
          : started.run
      return {
        task: yield* mapProductTaskError(productTask.getTask(task.id)),
        run,
        session: yield* legacySessions.get(session.id).pipe(Effect.orDie),
      }
    })

    const listRuns = Effect.fn("ProductTaskHttpApi.listRuns")((ctx: { params: { taskID: ProductTaskSchema.ID } }) =>
      mapProductTaskError(productTask.listRuns(ctx.params.taskID)),
    )

    const getRun = Effect.fn("ProductTaskHttpApi.getRun")((ctx: { params: { runID: ProductRun.ID } }) =>
      mapProductTaskError(productTask.getRun(ctx.params.runID)),
    )

    const linkSession = Effect.fn("ProductTaskHttpApi.linkSession")(function* (ctx: {
      params: { runID: ProductRun.ID }
      payload: typeof LinkSessionPayload.Type
    }) {
      return yield* mapProductTaskError(productTask.linkSession(ctx.params.runID, ctx.payload.sessionID))
    })

    const transitionRun = Effect.fn("ProductTaskHttpApi.transitionRun")(function* (ctx: {
      params: { runID: ProductRun.ID }
      payload: typeof TransitionRunPayload.Type
    }) {
      return yield* mapProductTaskError(productTask.transitionRun(ctx.params.runID, ctx.payload.target, ctx.payload))
    })

    const accept = Effect.fn("ProductTaskHttpApi.accept")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: { expectedVersion: number }
    }) {
      return yield* mapProductTaskError(productTask.acceptTask(ctx.params.taskID, ctx.payload.expectedVersion))
    })

    const reopen = Effect.fn("ProductTaskHttpApi.reopen")(function* (ctx: {
      params: { taskID: ProductTaskSchema.ID }
      payload: { expectedVersion: number }
    }) {
      return yield* mapProductTaskError(productTask.reopenTask(ctx.params.taskID, ctx.payload.expectedVersion))
    })

    return handlers
      .handle("list", list)
      .handle("create", create)
      .handle("get", get)
      .handle("update", update)
      .handle("archive", archive)
      .handle("restore", restore)
      .handle("beginRun", beginRun)
      .handle("startRun", startRun)
      .handle("listRuns", listRuns)
      .handle("getRun", getRun)
      .handle("linkSession", linkSession)
      .handle("transitionRun", transitionRun)
      .handle("accept", accept)
      .handle("reopen", reopen)
  }),
)
