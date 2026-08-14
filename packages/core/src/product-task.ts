export * as ProductTask from "./product-task"

import { ProductRun } from "@opencode-ai/schema/product-run"
import { ProductTask } from "@opencode-ai/schema/product-task"
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { Database } from "./database/database"
import { makeGlobalNode } from "./effect/app-node"
import { ProjectV2 } from "./project"
import { ProjectTable } from "./project/sql"
import { SessionSchema } from "./session/schema"
import { SessionTable } from "./session/sql"
import { ProductRunTable, ProductTaskTable } from "./product-task/sql"

export const MAX_TITLE_LENGTH = 200

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("ProductTask.NotFoundError", {
  resource: Schema.Literals(["project", "task", "run", "session"]),
  message: Schema.String,
}) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()("ProductTask.ConflictError", {
  message: Schema.String,
}) {}

export class StaleVersionError extends Schema.TaggedErrorClass<StaleVersionError>()("ProductTask.StaleVersionError", {
  expectedVersion: Schema.Number,
  currentVersion: Schema.Number,
  message: Schema.String,
}) {}

export class InvalidTransitionError extends Schema.TaggedErrorClass<InvalidTransitionError>()(
  "ProductTask.InvalidTransitionError",
  { message: Schema.String },
) {}

export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()("ProductTask.PersistenceError", {
  message: Schema.String,
}) {}

export type Error = NotFoundError | ConflictError | StaleVersionError | InvalidTransitionError | PersistenceError

type TaskRow = typeof ProductTaskTable.$inferSelect
type RunRow = typeof ProductRunTable.$inferSelect

export type TaskPatch = {
  readonly title?: string
  readonly description?: string
  readonly position?: number
}

export type CreateTaskInput = {
  readonly projectID: ProjectV2.ID
  readonly title: string
  readonly description?: string
  readonly position?: number
}

export type UpdateTaskInput = {
  readonly taskID: ProductTask.ID
  readonly expectedVersion: number
  readonly patch: TaskPatch
}

export type RunTransitionData = {
  readonly failureCode?: string
  readonly failureMessage?: string
  readonly completionSummary?: ProductRun.CompletionSummary
}

