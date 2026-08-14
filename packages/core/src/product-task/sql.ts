import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core"
import { ProductRun } from "@opencode-ai/schema/product-run"
import { ProductTask } from "@opencode-ai/schema/product-task"
import { ProjectV2 } from "../project"
import { ProjectTable } from "../project/sql"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"

export const ProductTaskTable = sqliteTable(
  "product_task",
  {
    id: text().$type<ProductTask.ID>().primaryKey(),
    project_id: text()
      .$type<ProjectV2.ID>()
      .notNull()
      .references(() => ProjectTable.id),
    title: text().notNull(),
    description: text().notNull(),
    status: text().$type<ProductTask.Status>().notNull(),
    position: integer().notNull(),
    version: integer().notNull(),
    active_run_id: text()
      .$type<ProductRun.ID>()
      // The product service must keep active_run_id aligned with the task's non-terminal run.
      .references((): AnySQLiteColumn => ProductRunTable.id),
    time_created: integer().notNull(),
    time_updated: integer().notNull(),
    time_completed: integer(),
    time_cancelled: integer(),
    time_archived: integer(),
  },
  (table) => [
    index("product_task_project_status_position_idx").on(table.project_id, table.status, table.position),
    index("product_task_project_idx").on(table.project_id),
    index("product_task_status_idx").on(table.status),
  ],
)

export const ProductRunTable = sqliteTable(
  "product_run",
  {
    id: text().$type<ProductRun.ID>().primaryKey(),
    task_id: text()
      .$type<ProductTask.ID>()
      .notNull()
      .references(() => ProductTaskTable.id),
    sequence: integer().notNull(),
    session_id: text()
      .$type<SessionSchema.ID>()
      .references(() => SessionTable.id),
    status: text().$type<ProductRun.Status>().notNull(),
    trigger: text().$type<ProductRun.Trigger>().notNull(),
    time_started: integer(),
    time_finished: integer(),
    failure_code: text(),
    failure_message: text(),
    completion_summary: text({ mode: "json" }).$type<ProductRun.CompletionSummary>(),
  },
  (table) => [
    uniqueIndex("product_run_task_sequence_idx").on(table.task_id, table.sequence),
    uniqueIndex("product_run_session_idx").on(table.session_id),
    index("product_run_task_status_idx").on(table.task_id, table.status),
  ],
)
