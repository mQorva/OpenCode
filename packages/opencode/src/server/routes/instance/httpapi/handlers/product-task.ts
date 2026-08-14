import { ProductTask } from "@opencode-ai/core/product-task"
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
      .handle("listRuns", listRuns)
      .handle("getRun", getRun)
      .handle("linkSession", linkSession)
      .handle("transitionRun", transitionRun)
      .handle("accept", accept)
      .handle("reopen", reopen)
  }),
)