export interface Interface {
  readonly listTasks: (
    projectID: ProjectV2.ID,
    includeArchived?: boolean,
  ) => Effect.Effect<ProductTask.Info[], Error>
  readonly getTask: (taskID: ProductTask.ID) => Effect.Effect<ProductTask.Info, Error>
  readonly createTask: (input: CreateTaskInput) => Effect.Effect<ProductTask.Info, Error>
  readonly updateTask: (input: UpdateTaskInput) => Effect.Effect<ProductTask.Info, Error>
  readonly archiveTask: (taskID: ProductTask.ID, expectedVersion: number) => Effect.Effect<ProductTask.Info, Error>
  readonly restoreTask: (taskID: ProductTask.ID, expectedVersion: number) => Effect.Effect<ProductTask.Info, Error>
  readonly beginRun: (
    taskID: ProductTask.ID,
    expectedVersion: number,
    trigger: ProductRun.Trigger,
  ) => Effect.Effect<ProductRun.Info, Error>
  readonly linkSession: (runID: ProductRun.ID, sessionID: SessionSchema.ID) => Effect.Effect<ProductRun.Info, Error>
  readonly listRuns: (taskID: ProductTask.ID) => Effect.Effect<ProductRun.Info[], Error>
  readonly getRun: (runID: ProductRun.ID) => Effect.Effect<ProductRun.Info, Error>
  readonly transitionRun: (
    runID: ProductRun.ID,
    target: ProductRun.Status,
    data?: RunTransitionData,
  ) => Effect.Effect<ProductRun.Info, Error>
  readonly acceptTask: (
    taskID: ProductTask.ID,
    expectedVersion: number,
  ) => Effect.Effect<ProductTask.Info, Error>
  readonly reopenTask: (
    taskID: ProductTask.ID,
    expectedVersion: number,
  ) => Effect.Effect<ProductTask.Info, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/ProductTask") {}

const activeRunStatuses: ProductRun.Status[] = ["queued", "running", "waiting_permission", "waiting_input"]
const terminalRunStatuses: ProductRun.Status[] = ["succeeded", "failed", "cancelled", "interrupted"]

const taskInfo = (row: TaskRow): ProductTask.Info =>
  ProductTask.Info.make({
    id: ProductTask.ID.make(row.id),
    projectID: ProjectV2.ID.make(row.project_id),
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    version: row.version,
    activeRunID: row.active_run_id ? ProductRun.ID.make(row.active_run_id) : undefined,
    createdAt: DateTime.makeUnsafe(row.time_created),
    updatedAt: DateTime.makeUnsafe(row.time_updated),
    completedAt: row.time_completed ? DateTime.makeUnsafe(row.time_completed) : undefined,
    cancelledAt: row.time_cancelled ? DateTime.makeUnsafe(row.time_cancelled) : undefined,
    archivedAt: row.time_archived ? DateTime.makeUnsafe(row.time_archived) : undefined,
  })

const runInfo = (row: RunRow): ProductRun.Info =>
  ProductRun.Info.make({
    id: ProductRun.ID.make(row.id),
    taskID: ProductTask.ID.make(row.task_id),
    sequence: row.sequence,
    sessionID: row.session_id ? SessionSchema.ID.make(row.session_id) : undefined,
    status: row.status,
    trigger: row.trigger,
    startedAt: row.time_started ? DateTime.makeUnsafe(row.time_started) : undefined,
    finishedAt: row.time_finished ? DateTime.makeUnsafe(row.time_finished) : undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    completionSummary: row.completion_summary ?? undefined,
  })

const invalid = (message: string) => Effect.fail(new InvalidTransitionError({ message }))

const sanitizeTitle = (title: string) => {
  const value = title.trim()
  if (!value || value.length > MAX_TITLE_LENGTH) return undefined
  return value
}

const sanitizeFailure = (value: string | undefined, fallback: string) => {
  if (value === undefined) return undefined
  const normalized = value.trim().replaceAll(/[\r\n\t]+/g, " ")
  return normalized ? normalized.slice(0, 1000) : fallback
}

const projectNotFound = () => new NotFoundError({ resource: "project", message: "Das Projekt wurde nicht gefunden." })
const taskNotFound = () => new NotFoundError({ resource: "task", message: "Die Aufgabe wurde nicht gefunden." })
const runNotFound = () => new NotFoundError({ resource: "run", message: "Der Lauf wurde nicht gefunden." })
const sessionNotFound = () => new NotFoundError({ resource: "session", message: "Die Sitzung wurde nicht gefunden." })

const transactionError = (error: unknown): Error => {
  if (
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof StaleVersionError ||
    error instanceof InvalidTransitionError ||
    error instanceof PersistenceError
  )
    return error
  return new PersistenceError({ message: "Die Produktdaten konnten nicht gespeichert werden." })
}

const staleVersion = (expectedVersion: number, currentVersion: number) =>
  new StaleVersionError({
    expectedVersion,
    currentVersion,
    message: "Die Aufgabe wurde zwischenzeitlich geändert.",
  })

const checkVersion = (row: TaskRow, expectedVersion: number) =>
  row.version === expectedVersion ? Effect.succeed(row) : Effect.fail(staleVersion(expectedVersion, row.version))

const nextPosition = (rows: ReadonlyArray<{ readonly position: number }>) =>
  rows.reduce((max, row) => Math.max(max, row.position), -1) + 1

const taskMutation = (
  row: TaskRow,
  expectedVersion: number,
  mutation: (now: number) => Partial<typeof ProductTaskTable.$inferInsert>,
) =>
  Effect.gen(function* () {
    const current = yield* checkVersion(row, expectedVersion)
    const now = Date.now()
    return {
      ...mutation(now),
      version: current.version + 1,
      time_updated: now,
    }
  })

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const getTaskRow = (taskID: ProductTask.ID) =>
      db.select().from(ProductTaskTable).where(eq(ProductTaskTable.id, taskID)).get().pipe(Effect.orDie)

