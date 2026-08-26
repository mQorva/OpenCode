import { describe, expect, test } from "bun:test"
import { resolveLayoutMode } from "@/context/settings"
import type { DraftTab, ServerConnection, Tab } from "./upstream"
import { draftsForProject, moveDraftTarget, unassignedDrafts } from "./sessions"

describe("resolveLayoutMode", () => {
  test("defaults to the integrated sidebar shell for the new interface", () => {
    expect(resolveLayoutMode(true, undefined)).toBe("sidebar")
  })

  test("honours the preference on top of the new designs", () => {
    expect(resolveLayoutMode(true, "sidebar")).toBe("sidebar")
    expect(resolveLayoutMode(true, "tabs")).toBe("tabs")
  })

  test("never applies to the legacy shell", () => {
    expect(resolveLayoutMode(false, "sidebar")).toBe("tabs")
  })
})

const server = "local" as ServerConnection.Key

const draft = (draftID: string, worktree?: string, directory = "/fallback"): DraftTab => ({
  type: "draft",
  draftID,
  server,
  directory,
  worktree,
})

const sessionTab = (): Tab => ({ type: "session", server, sessionId: "s" })

describe("draftsForProject", () => {
  test("matches on worktree", () => {
    const tabs = [draft("a", "/one"), draft("b", "/two")]
    expect(draftsForProject(tabs, "/one").map((item) => item.draftID)).toEqual(["a"])
  })

  test("falls back to directory when a draft has no worktree", () => {
    const tabs = [draft("a", undefined, "/one")]
    expect(draftsForProject(tabs, "/one").map((item) => item.draftID)).toEqual(["a"])
  })

  test("ignores session tabs", () => {
    const tabs = [sessionTab()]
    expect(draftsForProject(tabs, "/one")).toEqual([])
  })

  test("keeps unassigned drafts out of every project group", () => {
    const tabs = [{ ...draft("a", "/one"), unassigned: true }]
    expect(draftsForProject(tabs, "/one")).toEqual([])
  })
})

describe("moveDraftTarget", () => {
  test("re-homes a draft to the drop target", () => {
    expect(moveDraftTarget(draft("a", "/one"), "/two")).toEqual({
      draftID: "a",
      directory: "/two",
      worktree: "/two",
      unassigned: false,
    })
  })

  test("assigns an unassigned draft to any project, including its current directory", () => {
    const unassigned = { ...draft("a", "/one"), unassigned: true }
    expect(moveDraftTarget(unassigned, "/two")).toEqual({
      draftID: "a",
      directory: "/two",
      worktree: "/two",
      unassigned: false,
    })
    expect(moveDraftTarget(unassigned, "/one")).toEqual({
      draftID: "a",
      directory: "/one",
      worktree: "/one",
      unassigned: false,
    })
  })

  test("does nothing when dropped on its own project", () => {
    expect(moveDraftTarget(draft("a", "/one"), "/one")).toBeUndefined()
  })

  test("refuses started sessions — they are bound to their working directory", () => {
    expect(moveDraftTarget(sessionTab(), "/two")).toBeUndefined()
  })

  test("tolerates a missing tab", () => {
    expect(moveDraftTarget(undefined, "/two")).toBeUndefined()
  })
})

describe("unassignedDrafts", () => {
  test("picks only drafts flagged unassigned", () => {
    const tabs = [draft("b", "/two"), { ...draft("a", "/one"), unassigned: true }]
    expect(unassignedDrafts(tabs).map((item) => item.draftID)).toEqual(["a"])
  })

  test("ignores session tabs", () => {
    const tabs = [sessionTab()]
    expect(unassignedDrafts(tabs)).toEqual([])
  })
})
