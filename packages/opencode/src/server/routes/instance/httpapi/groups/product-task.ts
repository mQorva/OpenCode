import { ProductRun } from "@opencode-ai/schema/product-run"
import { ProductTask } from "@opencode-ai/schema/product-task"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { PromptInput } from "@opencode-ai/schema/prompt-input"
import { Session } from "@/session/session"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { ApiNotFoundError, ConflictError, InvalidRequestError, UnknownError } from "../errors"
import { Authorization } from "../middleware/authorization"
import { described } from "./metadata"
import { QueryBoolean } from "./query"

const root = "/product"

const ExpectedVersionPayload = Schema.Struct({
  expectedVersion: ProductTask.Info.fields.version,
})

export const CreateTaskPayload = Schema.Struct({
  title: ProductTask.Info.fields.title,
  description: Schema.optional(ProductTask.Info.fields.description),
  position: Schema.optional(ProductTask.Info.fields.position),
})

export const UpdateTaskPayload = Schema.Struct({
  ...ExpectedVersionPayload.fields,
  title: Schema.optional(ProductTask.Info.fields.title),
  description: Schema.optional(ProductTask.Info.fields.description),
  position: Schema.optional(ProductTask.Info.fields.position),
})

export const BeginRunPayload = Schema.Struct({
  ...ExpectedVersionPayload.fields,
  trigger: ProductRun.Info.fields.trigger,
})

export const LinkSessionPayload = Schema.Struct({
  sessionID: ProductRun.CompletionSummary.fields.rootSessionID,
})

export const StartRunPayload = Schema.Struct({
  ...ExpectedVersionPayload.fields,
  trigger: ProductRun.Info.fields.trigger,
  sessionID: ProductRun.CompletionSummary.fields.rootSessionID,
  messageID: SessionMessage.ID,
  directory: Schema.String,
  agent: Schema.String,
  model: Schema.Struct({
    providerID: Schema.String,
    modelID: Schema.String,
    variant: Schema.optional(Schema.String),
  }),
  prompt: PromptInput.Prompt,
})

export const StartRunResult = Schema.Struct({
  task: ProductTask.Info,
  run: ProductRun.Info,
  session: Session.Info,
})

export const TransitionRunPayload = Schema.Struct({
  target: ProductRun.Info.fields.status,
  failureCode: Schema.optional(ProductRun.Info.fields.failureCode),
  failureMessage: Schema.optional(ProductRun.Info.fields.failureMessage),
  completionSummary: Schema.optional(ProductRun.Info.fields.completionSummary),
})

const ProductTaskErrors = [InvalidRequestError, ApiNotFoundError, ConflictError, UnknownError]

export const ProductTaskPaths = {
  list: `${root}/project/:projectID/task`,
  create: `${root}/project/:projectID/task`,
  get: `${root}/task/:taskID`,
  update: `${root}/task/:taskID`,
  archive: `${root}/task/:taskID/archive`,
  restore: `${root}/task/:taskID/restore`,
  beginRun: `${root}/task/:taskID/run`,
  startRun: `${root}/task/:taskID/run/session`,
  listRuns: `${root}/task/:taskID/run`,
  accept: `${root}/task/:taskID/accept`,
  reopen: `${root}/task/:taskID/reopen`,
  getRun: `${root}/run/:runID`,
  linkSession: `${root}/run/:runID/session`,
  transitionRun: `${root}/run/:runID/transition`,
} as const

export const ProductTaskApi = HttpApi.make("product-task").add(
  HttpApiGroup.make("product-task")
    .add(
      HttpApiEndpoint.get("list", ProductTaskPaths.list, {
        params: { projectID: ProductTask.Info.fields.projectID },
        query: { includeArchived: Schema.optional(QueryBoolean) },
        success: described(Schema.Array(ProductTask.Info), "List of product tasks"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("create", ProductTaskPaths.create, {
        params: { projectID: ProductTask.Info.fields.projectID },
        payload: CreateTaskPayload,
        success: described(ProductTask.Info, "Created product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.get("get", ProductTaskPaths.get, {
        params: { taskID: ProductTask.Info.fields.id },
        success: described(ProductTask.Info, "Product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.patch("update", ProductTaskPaths.update, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: UpdateTaskPayload,
        success: described(ProductTask.Info, "Updated product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("archive", ProductTaskPaths.archive, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: ExpectedVersionPayload,
        success: described(ProductTask.Info, "Archived product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("restore", ProductTaskPaths.restore, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: ExpectedVersionPayload,
        success: described(ProductTask.Info, "Restored product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("beginRun", ProductTaskPaths.beginRun, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: BeginRunPayload,
        success: described(ProductRun.Info, "Queued product run"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("startRun", ProductTaskPaths.startRun, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: StartRunPayload,
        success: described(StartRunResult, "Started product run linked to a root session"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.get("listRuns", ProductTaskPaths.listRuns, {
        params: { taskID: ProductTask.Info.fields.id },
        success: described(Schema.Array(ProductRun.Info), "List of product runs"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.get("getRun", ProductTaskPaths.getRun, {
        params: { runID: ProductRun.Info.fields.id },
        success: described(ProductRun.Info, "Product run"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("linkSession", ProductTaskPaths.linkSession, {
        params: { runID: ProductRun.Info.fields.id },
        payload: LinkSessionPayload,
        success: described(ProductRun.Info, "Product run linked to session"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("transitionRun", ProductTaskPaths.transitionRun, {
        params: { runID: ProductRun.Info.fields.id },
        payload: TransitionRunPayload,
        success: described(ProductRun.Info, "Updated product run"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("accept", ProductTaskPaths.accept, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: ExpectedVersionPayload,
        success: described(ProductTask.Info, "Accepted product task"),
        error: ProductTaskErrors,
      }),
      HttpApiEndpoint.post("reopen", ProductTaskPaths.reopen, {
        params: { taskID: ProductTask.Info.fields.id },
        payload: ExpectedVersionPayload,
        success: described(ProductTask.Info, "Reopened product task"),
        error: ProductTaskErrors,
      }),
    )
    .annotateMerge(
      OpenApi.annotations({
        title: "product-task",
        description: "Product task and run adapter routes.",
      }),
    )
    .middleware(Authorization),
)