    const getRunRow = (runID: ProductRun.ID) =>
      db.select().from(ProductRunTable).where(eq(ProductRunTable.id, runID)).get().pipe(Effect.orDie)

    const requireProject = (projectID: ProjectV2.ID) =>
      db.select({ id: ProjectTable.id }).from(ProjectTable).where(eq(ProjectTable.id, projectID)).get().pipe(
        Effect.orDie,
        Effect.flatMap((row) => (row ? Effect.succeed(row) : Effect.fail(projectNotFound()))),
      )

    const requireTask = (taskID: ProductTask.ID) =>
      getTaskRow(taskID).pipe(Effect.flatMap((row) => (row ? Effect.succeed(row) : Effect.fail(taskNotFound()))))

    const requireRun = (runID: ProductRun.ID) =>
      getRunRow(runID).pipe(Effect.flatMap((row) => (row ? Effect.succeed(row) : Effect.fail(runNotFound()))))

    const result = Service.of({
      listTasks: Effect.fn("ProductTask.listTasks")(function* (projectID, includeArchived = false) {
        yield* requireProject(projectID)
        const rows = yield* db
          .select()
          .from(ProductTaskTable)
          .where(
            includeArchived
              ? eq(ProductTaskTable.project_id, projectID)
              : and(eq(ProductTaskTable.project_id, projectID), isNull(ProductTaskTable.time_archived)),
          )
          .orderBy(asc(ProductTaskTable.position), asc(ProductTaskTable.time_created), asc(ProductTaskTable.id))
          .all()
          .pipe(Effect.orDie)
        return rows.map(taskInfo)
      }),

      getTask: Effect.fn("ProductTask.getTask")(function* (taskID) {
        return taskInfo(yield* requireTask(taskID))
      }),

      createTask: Effect.fn("ProductTask.createTask")(function* (input) {
        const title = sanitizeTitle(input.title)
        if (!title) return yield* invalid("Der Titel muss sichtbaren Text enthalten.")
        if (input.position !== undefined && (!Number.isInteger(input.position) || input.position < 0))
          return yield* invalid("Die Position ist ungültig.")
        yield* requireProject(input.projectID)
        const now = Date.now()
        const position =
          input.position ??
          nextPosition(
            yield* db
              .select({ position: ProductTaskTable.position })
              .from(ProductTaskTable)
              .where(eq(ProductTaskTable.project_id, input.projectID))
              .all()
              .pipe(Effect.orDie),
          )
        const row = yield* db
          .insert(ProductTaskTable)
          .values({
            id: ProductTask.ID.create(),
            project_id: input.projectID,
            title,
            description: (input.description ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n"),
            status: "ready",
            position,
            version: 1,
            time_created: now,
            time_updated: now,
          })
          .returning()
          .get()
          .pipe(Effect.orDie)
        return taskInfo(row)
      }),

      updateTask: Effect.fn("ProductTask.updateTask")(function* (input) {
        const title = input.patch.title === undefined ? undefined : sanitizeTitle(input.patch.title)
        if (input.patch.title !== undefined && !title)
          return yield* invalid("Der Titel muss sichtbaren Text enthalten.")
        if (input.patch.position !== undefined && (!Number.isInteger(input.patch.position) || input.patch.position < 0))
          return yield* invalid("Die Position ist ungültig.")
        if (input.patch.title === undefined && input.patch.description === undefined && input.patch.position === undefined)
          return yield* invalid("Es wurde keine Änderung angegeben.")
        const row = yield* requireTask(input.taskID)
        const values = yield* taskMutation(row, input.expectedVersion, (now) => ({
          ...(title === undefined ? {} : { title }),
          ...(input.patch.description === undefined
            ? {}
            : { description: input.patch.description.replaceAll("\r\n", "\n").replaceAll("\r", "\n") }),
          ...(input.patch.position === undefined ? {} : { position: input.patch.position }),
          time_updated: now,
        }))
        const updated = yield* db
          .update(ProductTaskTable)
          .set(values)
          .where(and(eq(ProductTaskTable.id, input.taskID), eq(ProductTaskTable.version, input.expectedVersion)))
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (!updated) return yield* staleVersion(input.expectedVersion, row.version)
        return taskInfo(updated)
      }),

      archiveTask: Effect.fn("ProductTask.archiveTask")(function* (taskID, expectedVersion) {
        const row = yield* requireTask(taskID)
        if (row.time_archived !== null) return yield* new ConflictError({ message: "Die Aufgabe ist bereits archiviert." })
        if (row.active_run_id !== null)
          return yield* new ConflictError({ message: "Eine Aufgabe mit aktivem Lauf kann nicht archiviert werden." })
        const values = yield* taskMutation(row, expectedVersion, (now) => ({ time_archived: now }))
        const updated = yield* db
          .update(ProductTaskTable)
          .set(values)
          .where(and(eq(ProductTaskTable.id, taskID), eq(ProductTaskTable.version, expectedVersion)))
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (!updated) return yield* staleVersion(expectedVersion, row.version)
        return taskInfo(updated)
      }),

      restoreTask: Effect.fn("ProductTask.restoreTask")(function* (taskID, expectedVersion) {
        const row = yield* requireTask(taskID)
        if (row.time_archived === null) return yield* new ConflictError({ message: "Die Aufgabe ist nicht archiviert." })
        const values = yield* taskMutation(row, expectedVersion, () => ({ time_archived: null }))
        const updated = yield* db
          .update(ProductTaskTable)
          .set(values)
          .where(and(eq(ProductTaskTable.id, taskID), eq(ProductTaskTable.version, expectedVersion)))
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (!updated) return yield* staleVersion(expectedVersion, row.version)
        return taskInfo(updated)
      }),

      beginRun: Effect.fn("ProductTask.beginRun")(function* (taskID, expectedVersion, trigger) {
        return yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const task = yield* tx.select().from(ProductTaskTable).where(eq(ProductTaskTable.id, taskID)).get()
            if (!task) return yield* taskNotFound()
            yield* checkVersion(task, expectedVersion)
            if (task.time_archived !== null) return yield* new ConflictError({ message: "Archivierte Aufgaben können nicht gestartet werden." })
            if (task.status !== "ready" && task.status !== "review")
              return yield* invalid("Der Lauf kann aus diesem Aufgabenstatus nicht gestartet werden.")
            const activeRuns = yield* tx
              .select({ id: ProductRunTable.id })
              .from(ProductRunTable)
              .where(and(eq(ProductRunTable.task_id, taskID), inArray(ProductRunTable.status, activeRunStatuses)))
              .all()
            if (task.active_run_id !== null || activeRuns.length > 0)
              return yield* new ConflictError({ message: "Für die Aufgabe läuft bereits ein Lauf." })
            const now = Date.now()
            const latest = yield* tx
              .select({ sequence: ProductRunTable.sequence })
              .from(ProductRunTable)
              .where(eq(ProductRunTable.task_id, taskID))
              .orderBy(desc(ProductRunTable.sequence))
              .limit(1)
              .get()
            const runID = ProductRun.ID.create()
            const run = yield* tx
              .insert(ProductRunTable)
              .values({
                id: runID,
                task_id: taskID,
                sequence: (latest?.sequence ?? 0) + 1,
                status: "queued",
                trigger,
              })
              .returning()
              .get()
            const updated = yield* tx
              .update(ProductTaskTable)
              .set({ status: "active", active_run_id: runID, version: task.version + 1, time_updated: now })
              .where(and(eq(ProductTaskTable.id, taskID), eq(ProductTaskTable.version, expectedVersion)))
              .returning()
              .get()
            if (!updated) return yield* staleVersion(expectedVersion, task.version)
            return runInfo(run)
          }),
        ).pipe(Effect.mapError(transactionError))
      }),

