import { createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import {
  applyOrder,
  CHATS_ORDER_KEY,
  chatDirectories,
  sessionPinKey,
  splitPinned,
  type SidebarProject,
  type SidebarSession,
} from "./sessions"
import {
  compareSessionTime,
  createSessionIndexQuery,
  normalizeSessionInfo,
  pathKey,
  Persist,
  persisted,
  ServerConnection,
  sortedRootSessions,
  useGlobal,
  useLayout,
  useServer,
  useServerSDK,
  useServerSync,
  useTabs,
  type Session,
} from "./upstream"

/**
 * The sidebar's session data and, with it, the order the sidebar shows: unassigned chats first,
 * then pinned sessions, then the projects.
 *
 * It lives outside `Sidebar` because the shell mounts that component only while the sidebar is
 * open, while the session and project navigation commands have to work either way. Keeping one
 * source for both means the menu never walks a different order than the list on screen.
 */
export function createSidebarData() {
  const global = useGlobal()
  const layout = useLayout()
  const server = useServer()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const tabs = useTabs()

  const [pinned, setPinned] = persisted(Persist.window("sidebar-layout.pinned"), createStore<string[]>([]))
  const [order, setOrder] = persisted(Persist.window("sidebar-layout.order"), createStore<Record<string, string[]>>({}))
  const [protocol] = createResource(() => serverSDK().protocol)
  const route = createMemo(() => layout.route())

  const [activeSession] = createResource(
    () => {
      const value = route()
      if (value.type !== "session") return
      const conn = global.servers.list().find((item) => ServerConnection.key(item) === (value.server ?? server.key))
      return conn ? { sessionID: value.sessionId, sdk: global.ensureServerCtx(conn).sdk } : undefined
    },
    ({ sessionID, sdk }) => sdk.api.session.get({ sessionID }).then(normalizeSessionInfo),
  )

  const groups = createMemo<SidebarProject[]>(() =>
    layout.projects.list().map((project) => {
      const directories = [
        project.worktree,
        ...(layout.sidebar.workspaces(project.worktree)() ? (project.sandboxes ?? []) : []),
      ]
      const sessions = directories.flatMap((directory) => {
        const [store] = serverSync().child(directory, { bootstrap: true })
        return sortedRootSessions(store, 0).map<SidebarSession>((session) => ({
          session,
          server: server.key,
          directory: session.directory ?? directory,
        }))
      })
      const current = activeSession()
      if (
        current &&
        !current.parentID &&
        !current.time.archived &&
        directories.some((directory) => pathKey(directory) === pathKey(current.directory)) &&
        !sessions.some((entry) => entry.session.id === current.id)
      ) {
        sessions.unshift({ session: current, server: server.key, directory: current.directory })
      }
      return { project, sessions }
    }),
  )

  const ownedDirectories = createMemo(() => {
    const keys = new Set<string>()
    for (const group of groups()) {
      keys.add(pathKey(group.project.worktree))
      for (const sandbox of group.project.sandboxes ?? []) keys.add(pathKey(sandbox))
    }
    return keys
  })

  // The server-wide index is the only source that knows about sessions in directories this client
  // holds no store for. It is shared with the home view through the per-server cache, so reading it
  // here costs no extra request.
  const globalSessions = createSessionIndexQuery({
    cache: () => serverSync().homeSessions,
    list: () =>
      protocol() === "v1" ? undefined : (input, options) => serverSDK().client.v2.session.list(input, options),
  })

  // The directories the child stores cover. Only a v1 server needs them: it answers no server-wide
  // session list, so its unassigned chats have to be assembled from per-directory stores instead.
  const chatLocations = createMemo(() => {
    if (protocol() !== "v1") return []
    const path = serverSync().data.path
    return chatDirectories({
      tabs: [...tabs.store],
      server: server.key,
      workingDirectory: path.directory || path.home,
      info: tabs.info,
      owned: ownedDirectories(),
    })
  })

  // Sessions started outside every open project — e.g. a prompt submitted in an unassigned chat
  // before it was dragged into one. They would otherwise disappear from the sidebar entirely.
  const chatSessions = createMemo<SidebarSession[]>(() => {
    const owned = ownedDirectories()
    const seen = new Set<string>()
    const sessions: SidebarSession[] = []
    const add = (session: Session, fallbackDirectory?: string) => {
      const directory = session.directory ?? fallbackDirectory
      if (!directory || session.parentID || session.time?.archived) return
      if (owned.has(pathKey(directory)) || seen.has(session.id)) return
      seen.add(session.id)
      sessions.push({ session, server: server.key, directory })
    }

    for (const session of globalSessions.sessions()) add(session)
    for (const directory of chatLocations()) {
      const [store] = serverSync().child(directory, { bootstrap: true })
      for (const session of sortedRootSessions(store, 0)) add(session, directory)
    }
    // Index and stores each sorted only their own rows, so the merged list needs one pass.
    sessions.sort((left, right) => compareSessionTime(left.session, right.session))

    const current = activeSession()
    if (
      current &&
      !current.parentID &&
      !current.time.archived &&
      !owned.has(pathKey(current.directory)) &&
      !seen.has(current.id)
    ) {
      sessions.unshift({ session: current, server: server.key, directory: current.directory })
    }
    const rest = sessions.filter((entry) => !pinned.includes(sessionPinKey(entry)))
    return applyOrder(rest, order[CHATS_ORDER_KEY])
  })

  /** Groups with each project's own drag order applied — the shape the sidebar renders. */
  const ordered = createMemo(() =>
    groups().map((group) => ({
      project: group.project,
      sessions: applyOrder(group.sessions, order[pathKey(group.project.worktree)]),
    })),
  )

  const split = createMemo(() => splitPinned(ordered(), [...pinned]))

  /** Every session in the order the sidebar lists them: chats, then pinned, then projects. */
  const flat = createMemo<SidebarSession[]>(() => [
    ...chatSessions(),
    ...split().pinned,
    ...split().projects.flatMap((group) => group.sessions),
  ])

  return {
    activeSession,
    chatSessions,
    flat,
    groups,
    order,
    ordered,
    ownedDirectories,
    pinned,
    protocol,
    setOrder,
    setPinned,
    split,
  }
}

export type SidebarData = ReturnType<typeof createSidebarData>
