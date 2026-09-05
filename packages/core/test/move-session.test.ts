import { describe, expect } from "bun:test"
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { eq } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { MoveSession } from "@opencode-ai/core/control-plane/move-session"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Project } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { ProjectDirectories } from "@opencode-ai/core/project/directories"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { SessionStore } from "@opencode-ai/core/session/store"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const nodes = LayerNode.group([
  MoveSession.node,
  Database.node,
  EventV2.node,
  ProjectDirectories.node,
  Project.node,
  SessionProjector.node,
  SessionStore.node,
])

const it = testEffect(AppNodeBuilder.build(nodes, [[SessionExecution.node, SessionExecution.noopLayer]]))

// A second runner whose execution service reports one fixed session as mid-turn. The guard reads
// the service the graph was built with, so the binding has to be in place before it is built.
const BUSY_SESSION = SessionV2.ID.make("ses_move_busy")
const busyLayer = Layer.succeed(
  SessionExecution.Service,
  SessionExecution.Service.of({
    active: Effect.succeed(new Set([BUSY_SESSION])),
    resume: () => Effect.void,
    wake: () => Effect.void,
    interrupt: () => Effect.void,
  }),
)
const itBusy = testEffect(AppNodeBuilder.build(nodes, [[SessionExecution.node, busyLayer]]))

function abs(input: string) {
  return AbsolutePath.make(input)
}

async function initRepo(directory: string, seed = "initial") {
  await $`git init`.cwd(directory).quiet()
  await $`git config core.autocrlf false`.cwd(directory).quiet()
  await $`git config core.fsmonitor false`.cwd(directory).quiet()
  await $`git config commit.gpgsign false`.cwd(directory).quiet()
  await $`git config user.email test@opencode.test`.cwd(directory).quiet()
  await $`git config user.name Test`.cwd(directory).quiet()
  await fs.writeFile(path.join(directory, "tracked.txt"), `${seed}\n`)
  await $`git add tracked.txt`.cwd(directory).quiet()
  await $`git commit -m root`.cwd(directory).quiet()
}

