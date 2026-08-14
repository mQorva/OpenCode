export * as ProductRun from "./product-run"

import { Schema } from "effect"
import { FileDiff } from "./file-diff"
import { ascending } from "./identifier"
import { Permission } from "./permission"
import { ProductTask } from "./product-task"
import { Question } from "./question"
import { Session } from "./session"
import { DateTimeUtcFromMillis, NonNegativeInt, PositiveInt, optional, statics } from "./schema"

const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

export const ID = Schema.String.check(Schema.isStartsWith("prun_")).pipe(
  Schema.brand("ProductRun.ID"),
  statics((schema) => ({ create: () => schema.make("prun_" + ascending()) })),
)
export type ID = typeof ID.Type

export const Status = Schema.Literals([
  "queued",
  "running",
  "waiting_permission",
  "waiting_input",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]).annotate({ identifier: "ProductRun.Status" })
export type Status = typeof Status.Type

export const Trigger = Schema.Literals(["new", "continue", "retry", "reopen"]).annotate({
  identifier: "ProductRun.Trigger",
})
export type Trigger = typeof Trigger.Type

export const Check = Schema.Struct({
  name: Schema.String,
  status: Schema.Literals(["passed", "failed", "skipped", "unknown"]),
  source: Schema.Literals(["reported", "suggested"]),
  message: Schema.String.pipe(optional),
}).annotate({ identifier: "ProductRun.CompletionSummary.Check" })
export interface Check extends Schema.Schema.Type<typeof Check> {}

export const CompletionSummary = Schema.Struct({
  rootSessionID: Session.ID,
  childSessionIDs: Schema.Array(Session.ID),
  finalAssistantSummary: Schema.String,
  changedFiles: Schema.Array(FileDiff.Info),
  diff: Schema.Struct({
    additions: NonNegativeInt,
    deletions: NonNegativeInt,
    files: NonNegativeInt,
  }),
  outstandingPermissionIDs: Schema.Array(Permission.ID),
  outstandingQuestionIDs: Schema.Array(Question.ID),
  checks: Schema.Array(Check),
  usage: Schema.Struct({
    input: NonNegativeInt,
    output: NonNegativeInt,
    reasoning: NonNegativeInt,
    cache: Schema.Struct({ read: NonNegativeInt, write: NonNegativeInt }),
    cost: NonNegativeFinite,
  }),
}).annotate({ identifier: "ProductRun.CompletionSummary" })
export interface CompletionSummary extends Schema.Schema.Type<typeof CompletionSummary> {}

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  taskID: Schema.suspend(() => ProductTask.ID),
  sequence: PositiveInt,
  sessionID: Session.ID.pipe(optional),
  status: Status,
  trigger: Trigger,
  startedAt: DateTimeUtcFromMillis.pipe(optional),
  finishedAt: DateTimeUtcFromMillis.pipe(optional),
  failureCode: Schema.String.pipe(optional),
  failureMessage: Schema.String.pipe(optional),
  completionSummary: CompletionSummary.pipe(optional),
}).annotate({ identifier: "ProductRun.Info" })
