import { pathKey, type DraftTab, type LocalProject, type ServerConnection, type Session, type Tab } from "./upstream"

export const SESSION_DISPLAY_LIMIT = 6

export type SidebarSession = {
  session: Session
  server: ServerConnection.Key
  directory: string
}

export type SidebarProject = {
  project: LocalProject
  sessions: SidebarSession[]
}

/**
 * Drafts belong to a project through their `worktree`/`directory` fields, which is also what makes
 * them the only movable entries: an already started session is bound to its server's working
 * directory and cannot be re-homed.
 */
export function draftsForProject(tabs: Tab[], worktree: string) {
  const project = pathKey(worktree)
  return tabs.filter(
    (tab): tab is DraftTab => tab.type === "draft" && pathKey(tab.worktree ?? tab.directory) === project,
  )
}

export function moveDraftTarget(tab: Tab | undefined, worktree: string) {
  if (!tab || tab.type !== "draft") return
  if (pathKey(tab.worktree ?? tab.directory) === pathKey(worktree)) return
  return { draftID: tab.draftID, directory: worktree, worktree }
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
  return pinned.includes(key) ? pinned.filter((item) => item !== key) : [...pinned, key]
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
