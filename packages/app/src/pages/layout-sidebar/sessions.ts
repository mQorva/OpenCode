import {
  pathKey,
  tabKey,
  type DraftTab,
  type LocalProject,
  type ServerConnection,
  type Session,
  type Tab,
} from "./upstream-core"

export const SESSION_DISPLAY_LIMIT = 6

export type SidebarSession = {
  session: Session
  server: ServerConnection.Key
  directory: string
  /**
   * The route points at this session but the server does not know it — deleted elsewhere, a
   * different database, a server that is not the one it was created on. The entry is a placeholder
   * so the sidebar can say so instead of silently listing nothing.
   */
  missing?: boolean
}

export type SidebarProject = {
  project: LocalProject
  sessions: SidebarSession[]
}

/**
 * Multi-selection state inside one group — a project group or the pinned block. `block` pins the
 * selection to one group (a pathKey for a project, `PINNED_ORDER_KEY` for pinned) so a selection
 * never silently spans groups; `anchor` is the reference key for shift-click ranges.
 */
export type SidebarSelection = {
  block?: string
  anchor?: string
  keys: string[]
}

/**
 * Drafts belong to a project through their `worktree`/`directory` fields, which is also what makes
 * them the only movable entries: an already started session is bound to its server's working
 * directory and cannot be re-homed. Drafts flagged `unassigned` sit in the separate chats block
 * until a drop assigns them to a project.
 */
export function draftsForProject(tabs: Tab[], worktree: string) {
  const project = pathKey(worktree)
  return tabs.filter(
    (tab): tab is DraftTab => tab.type === "draft" && !tab.unassigned && pathKey(tab.worktree ?? tab.directory) === project,
  )
}

/**
 * Directories whose sessions belong in the unassigned chats block.
 *
 * The server working directory alone is not enough: it contributes nothing once it belongs to an
 * open project, and a child store only ever reports sessions of its own directory. Open session
 * tabs therefore contribute their cached directories too, which is what lets a session be located
 * before its store has been bootstrapped.
 */
export function chatDirectories(input: {
  tabs: Tab[]
  server: ServerConnection.Key
  workingDirectory?: string
  info: Record<string, { directory?: string }>
  owned: Set<string>
}) {
  const found = new Map<string, string>()
  const add = (directory?: string) => {
    if (!directory) return
    const key = pathKey(directory)
    if (input.owned.has(key) || found.has(key)) return
    found.set(key, directory)
  }
  add(input.workingDirectory)
  for (const tab of input.tabs) {
    if (tab.type !== "session" || tab.server !== input.server) continue
    add(input.info[tabKey(tab)]?.directory)
  }
  return [...found.values()]
}

export function unassignedDrafts(tabs: Tab[]) {
  return tabs.filter((tab): tab is DraftTab => tab.type === "draft" && tab.unassigned === true)
}

export function moveDraftTarget(tab: Tab | undefined, worktree: string) {
  if (!tab || tab.type !== "draft") return
  if (tab.unassigned !== true && pathKey(tab.worktree ?? tab.directory) === pathKey(worktree)) return
  return { draftID: tab.draftID, directory: worktree, worktree, unassigned: false }
}

export const pinKey = (server: ServerConnection.Key, sessionID: string) => `${server}\n${sessionID}`

export const sessionPinKey = (entry: SidebarSession) => pinKey(entry.server, entry.session.id)

/**
 * Pinned sessions are lifted out of their project group and shown in their own section, in the
 * order they were pinned. Everything else stays grouped under its project.
 */
export function splitPinned(projects: SidebarProject[], pinned: string[]) {
  const wanted = new Set(pinned)
  const found = new Map<string, SidebarSession>()
  const rest: SidebarProject[] = []

  for (const group of projects) {
    const remaining: SidebarSession[] = []
    for (const entry of group.sessions) {
      const key = sessionPinKey(entry)
      if (wanted.has(key)) {
        found.set(key, entry)
        continue
      }
      remaining.push(entry)
    }
    rest.push({ project: group.project, sessions: remaining })
  }

  // Keep the user's pin order, and drop keys whose session is no longer around.
  return {
    pinned: pinned.flatMap((key) => {
      const entry = found.get(key)
      return entry ? [entry] : []
    }),
    projects: rest,
  }
}

export function togglePin(pinned: string[], key: string) {
  return togglePins(pinned, [key])
}

/**
 * Pin a batch like a single pin: when every key is already pinned, unpin them all; otherwise pin
 * every key. This keeps a mixed selection predictable — the menu label says "pin" and pins.
 */
