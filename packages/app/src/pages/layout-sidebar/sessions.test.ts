import { describe, expect, test } from "bun:test"
import {
  applyOrder,
  draftsForProject,
  hiddenCount,
  moveDraftTarget,
  pinKey,
  reorder,
  sessionPinKey,
  sessionTreeIDs,
  splitPinned,
  togglePin,
  visibleSessions,
  type SidebarProject,
  type SidebarSession,
} from "./sessions"

const entry = (id: string, worktree: string) =>
  ({
    session: { id, title: id } as never,
    server: "local" as never,
    directory: worktree,
  }) as never

const project = (worktree: string, ids: string[]): SidebarProject =>
  ({
    project: { worktree, expanded: false },
    sessions: ids.map((id) => entry(id, worktree)),
  }) as never

describe("splitPinned", () => {
  test("lifts pinned sessions out of their project group", () => {
    const groups = [project("/a", ["one", "two"]), project("/b", ["three"])]
    const result = splitPinned(groups, [pinKey("local" as never, "two")])

    expect(result.pinned.map((item) => item.session.id)).toEqual(["two"])
    expect(result.projects[0]!.sessions.map((item) => item.session.id)).toEqual(["one"])
    expect(result.projects[1]!.sessions.map((item) => item.session.id)).toEqual(["three"])
  })

  test("keeps the order in which sessions were pinned", () => {
    const groups = [project("/a", ["one", "two", "three"])]
    const result = splitPinned(groups, [pinKey("local" as never, "three"), pinKey("local" as never, "one")])

    expect(result.pinned.map((item) => item.session.id)).toEqual(["three", "one"])
  })

  test("ignores pins whose session no longer exists", () => {
    const groups = [project("/a", ["one"])]
    const result = splitPinned(groups, [pinKey("local" as never, "gone"), pinKey("local" as never, "one")])

    expect(result.pinned.map((item) => item.session.id)).toEqual(["one"])
  })

  test("leaves every group present even when it ends up empty", () => {
    const groups = [project("/a", ["one"]), project("/b", [])]
    const result = splitPinned(groups, [pinKey("local" as never, "one")])

    expect(result.projects).toHaveLength(2)
    expect(result.projects[0]!.sessions).toEqual([])
  })
})

describe("togglePin", () => {
  test("adds and removes", () => {
    expect(togglePin([], "a")).toEqual(["a"])
    expect(togglePin(["a", "b"], "a")).toEqual(["b"])
  })

  test("appends so the newest pin lands last", () => {
    expect(togglePin(["a"], "b")).toEqual(["a", "b"])
  })
})

describe("visibleSessions", () => {
  const many = Array.from({ length: 9 }, (_, index) => entry(`s${index}`, "/a")) as never[]

  test("truncates to the limit while collapsed", () => {
    expect(visibleSessions(many, false, 6)).toHaveLength(6)
    expect(hiddenCount(many, false, 6)).toBe(3)
  })

  test("shows everything once expanded", () => {
    expect(visibleSessions(many, true, 6)).toHaveLength(9)
    expect(hiddenCount(many, true, 6)).toBe(0)
  })

  test("does not truncate short lists", () => {
    const few = many.slice(0, 3)
    expect(visibleSessions(few, false, 6)).toHaveLength(3)
    expect(hiddenCount(few, false, 6)).toBe(0)
  })
})

describe("draft project paths", () => {
  test("matches Windows paths independent of separator style", () => {
    const draft = {
      type: "draft",
      draftID: "draft",
      server: "local",
      directory: "C:/work/project",
    } as never

    expect(draftsForProject([draft], "C:\\work\\project")).toEqual([draft])
    expect(moveDraftTarget(draft, "C:\\work\\project")).toBeUndefined()
  })
})

describe("sessionTreeIDs", () => {
  test("includes the selected session and every descendant", () => {
    const sessions = [
      { id: "root" },
      { id: "child", parentID: "root" },
      { id: "grandchild", parentID: "child" },
      { id: "other" },
    ]

    expect(sessionTreeIDs(sessions, "root")).toEqual(["root", "child", "grandchild"])
  })
})

describe("manual order", () => {
  const entry = (id: string): SidebarSession => ({
    session: { id } as SidebarSession["session"],
    server: "srv" as SidebarSession["server"],
    directory: "/work",
  })
  const key = (id: string) => sessionPinKey(entry(id))

  test("keeps stored order and puts unknown entries first", () => {
    const sessions = [entry("c"), entry("a"), entry("b")]
    const ordered = applyOrder(sessions, [key("b"), key("a")])
    expect(ordered.map((item) => item.session.id)).toEqual(["c", "b", "a"])
  })

  test("returns the input untouched without a stored order", () => {
    const sessions = [entry("a"), entry("b")]
    expect(applyOrder(sessions, undefined)).toBe(sessions)
    expect(applyOrder(sessions, [])).toBe(sessions)
  })

  test("reorder drops the moved key in front of the target", () => {
    expect(reorder(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"])
    expect(reorder(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"])
  })

  test("reorder ignores an unknown target and a self drop", () => {
    expect(reorder(["a", "b"], "a", "zzz")).toEqual(["a", "b"])
    expect(reorder(["a", "b"], "a", "a")).toEqual(["a", "b"])
  })
})