describe("MoveSession", () => {
  it.live("moves session changes to another project directory", () =>
    Effect.gen(function* () {
      const root = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
      )
      yield* Effect.promise(() => initRepo(root.path))
      const source = abs(yield* Effect.promise(() => fs.realpath(root.path)))
      const destination = abs(`${root.path}-move-destination`)
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => fs.rm(destination, { recursive: true, force: true })).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git worktree add --detach ${destination} HEAD`.cwd(root.path).quiet())
      const moved = abs(yield* Effect.promise(() => fs.realpath(destination)))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "tracked.txt"), "changed\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "untracked.txt"), "new\n"))

      const projectID = (yield* Project.Service.use((service) => service.resolve(source))).id
      const sessionID = SessionV2.ID.make("ses_move")
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({ id: projectID, worktree: source, sandboxes: [], time_created: 1, time_updated: 1 })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: projectID,
          slug: "move",
          directory: source,
          title: "move",
          version: "test",
          time_created: 1,
          time_updated: 1,
        })
        .run()
        .pipe(Effect.orDie)

      yield* MoveSession.Service.use((service) =>
        service.moveSession({ sessionID, destination: { directory: moved }, moveChanges: true }),
      )

      expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "tracked.txt"), "utf8"))).toBe("changed\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "untracked.txt"), "utf8"))).toBe("new\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(source, "tracked.txt"), "utf8"))).toBe("initial\n")
      expect(yield* Effect.promise(() => Bun.file(path.join(source, "untracked.txt")).exists())).toBe(false)
      expect(
        yield* db
          .select({ directory: SessionTable.directory, path: SessionTable.path })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get(),
      ).toEqual({ directory: moved, path: "" })
    }),
  )

  it.live("moves within a checkout without transferring existing changes", () =>
    Effect.gen(function* () {
      const root = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
      )
      yield* Effect.promise(() => initRepo(root.path))
      const source = abs(yield* Effect.promise(() => fs.realpath(root.path)))
      const destination = abs(path.join(source, "packages"))
      yield* Effect.promise(() => fs.mkdir(destination))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "tracked.txt"), "changed\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "untracked.txt"), "new\n"))

      const projectID = (yield* Project.Service.use((service) => service.resolve(source))).id
      const sessionID = SessionV2.ID.make("ses_move_nested")
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({ id: projectID, worktree: source, sandboxes: [], time_created: 1, time_updated: 1 })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: projectID,
          slug: "move-nested",
          directory: source,
          title: "move nested",
          version: "test",
          time_created: 1,
          time_updated: 1,
        })
        .run()
        .pipe(Effect.orDie)

      yield* MoveSession.Service.use((service) =>
        service.moveSession({ sessionID, destination: { directory: destination }, moveChanges: true }),
      )

      expect(yield* Effect.promise(() => fs.readFile(path.join(source, "tracked.txt"), "utf8"))).toBe("changed\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(source, "untracked.txt"), "utf8"))).toBe("new\n")
      expect(
        yield* db
          .select({ directory: SessionTable.directory, path: SessionTable.path })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get(),
      ).toEqual({ directory: destination, path: "packages" })
    }),
  )

  it.live("moves nested session changes without cleaning unrelated files", () =>
    Effect.gen(function* () {
      const root = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
      )
      yield* Effect.promise(() => initRepo(root.path))
      const source = abs(yield* Effect.promise(() => fs.realpath(root.path)))
      const sourceDirectory = abs(path.join(source, "packages"))
      yield* Effect.promise(() => fs.mkdir(sourceDirectory))
      yield* Effect.promise(() => fs.writeFile(path.join(sourceDirectory, "tracked.txt"), "initial\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(sourceDirectory, "staged.txt"), "initial\n"))
      yield* Effect.promise(() => $`git add packages/tracked.txt packages/staged.txt`.cwd(source).quiet())
      yield* Effect.promise(() => $`git commit -m packages`.cwd(source).quiet())
      const destination = abs(`${root.path}-move-nested-destination`)
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => fs.rm(destination, { recursive: true, force: true })).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git worktree add --detach ${destination} HEAD`.cwd(source).quiet())
      const moved = abs(path.join(yield* Effect.promise(() => fs.realpath(destination)), "packages"))
      yield* Effect.promise(() => fs.writeFile(path.join(sourceDirectory, "tracked.txt"), "changed\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(sourceDirectory, "staged.txt"), "staged\n"))
      yield* Effect.promise(() => $`git add packages/staged.txt`.cwd(source).quiet())
      yield* Effect.promise(() => fs.writeFile(path.join(sourceDirectory, "untracked.txt"), "new\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "tracked.txt"), "unrelated\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(source, "untracked.txt"), "unrelated\n"))

      const projectID = (yield* Project.Service.use((service) => service.resolve(source))).id
      const sessionID = SessionV2.ID.make("ses_move_nested_checkout")
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({ id: projectID, worktree: source, sandboxes: [], time_created: 1, time_updated: 1 })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: projectID,
          slug: "move-nested-checkout",
          directory: sourceDirectory,
          title: "move nested checkout",
          version: "test",
          time_created: 1,
          time_updated: 1,
        })
        .run()
        .pipe(Effect.orDie)

      yield* MoveSession.Service.use((service) =>
        service.moveSession({ sessionID, destination: { directory: moved }, moveChanges: true }),
      )

      expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "tracked.txt"), "utf8"))).toBe("changed\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "staged.txt"), "utf8"))).toBe("staged\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "untracked.txt"), "utf8"))).toBe("new\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(sourceDirectory, "tracked.txt"), "utf8"))).toBe(
        "initial\n",
      )
      expect(yield* Effect.promise(() => Bun.file(path.join(sourceDirectory, "untracked.txt")).exists())).toBe(false)
      expect(yield* Effect.promise(() => fs.readFile(path.join(sourceDirectory, "staged.txt"), "utf8"))).toBe(
        "staged\n",
      )
      expect(yield* Effect.promise(() => $`git status --porcelain -- packages/staged.txt`.cwd(source).text())).toBe(
        "M  packages/staged.txt\n",
      )
      expect(yield* Effect.promise(() => fs.readFile(path.join(source, "tracked.txt"), "utf8"))).toBe("unrelated\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(source, "untracked.txt"), "utf8"))).toBe("unrelated\n")
    }),
  )
  it.live("refuses a move into another project unless it is asked for", () =>
    Effect.gen(function* () {
      const fixture = yield* twoProjects("ses_move_refuse")

      const error = yield* Effect.flip(
        MoveSession.Service.use((service) =>
          service.moveSession({ sessionID: fixture.sessionID, destination: { directory: fixture.other } }),
        ),
      )

      expect(error).toBeInstanceOf(MoveSession.DestinationProjectMismatchError)
      expect(yield* fixture.row()).toEqual({ directory: fixture.source, project_id: fixture.projectID })
    }),
  )

  it.live("moves into another project and carries the project along", () =>
    Effect.gen(function* () {
      const fixture = yield* twoProjects("ses_move_cross")

      yield* MoveSession.Service.use((service) =>
        service.moveSession({
          sessionID: fixture.sessionID,
          destination: { directory: fixture.other },
          allowProjectChange: true,
        }),
      )

      expect(yield* fixture.row()).toEqual({ directory: fixture.other, project_id: fixture.otherProjectID })
    }),
  )

  it.live("refuses to move a session with a staged revert into another project", () =>
    Effect.gen(function* () {
      const fixture = yield* twoProjects(SessionV2.ID.make("ses_move_revert"))
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({ revert: { messageID: SessionMessage.ID.make("msg_staged"), snapshot: "0".repeat(40) } })
        .where(eq(SessionTable.id, fixture.sessionID))
        .run()
        .pipe(Effect.orDie)

      const error = yield* Effect.flip(
        MoveSession.Service.use((service) =>
          service.moveSession({
            sessionID: fixture.sessionID,
            destination: { directory: fixture.other },
            allowProjectChange: true,
          }),
        ),
      )

      expect(error).toBeInstanceOf(MoveSession.PendingRevertError)
      expect(yield* fixture.row()).toEqual({ directory: fixture.source, project_id: fixture.projectID })
    }),
  )

  itBusy.live("refuses to move a session that is mid-turn", () =>
    Effect.gen(function* () {
      const fixture = yield* twoProjects(BUSY_SESSION)

      const error = yield* Effect.flip(
        MoveSession.Service.use((service) =>
          service.moveSession({
            sessionID: fixture.sessionID,
            destination: { directory: fixture.other },
            allowProjectChange: true,
          }),
        ),
      )

      expect(error).toBeInstanceOf(MoveSession.SessionBusyError)
      expect(yield* fixture.row()).toEqual({ directory: fixture.source, project_id: fixture.projectID })
    }),
  )

  it.live("refuses to carry uncommitted changes into another project", () =>
    Effect.gen(function* () {
      const fixture = yield* twoProjects("ses_move_cross_changes")
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.source, "tracked.txt"), "changed\n"))

      const error = yield* Effect.flip(
        MoveSession.Service.use((service) =>
          service.moveSession({
            sessionID: fixture.sessionID,
            destination: { directory: fixture.other },
            allowProjectChange: true,
            moveChanges: true,
          }),
        ),
      )

      expect(error).toBeInstanceOf(MoveSession.ChangesAcrossProjectsError)
      // The source keeps its work: a refused move must not discard anything.
      expect(yield* Effect.promise(() => fs.readFile(path.join(fixture.source, "tracked.txt"), "utf8"))).toBe(
        "changed\n",
      )
      expect(yield* fixture.row()).toEqual({ directory: fixture.source, project_id: fixture.projectID })
    }),
  )
})

