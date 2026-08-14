import { describe, expect } from "bun:test"
import { ProductRun, ProductTask as ProductTaskSchema } from "@opencode-ai/schema"
import { ProductTask } from "@opencode-ai/core/product-task"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ProjectV2 } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { Effect } from "effect"
import { testEffect } from "./lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, ProductTask.node])))

const projectID = ProjectV2.ID.make("product-task-test-project")
const otherProjectID = ProjectV2.ID.make("product-task-test-other")

function seed() {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(ProjectTable)
      .values([
        { id: projectID, worktree: AbsolutePath.make("C:\\product-task-test"), sandboxes: [] },
        { id: otherProjectID, worktree: AbsolutePath.make("C:\\product-task-test-other"), sandboxes: [] },
      ])
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
  })
}

function session(id: SessionSchema.ID, project = projectID, parentID?: SessionSchema.ID) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(SessionTable)
      .values({
        id,
        project_id: project,
        parent_id: parentID,
        slug: id,
        directory: AbsolutePath.make("C:\\product-task-test"),
        title: "Test session",
        version: "test",
      })
      .run()
      .pipe(Effect.orDie)
  })
}

function completion(rootSessionID: SessionSchema.ID): ProductRun.CompletionSummary {
  return ProductRun.CompletionSummary.make({
    rootSessionID,
    childSessionIDs: [],
    finalAssistantSummary: "Implemented and checked.",
    changedFiles: [],
    diff: { additions: 0, deletions: 0, files: 0 },
    outstandingPermissionIDs: [],
    outstandingQuestionIDs: [],
    checks: [{ name: "typecheck", status: "passed", source: "reported" }],
    usage: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 }, cost: 0 },
  })
}

describe("ProductTask", () => {
  it.effect("creates, lists, updates, archives, and restores a task", () =>
    Effect.gen(function* () {
      yield* seed()
      const service = yield* ProductTask.Service
      const created = yield* service.createTask({ projectID, title: "  First task  ", description: "Line 1\r\nLine 2" })

      expect(created.title).toBe("First task")
      expect(created.description).toBe("Line 1\nLine 2")
      expect(yield* service.listTasks(projectID)).toEqual([created])

      const updated = yield* service.updateTask({
        taskID: created.id,
        expectedVersion: created.version,
        patch: { title: "Updated", position: 3 },
      })
      expect(updated.version).toBe(2)
      expect(updated.position).toBe(3)

      const stale = yield* service
        .updateTask({ taskID: created.id, expectedVersion: 1, patch: { title: "Stale" } })
        .pipe(Effect.flip)
      expect(stale._tag).toBe("ProductTask.StaleVersionError")

      const archived = yield* service.archiveTask(created.id, updated.version)
      expect(yield* service.listTasks(projectID)).toEqual([])
      expect(yield* service.listTasks(projectID, true)).toHaveLength(1)
      const restored = yield* service.restoreTask(created.id, archived.version)
      expect(restored.archivedAt).toBeUndefined()
    }),
  )

  it.effect("preserves run history through failure, retry, review, and acceptance", () =>
    Effect.gen(function* () {
      yield* seed()
      const service = yield* ProductTask.Service
      const task = yield* service.createTask({ projectID, title: "Run task" })
      const firstSessionID = SessionSchema.ID.create()
      yield* session(firstSessionID)

      const first = yield* service.beginRun(task.id, task.version, "new")
      yield* service.linkSession(first.id, firstSessionID)
      yield* service.transitionRun(first.id, "running")
      const failed = yield* service.transitionRun(first.id, "failed", {
        failureCode: "tool_failed",
        failureMessage: "Build failed\nsecret-free detail",
      })
      expect(failed.status).toBe("failed")

      const ready = yield* service.getTask(task.id)
      expect(ready.status).toBe("ready")
      const secondSessionID = SessionSchema.ID.create()
      yield* session(secondSessionID)
      const retry = yield* service.beginRun(task.id, ready.version, "retry")
      expect(retry.sequence).toBe(2)
      yield* service.linkSession(retry.id, secondSessionID)
      yield* service.transitionRun(retry.id, "running")
      yield* service.transitionRun(retry.id, "succeeded", { completionSummary: completion(secondSessionID) })

      const review = yield* service.getTask(task.id)
      expect(review.status).toBe("review")
      const accepted = yield* service.acceptTask(task.id, review.version)
      expect(accepted.status).toBe("completed")
      expect(yield* service.listRuns(task.id)).toHaveLength(2)

      const reopened = yield* service.reopenTask(task.id, accepted.version)
      expect(reopened.status).toBe("ready")
      expect(reopened.completedAt).toBeUndefined()
    }),
  )

  it.effect("rejects invalid transitions and sessions outside the task hierarchy", () =>
    Effect.gen(function* () {
      yield* seed()
      const service = yield* ProductTask.Service
      const task = yield* service.createTask({ projectID, title: "Protected task" })
      const run = yield* service.beginRun(task.id, task.version, "new")

      const withoutSession = yield* service.transitionRun(run.id, "running").pipe(Effect.flip)
      expect(withoutSession._tag).toBe("ProductTask.InvalidTransitionError")

      const wrongSessionID = SessionSchema.ID.create()
      yield* session(wrongSessionID, otherProjectID)
      const wrongProject = yield* service.linkSession(run.id, wrongSessionID).pipe(Effect.flip)
      expect(wrongProject._tag).toBe("ProductTask.ConflictError")

      const parentID = SessionSchema.ID.create()
      const childID = SessionSchema.ID.create()
      yield* session(parentID)
      yield* session(childID, projectID, parentID)
      const child = yield* service.linkSession(run.id, childID).pipe(Effect.flip)
      expect(child._tag).toBe("ProductTask.ConflictError")

      const activeTask = yield* service.getTask(task.id)
      const archive = yield* service.archiveTask(task.id, activeTask.version).pipe(Effect.flip)
      expect(archive._tag).toBe("ProductTask.ConflictError")
    }),
  )
})
