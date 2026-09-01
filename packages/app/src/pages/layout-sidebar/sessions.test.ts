import { describe, expect, test } from "bun:test"
import {
  applyOrder,
  chatDirectories,
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
import { pathKey, tabKey } from "./upstream"

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
  const entry = (id: string, created = 0, updated = created): SidebarSession => ({
    session: { id, time: { created, updated } } as SidebarSession["session"],
    server: "srv" as SidebarSession["server"],
    directory: "/work",
  })
  const key = (id: string) => sessionPinKey(entry(id))

  test("keeps stored order and puts unknown entries first", () => {
    const sessions = [entry("c"), entry("a"), entry("b")]
    const ordered = applyOrder(sessions, [key("b"), key("a")])
    expect(ordered.map((item) => item.session.id)).toEqual(["c", "b", "a"])
  })

  test("sorts by creation time without letting activity change the order", () => {
    const sessions = [entry("old", 100, 900), entry("new", 200, 300), entry("middle", 150, 800)]
    expect(applyOrder(sessions, undefined).map((item) => item.session.id)).toEqual(["new", "middle", "old"])
    expect(applyOrder(sessions, []).map((item) => item.session.id)).toEqual(["new", "middle", "old"])
  })

  test("puts newly created entries above the stored manual order", () => {
    const sessions = [entry("a", 100, 900), entry("new", 300), entry("b", 200, 800)]
    expect(applyOrder(sessions, [key("b"), key("a")]).map((item) => item.session.id)).toEqual(["new", "b", "a"])
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

describe("chatDirectories", () => {
  const sessionTab = (sessionId: string) => ({ type: "session", server: "local", sessionId }) as never
  const key = (sessionId: string, server = "local") =>
    tabKey({ type: "session", server, sessionId } as never)

  const call = (input: {
    tabs?: never[]
    workingDirectory?: string
    info?: Record<string, { directory?: string }>
    owned?: string[]
  }) =>
    chatDirectories({
      tabs: input.tabs ?? [],
      server: "local" as never,
      workingDirectory: input.workingDirectory,
      info: input.info ?? {},
      owned: new Set(input.owned ?? []),
    })

  test("keeps the server working directory when no project owns it", () => {
    expect(call({ workingDirectory: "/work" })).toEqual(["/work"])
  })

  test("drops the server working directory once a project owns it", () => {
    expect(call({ workingDirectory: "/work", owned: [pathKey("/work")] })).toEqual([])
  })

  test("adds directories of open session tabs so their sessions stay reachable", () => {
    const result = call({
      workingDirectory: "/work",
      owned: [pathKey("/work")],
      tabs: [sessionTab("one")] as never,
      info: { [key("one")]: { directory: "/elsewhere" } },
    })

    expect(result).toEqual(["/elsewhere"])
  })

  test("skips tab directories that a project already owns", () => {
    const result = call({
      owned: [pathKey("/project")],
      tabs: [sessionTab("one")] as never,
      info: { [key("one")]: { directory: "/project" } },
    })

    expect(result).toEqual([])
  })

  test("reports each directory once", () => {
    const result = call({
      workingDirectory: "/work",
      tabs: [sessionTab("one"), sessionTab("two")] as never,
      info: { [key("one")]: { directory: "/work" }, [key("two")]: { directory: "/other" } },
    })

    expect(result).toEqual(["/work", "/other"])
  })

  test("ignores tabs of other servers and drafts", () => {
    const result = call({
      tabs: [
        { type: "session", server: "remote", sessionId: "one" },
        { type: "draft", draftID: "d1", server: "local", directory: "/draft" },
      ] as never,
      info: { [key("one", "remote")]: { directory: "/remote" } },
    })

    expect(result).toEqual([])
  })
})