// Two unrelated repositories, so the destination resolves to a different project rather than a
// worktree of the same one.
function twoProjects(id: string) {
  return Effect.gen(function* () {
    const root = yield* Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    )
    const otherRoot = yield* Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    )
    yield* Effect.promise(() => initRepo(root.path))
    yield* Effect.promise(() => initRepo(otherRoot.path, "other"))
    const source = abs(yield* Effect.promise(() => fs.realpath(root.path)))
    const other = abs(yield* Effect.promise(() => fs.realpath(otherRoot.path)))

    const projectID = (yield* Project.Service.use((service) => service.resolve(source))).id
    const otherProjectID = (yield* Project.Service.use((service) => service.resolve(other))).id
    expect(otherProjectID).not.toBe(projectID)

    const sessionID = SessionV2.ID.make(id)
    const { db } = yield* Database.Service
    // Only the source project is recorded. Nothing has ever run in the destination, which is the
    // normal case for a session moving into a project for the first time.
    yield* db
      .insert(ProjectTable)
      .values({ id: projectID, worktree: source, sandboxes: [], time_created: 1, time_updated: 1 })
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: sessionID,
        project_id: projectID,
        slug: id,
        directory: source,
        title: id,
        version: "test",
        time_created: 1,
        time_updated: 1,
      })
      .run()
      .pipe(Effect.orDie)

    const row = () =>
      db
        .select({ directory: SessionTable.directory, project_id: SessionTable.project_id })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get()

    return { source, other, projectID, otherProjectID, sessionID, row }
  })
}