      linkSession: Effect.fn("ProductTask.linkSession")(function* (runID, sessionID) {
        return yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const run = yield* tx.select().from(ProductRunTable).where(eq(ProductRunTable.id, runID)).get()
            if (!run) return yield* runNotFound()
            if (run.status !== "queued") return yield* new ConflictError({ message: "Der Lauf kann nicht mehr verknüpft werden." })
            if (run.session_id !== null && run.session_id !== sessionID)
              return yield* new ConflictError({ message: "Der Lauf ist bereits mit einer anderen Sitzung verknüpft." })
            if (run.session_id === sessionID) return runInfo(run)
            const task = yield* tx.select().from(ProductTaskTable).where(eq(ProductTaskTable.id, run.task_id)).get()
            if (!task) return yield* taskNotFound()
            const session = yield* tx.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
            if (!session) return yield* sessionNotFound()
            if (session.project_id !== task.project_id || session.parent_id !== null)
              return yield* new ConflictError({ message: "Die Sitzung gehört nicht zur Aufgabenhierarchie." })
            const linked = yield* tx
              .select({ id: ProductRunTable.id })
              .from(ProductRunTable)
              .where(and(eq(ProductRunTable.session_id, sessionID), ne(ProductRunTable.id, runID)))
              .get()
            if (linked) return yield* new ConflictError({ message: "Die Sitzung ist bereits verknüpft." })
            const updated = yield* tx
              .update(ProductRunTable)
              .set({ session_id: sessionID })
              .where(and(eq(ProductRunTable.id, runID), isNull(ProductRunTable.session_id)))
              .returning()
              .get()
            return updated ? runInfo(updated) : yield* new ConflictError({ message: "Der Lauf wurde bereits verknüpft." })
          }),
        ).pipe(Effect.mapError(transactionError))
      }),

      listRuns: Effect.fn("ProductTask.listRuns")(function* (taskID) {
        yield* requireTask(taskID)
        const rows = yield* db
          .select()
          .from(ProductRunTable)
          .where(eq(ProductRunTable.task_id, taskID))
          .orderBy(asc(ProductRunTable.sequence))
          .all()
          .pipe(Effect.orDie)
        return rows.map(runInfo)
      }),

      getRun: Effect.fn("ProductTask.getRun")(function* (runID) {
        return runInfo(yield* requireRun(runID))
      }),

      transitionRun: Effect.fn("ProductTask.transitionRun")(function* (runID, target, data) {
        return yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const run = yield* tx.select().from(ProductRunTable).where(eq(ProductRunTable.id, runID)).get()
            if (!run) return yield* runNotFound()
            if (terminalRunStatuses.includes(run.status))
              return yield* new ConflictError({ message: "Ein abgeschlossener Lauf kann nicht geändert werden." })
            if (!canTransition(run.status, target))
              return yield* invalid("Der Laufstatus darf nicht in den Zielstatus wechseln.")
            if (target === "running" && run.session_id === null)
              return yield* invalid("Vor dem Start muss der Lauf mit einer Sitzung verknüpft sein.")
            if (target === "succeeded" && data?.failureCode !== undefined)
              return yield* invalid("Ein erfolgreicher Lauf darf keine Fehlerinformation enthalten.")
            if (target === "succeeded" && !data?.completionSummary)
              return yield* invalid("Ein erfolgreicher Lauf benötigt einen Abschlussnachweis.")
            if (
              target === "succeeded" &&
              (run.session_id === null || data?.completionSummary?.rootSessionID !== run.session_id)
            )
              return yield* invalid("Der Abschlussnachweis gehört nicht zur verknüpften Sitzung.")
            const now = Date.now()
            const terminal = terminalRunStatuses.includes(target)
            const updatedRun = yield* tx
              .update(ProductRunTable)
              .set({
                status: target,
                time_started: run.time_started ?? (target === "running" ? now : null),
                time_finished: terminal ? now : null,
                failure_code: target === "failed" || target === "interrupted" ? sanitizeFailure(data?.failureCode, "execution_failed") : null,
                failure_message:
                  target === "failed" || target === "interrupted"
                    ? sanitizeFailure(data?.failureMessage, "Der Lauf konnte nicht erfolgreich abgeschlossen werden.")
                    : null,
                completion_summary: target === "succeeded" ? data?.completionSummary ?? null : null,
              })
              .where(and(eq(ProductRunTable.id, runID), eq(ProductRunTable.status, run.status)))
              .returning()
              .get()
            if (!updatedRun) return yield* new ConflictError({ message: "Der Lauf wurde gleichzeitig geändert." })
            const task = yield* tx.select().from(ProductTaskTable).where(eq(ProductTaskTable.id, run.task_id)).get()
            if (!task) return yield* taskNotFound()
            const nextTaskStatus = target === "succeeded" ? "review" : target === "waiting_permission" || target === "waiting_input" ? "waiting" : target === "running" ? "active" : "ready"
            const nextActiveRunID = terminal ? null : runID
            const updatedTask = yield* tx
              .update(ProductTaskTable)
              .set({ status: nextTaskStatus, active_run_id: nextActiveRunID, version: task.version + 1, time_updated: now })
              .where(and(eq(ProductTaskTable.id, task.id), eq(ProductTaskTable.active_run_id, runID)))
              .returning()
              .get()
            if (!updatedTask) return yield* new ConflictError({ message: "Die Aufgabenprojektion ist nicht mehr konsistent." })
            return runInfo(updatedRun)
          }),
        ).pipe(Effect.mapError(transactionError))
      }),

      acceptTask: Effect.fn("ProductTask.acceptTask")(function* (taskID, expectedVersion) {
        const row = yield* requireTask(taskID)
        yield* checkVersion(row, expectedVersion)
        if (row.status !== "review" || row.active_run_id !== null)
          return yield* invalid("Nur eine Aufgabe in Prüfung kann angenommen werden.")
        const now = Date.now()
        const updated = yield* db
          .update(ProductTaskTable)
          .set({ status: "completed", version: row.version + 1, time_updated: now, time_completed: now })
          .where(and(eq(ProductTaskTable.id, taskID), eq(ProductTaskTable.version, expectedVersion), eq(ProductTaskTable.status, "review"), isNull(ProductTaskTable.active_run_id)))
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (!updated) return yield* staleVersion(expectedVersion, row.version)
        return taskInfo(updated)
      }),

      reopenTask: Effect.fn("ProductTask.reopenTask")(function* (taskID, expectedVersion) {
        const row = yield* requireTask(taskID)
        yield* checkVersion(row, expectedVersion)
        if (row.status !== "completed" && row.status !== "cancelled")
          return yield* invalid("Nur abgeschlossene oder abgebrochene Aufgaben können wieder geöffnet werden.")
        const updated = yield* db
          .update(ProductTaskTable)
          .set({ status: "ready", version: row.version + 1, time_updated: Date.now(), time_completed: null, time_cancelled: null })
          .where(and(eq(ProductTaskTable.id, taskID), eq(ProductTaskTable.version, expectedVersion)))
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (!updated) return yield* staleVersion(expectedVersion, row.version)
        return taskInfo(updated)
      }),
    })

    return result
  }),
)

function canTransition(from: ProductRun.Status, to: ProductRun.Status) {
  if (from === "queued") return to === "running" || to === "cancelled"
  if (from === "running") return ["waiting_permission", "waiting_input", "succeeded", "failed", "cancelled", "interrupted"].includes(to)
  if (from === "waiting_permission") return ["running", "failed", "cancelled", "interrupted"].includes(to)
  if (from === "waiting_input") return ["running", "succeeded", "failed", "cancelled", "interrupted"].includes(to)
  return false
}

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })
