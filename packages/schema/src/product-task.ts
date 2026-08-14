export * as ProductTask from "./product-task"

import { Schema } from "effect"
import { Project } from "./project"
import { ascending } from "./identifier"
import { DateTimeUtcFromMillis, NonNegativeInt, PositiveInt, optional, statics } from "./schema"
import { ProductRun } from "./product-run"

export const ID = Schema.String.check(Schema.isStartsWith("ptask_")).pipe(
  Schema.brand("ProductTask.ID"),
  statics((schema) => ({ create: () => schema.make("ptask_" + ascending()) })),
)
export type ID = typeof ID.Type

export const Status = Schema.Literals(["ready", "active", "waiting", "review", "completed", "cancelled"]).annotate({
  identifier: "ProductTask.Status",
})
export type Status = typeof Status.Type

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  projectID: Project.ID,
  title: Schema.String,
  description: Schema.String,
  status: Status,
  position: NonNegativeInt,
  version: PositiveInt,
  activeRunID: Schema.suspend(() => ProductRun.ID).pipe(optional),
  createdAt: DateTimeUtcFromMillis,
  updatedAt: DateTimeUtcFromMillis,
  completedAt: DateTimeUtcFromMillis.pipe(optional),
  cancelledAt: DateTimeUtcFromMillis.pipe(optional),
  archivedAt: DateTimeUtcFromMillis.pipe(optional),
}).annotate({ identifier: "ProductTask.Info" })
