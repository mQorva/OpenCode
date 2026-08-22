import { describe, expect, test } from "bun:test"
import { resolveLayoutMode } from "@/context/settings"
import { draftsForProject, moveDraftTarget } from "./sessions"

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

const draft = (draftID: string, worktree?: string, directory = "/fallback") =>
  ({ type: "draft", draftID, server: "local", directory, worktree }) as never

describe("draftsForProject", () => {
  test("matches on worktree", () => {
    const tabs = [draft("a", "/one"), draft("b", "/two")] as never[]
    expect(draftsForProject(tabs, "/one").map((item) => item.draftID)).toEqual(["a"])
  })

  test("falls back to directory when a draft has no worktree", () => {
    const tabs = [draft("a", undefined, "/one")] as never[]
    expect(draftsForProject(tabs, "/one").map((item) => item.draftID)).toEqual(["a"])
  })

  test("ignores session tabs", () => {
    const tabs = [{ type: "session", server: "local", sessionId: "s" }] as never[]
    expect(draftsForProject(tabs, "/one")).toEqual([])
  })
})

describe("moveDraftTarget", () => {
  test("re-homes a draft to the drop target", () => {
    expect(moveDraftTarget(draft("a", "/one"), "/two")).toEqual({
      draftID: "a",
      directory: "/two",
      worktree: "/two",
    })
  })

  test("does nothing when dropped on its own project", () => {
    expect(moveDraftTarget(draft("a", "/one"), "/one")).toBeUndefined()
  })

  test("refuses started sessions — they are bound to their working directory", () => {
    const session = { type: "session", server: "local", sessionId: "s" } as never
    expect(moveDraftTarget(session, "/two")).toBeUndefined()
  })

  test("tolerates a missing tab", () => {
    expect(moveDraftTarget(undefined, "/two")).toBeUndefined()
  })
})