export function togglePins(pinned: string[], keys: string[]) {
  if (keys.length === 0) return pinned
  if (keys.every((key) => pinned.includes(key))) return pinned.filter((key) => !keys.includes(key))
  return [...new Set([...pinned, ...keys])]
}

/** Toggle one key in a multi-selection. */
export function toggleSelection(keys: string[], key: string) {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
}

/**
 * Shift-click range inside a group. With no anchor, or when either key is unknown, fall back to a
 * single-key selection instead of silently keeping the old selection.
 */
export function selectionRange(ordered: string[], anchor: string | undefined, key: string) {
  if (!anchor) return [key]
  const from = ordered.indexOf(anchor)
  const to = ordered.indexOf(key)
  if (from < 0 || to < 0) return [key]
  const [start, end] = from <= to ? [from, to] : [to, from]
  return ordered.slice(start, end + 1)
}

/** Long project lists collapse to a "show more" affordance instead of scrolling forever. */
export function visibleSessions(sessions: SidebarSession[], expanded: boolean, limit = SESSION_DISPLAY_LIMIT) {
  if (expanded || sessions.length <= limit) return sessions
  return sessions.slice(0, limit)
}

export function hiddenCount(sessions: SidebarSession[], expanded: boolean, limit = SESSION_DISPLAY_LIMIT) {
  if (expanded || sessions.length <= limit) return 0
  return sessions.length - limit
}

/** A removed root session also removes every branch in its OpenCode session tree. */
export function sessionTreeIDs(sessions: Array<{ id: string; parentID?: string }>, rootID: string) {
  const byParent = new Map<string, string[]>()
  for (const session of sessions) {
    if (!session.parentID) continue
    const children = byParent.get(session.parentID) ?? []
    children.push(session.id)
    byParent.set(session.parentID, children)
  }

  const removed = new Set([rootID])
  const pending = [rootID]
  while (pending.length > 0) {
    const parentID = pending.pop()
    if (!parentID) continue
    for (const childID of byParent.get(parentID) ?? []) {
      if (removed.has(childID)) continue
      removed.add(childID)
      pending.push(childID)
    }
  }
  return [...removed]
}

/** Block a session is sorted within: its project, the pinned section, or the unassigned chats. */
export const CHATS_ORDER_KEY = "\0chats"
export const PINNED_ORDER_KEY = "\0pinned"

/**
 * Manual order for one block. Entries the user never touched — a session started after the last
 * reorder — sort ahead of the stored ones by creation time. Activity must not move chats around.
 */
export function applyOrder(sessions: SidebarSession[], order: string[] | undefined) {
  const rank = new Map((order ?? []).map((key, index) => [key, index] as const))
  return [...sessions].sort((a, b) => {
    const left = rank.get(sessionPinKey(a))
    const right = rank.get(sessionPinKey(b))
    if (left === undefined && right === undefined) {
      const created = b.session.time.created - a.session.time.created
      if (created !== 0) return created
      return a.session.id < b.session.id ? -1 : a.session.id > b.session.id ? 1 : 0
    }
    if (left === undefined) return -1
    if (right === undefined) return 1
    return left - right
  })
}

/** Drop `moved` in front of `target`. Returns the input unchanged when the target is unknown. */
export function reorder(keys: string[], moved: string, target: string) {
  if (moved === target) return keys
  const next = keys.filter((key) => key !== moved)
  const index = next.indexOf(target)
  if (index < 0) return keys
  next.splice(index, 0, moved)
  return next
}

/** The order stored for a block, seeded from what is currently on screen. */
export function orderFor(sessions: SidebarSession[], stored: string[] | undefined) {
  const keys = applyOrder(sessions, stored).map(sessionPinKey)
  return keys
}

/**
 * Index of the entry to move to, wrapping at both ends.
 *
 * `from` of -1 means the current position is unknown — stepping forward then starts at the first
 * entry, stepping back at the last, so a keypress always lands somewhere.
 */
export function stepIndex(length: number, from: number, offset: number) {
  if (length === 0) return -1
  if (from < 0) return offset > 0 ? 0 : length - 1
  return (from + offset + length) % length
}

/**
 * Like `stepIndex`, but skips entries that cannot be navigated to — a project whose sessions have
 * not loaded yet has nothing to open. Returns -1 when every entry is empty.
 *
 * Walking on instead of filtering keeps the index stable while sessions are still arriving: the
 * position of the remaining projects does not shift under a second keypress.
 */
export function stepIndexSkipping(length: number, from: number, offset: number, usable: (index: number) => boolean) {
  if (length === 0) return -1
  let at = from
  for (let taken = 0; taken < length; taken++) {
    at = stepIndex(length, at, offset)
    if (usable(at)) return at
  }
  return -1
}
