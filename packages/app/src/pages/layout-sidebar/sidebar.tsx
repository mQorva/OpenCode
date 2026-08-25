import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { createStore, produce } from "solid-js/store"
import {
  DragDropProvider,
  DragDropSensors,
  createDraggable,
  createDroppable,
  type DragEventHandler,
} from "@thisbeyond/solid-dnd"
import { SessionItem } from "./session-item"
import { ProjectStartDialog } from "./project-start-dialog"
import {
  draftsForProject,
  hiddenCount,
  moveDraftTarget,
  sessionPinKey,
  sessionTreeIDs,
  splitPinned,
  togglePin,
  visibleSessions,
  type SidebarProject,
  type SidebarSession,
} from "./sessions"
import {
  displayName,
  createHomeController,
  ContextMenu,
  DropdownMenu,
  ServerConnection,
  ButtonV2,
  DialogFooter,
  DialogHeader,
  DialogTitleGroup,
  DialogV2,
  Icon,
  IconButton,
  IconButtonV2,
  Persist,
  ResizeHandle,
  normalizeSessionInfo,
  pathKey,
  persisted,
  sortedRootSessions,
  errorMessage,
  showToast,
  Tooltip,
  useDirectoryPicker,
  useDialog,
  useGlobal,
  useLanguage,
  useLayout,
  useNotification,
  usePlatform,
  useServer,
  useServerSDK,
  useServerSync,
  useSettingsDialog,
  useTabs,
  type DraftTab,
  type LocalProject,
} from "./upstream"

const SIDEBAR_WIDTH_MIN = 260

function ProjectMenuItems(props: {
  onNewChat: () => void
  onEdit: () => void
  onCopyName: () => void
  onCopyPath: () => void
  onReveal?: () => void
  onToggleWorkspaces?: () => void
  workspacesEnabled?: boolean
  onClearNotifications?: () => void
  onClose: () => void
  context?: boolean
}) {
  const language = useLanguage()
  const Menu = props.context ? ContextMenu : DropdownMenu

  return (
    <>
      <Menu.Item onSelect={props.onNewChat}>
        <Menu.ItemLabel>{language.t("command.session.new")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onEdit}>
        <Menu.ItemLabel>{language.t("sidebarLayout.projectSettings")}</Menu.ItemLabel>
      </Menu.Item>
      <Show when={props.onToggleWorkspaces}>
        <Menu.Item onSelect={props.onToggleWorkspaces}>
          <Menu.ItemLabel>
            {language.t(props.workspacesEnabled ? "sidebar.workspaces.disable" : "sidebar.workspaces.enable")}
          </Menu.ItemLabel>
        </Menu.Item>
      </Show>
      <Show when={props.onClearNotifications}>
        <Menu.Item onSelect={props.onClearNotifications}>
          <Menu.ItemLabel>{language.t("sidebar.project.clearNotifications")}</Menu.ItemLabel>
        </Menu.Item>
      </Show>
      <Menu.Separator />
      <Menu.Item onSelect={props.onCopyName}>
        <Menu.ItemLabel>{language.t("sidebarLayout.copyProjectName")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onCopyPath}>
        <Menu.ItemLabel>{language.t("sidebarLayout.copyProjectPath")}</Menu.ItemLabel>
      </Menu.Item>
      <Show when={props.onReveal}>
        <Menu.Item onSelect={props.onReveal}>
          <Menu.ItemLabel>{language.t("sidebarLayout.revealProject")}</Menu.ItemLabel>
        </Menu.Item>
      </Show>
      <Menu.Separator />
      <Menu.Item onSelect={props.onClose}>
        <Menu.ItemLabel>{language.t("sidebarLayout.removeProject")}</Menu.ItemLabel>
      </Menu.Item>
    </>
  )
}

function DraftItem(props: { draft: DraftTab; active: boolean; onSelect: () => void; onClose: () => void }) {
  const language = useLanguage()
  const draggable = createDraggable(props.draft.draftID)

  return (
    <div
      // @ts-expect-error -- solid-dnd directive
      use:draggable={draggable}
      classList={{
        "group/draft relative w-full h-8 min-w-0 flex items-center rounded-lg pl-8 pr-1 text-13-regular transition-colors": true,
        "bg-v2-background-bg-layer-02 text-text-strong": props.active,
        "text-text-base hover:bg-v2-background-bg-layer-02/60 hover:text-text-strong": !props.active,
        "opacity-50": draggable.isActiveDraggable,
      }}
    >
      <Show when={props.active}>
        <span class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-icon-strong-base" />
      </Show>
      <button
        type="button"
        onClick={props.onSelect}
        class="min-w-0 h-full flex-1 truncate text-left outline-none"
        aria-current={props.active ? "page" : undefined}
      >
        {language.t("sidebarLayout.draft")}
      </button>
      <Tooltip value={language.t("common.close")} placement="top">
        <IconButton
          icon="close-small"
          iconSize="small"
          variant="ghost"
          class="!size-7 shrink-0 rounded-md text-icon-base opacity-0 group-hover/draft:opacity-100 group-focus-within/draft:opacity-100"
          onClick={props.onClose}
          aria-label={language.t("common.close")}
        />
      </Tooltip>
    </div>
  )
}

function ProjectGroup(props: {
  group: SidebarProject
  active: boolean
  drafts: DraftTab[]
  collapsed: boolean
  sessionsExpanded: boolean
  activeSessionID?: string
  activeDraftID?: string
  isPinned: (entry: SidebarSession) => boolean
  isUnread: (entry: SidebarSession) => boolean
  onToggleCollapsed: () => void
  onExpandSessions: () => void
  onSelect: (entry: SidebarSession) => void
  onSelectDraft: (draft: DraftTab) => void
  onCloseDraft: (draft: DraftTab) => void
  onRename: (entry: SidebarSession, title: string) => Promise<boolean>
  onMarkUnread: (entry: SidebarSession) => void
  onTogglePin: (entry: SidebarSession) => void
  sessionWorking: (entry: SidebarSession) => boolean
  onNewChat: () => void
  onEditProject: () => void
  onCopyProjectName: () => void
  onCopyProjectPath: () => void
  onRevealProject?: () => void
  workspacesEnabled: boolean
  onToggleWorkspaces?: () => void
  unseenCount: number
  onClearNotifications?: () => void
  onCloseProject: () => void
  onCopySessionTitle: (entry: SidebarSession) => void
  onCopySessionID: (entry: SidebarSession) => void
  onCopySessionProject: () => void
  onArchive: (entry: SidebarSession) => void
  onDelete: (entry: SidebarSession) => void
  canArchive: boolean
}) {
  const language = useLanguage()
  const droppable = createDroppable(props.group.project.worktree)
  const [menuOpen, setMenuOpen] = createSignal(false)
  const shown = () => visibleSessions(props.group.sessions, props.sessionsExpanded)
  const hidden = () => hiddenCount(props.group.sessions, props.sessionsExpanded)
  const empty = () => props.group.sessions.length === 0 && props.drafts.length === 0

  return (
    <div
      // @ts-expect-error -- solid-dnd directive
      use:droppable={droppable}
      classList={{
        "flex flex-col gap-0.5 rounded-md": true,
        "outline outline-1 outline-border-active": droppable.isActiveDroppable,
      }}
    >
      <ContextMenu>
        <ContextMenu.Trigger
          as="div"
          classList={{
            "group/project relative h-8 flex items-center min-w-0 rounded-lg transition-colors": true,
            "bg-v2-background-bg-layer-02 text-text-strong": props.active,
            "hover:bg-v2-background-bg-layer-02/60 focus-within:bg-v2-background-bg-layer-02/60": !props.active,
          }}
        >
          <Show when={props.active}>
            <span class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-icon-strong-base" />
          </Show>
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            class="h-full min-w-0 flex-1 flex items-center gap-2 px-2 text-left outline-none"
            aria-expanded={!props.collapsed}
            aria-current={props.active ? "page" : undefined}
          >
            <Icon name="folder" size="small" class="text-icon-base shrink-0" />
            <span class="flex-1 truncate text-13-medium text-text-base">{displayName(props.group.project)}</span>
            <Show when={props.unseenCount > 0}>
              <span class="min-w-5 rounded-full bg-v2-background-bg-strong px-1.5 text-center text-11-medium text-v2-text-text-muted">
                {props.unseenCount}
              </span>
            </Show>
          </button>
          <div
            classList={{
              "shrink-0 items-center pr-1": true,
              flex: menuOpen(),
              "hidden group-hover/project:flex group-focus-within/project:flex": !menuOpen(),
            }}
          >
            <DropdownMenu open={menuOpen()} onOpenChange={setMenuOpen} gutter={4} placement="bottom-end" flip={false}>
              <DropdownMenu.Trigger
                as={IconButton}
                icon="dot-grid"
                iconSize="small"
                variant="ghost"
                class="!size-7 shrink-0 rounded-md text-icon-base"
                title={language.t("common.moreOptions")}
                aria-label={language.t("common.moreOptions")}
              />
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <ProjectMenuItems
                    onNewChat={props.onNewChat}
                    onEdit={props.onEditProject}
                    onCopyName={props.onCopyProjectName}
                    onCopyPath={props.onCopyProjectPath}
                    onReveal={props.onRevealProject}
                    onToggleWorkspaces={props.onToggleWorkspaces}
                    workspacesEnabled={props.workspacesEnabled}
                    onClearNotifications={props.onClearNotifications}
                    onClose={props.onCloseProject}
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
            <Tooltip value={language.t("command.session.new")} placement="top">
              <IconButton
                icon="speech-bubble"
                iconSize="small"
                variant="ghost"
                class="!size-7 shrink-0 rounded-md text-icon-base"
                onClick={props.onNewChat}
                aria-label={language.t("command.session.new")}
              />
            </Tooltip>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ProjectMenuItems
              context
              onNewChat={props.onNewChat}
              onEdit={props.onEditProject}
              onCopyName={props.onCopyProjectName}
              onCopyPath={props.onCopyProjectPath}
              onReveal={props.onRevealProject}
              onToggleWorkspaces={props.onToggleWorkspaces}
              workspacesEnabled={props.workspacesEnabled}
              onClearNotifications={props.onClearNotifications}
              onClose={props.onCloseProject}
            />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>

      <Show when={!props.collapsed}>
        <For each={props.drafts}>
          {(draft) => (
            <DraftItem
              draft={draft}
              active={draft.draftID === props.activeDraftID}
              onSelect={() => props.onSelectDraft(draft)}
              onClose={() => props.onCloseDraft(draft)}
            />
          )}
        </For>

        <Show
          when={!empty()}
          fallback={
            <div class="pl-8 pr-2 py-1 text-12-regular text-text-weaker">{language.t("sidebarLayout.noSessions")}</div>
          }
        >
          <For each={shown()}>
            {(entry) => (
              <SessionItem
                entry={entry}
                indent
                active={entry.session.id === props.activeSessionID}
                pinned={props.isPinned(entry)}
                unread={props.isUnread(entry)}
                working={() => props.sessionWorking(entry)}
                onSelect={() => props.onSelect(entry)}
                onRename={(title) => props.onRename(entry, title)}
                onMarkUnread={() => props.onMarkUnread(entry)}
                onTogglePin={() => props.onTogglePin(entry)}
                onArchive={props.canArchive ? () => props.onArchive(entry) : undefined}
                onDelete={() => props.onDelete(entry)}
                onCopyTitle={() => props.onCopySessionTitle(entry)}
                onCopyID={() => props.onCopySessionID(entry)}
                onCopyProject={props.onCopySessionProject}
              />
            )}
          </For>
        </Show>

        <Show when={hidden() > 0}>
          <button
            type="button"
            onClick={props.onExpandSessions}
            class="pl-8 pr-2 py-1 text-left text-12-regular text-text-weak hover:text-text-base"
          >
            {language.t("sidebarLayout.showMore")}
          </button>
        </Show>
      </Show>
    </div>
  )
}

export function Sidebar() {
  const language = useLanguage()
  const layout = useLayout()
  const server = useServer()
  const global = useGlobal()
  const platform = usePlatform()
  const notification = useNotification()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const tabs = useTabs()
  const dialog = useDialog()
  const home = createHomeController()
  const pickDirectory = useDirectoryPicker()
  const showSettings = useSettingsDialog()
  const showServers = useSettingsDialog("servers")

  const [pinned, setPinned] = persisted(Persist.window("sidebar-layout.pinned"), createStore<string[]>([]))
  const [unread, setUnread] = persisted(Persist.window("sidebar-layout.unread"), createStore<string[]>([]))
  const [collapsed, setCollapsed] = persisted(Persist.window("sidebar-layout.collapsed"), createStore<string[]>([]))
  const [expandedSessions, setExpandedSessions] = createSignal<string[]>([])
  const [searching, setSearching] = createSignal(false)
  const [filter, setFilter] = createSignal("")
  const [protocol] = createResource(() => serverSDK().protocol)
  const route = createMemo(() => layout.route())
  const activeSessionID = createMemo(() => {
    const value = route()
    return value.type === "session" ? value.sessionId : undefined
  })
  const activeDraftID = createMemo(() => {
    const value = route()
    return value.type === "draft" ? value.draftID : undefined
  })
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

  const filtered = createMemo(() => {
    const needle = filter().trim().toLowerCase()
    if (!needle) return groups()
    return groups().map((group) => ({
      project: group.project,
      sessions: group.sessions.filter((entry) => (entry.session.title ?? "").toLowerCase().includes(needle)),
    }))
  })

  const projectNameFor = (entry: SidebarSession) => {
    const owner = groups().find((group) => group.sessions.some((item) => item.session.id === entry.session.id))
    return owner ? displayName(owner.project) : entry.directory
  }

  const split = createMemo(() => splitPinned(filtered(), [...pinned]))

  const activeProjectWorktree = createMemo(() => {
    const sessionID = activeSessionID()
    if (sessionID) {
      const current = activeSession()
      if (current) {
        const key = pathKey(current.directory)
        const project = layout.projects
          .list()
          .find((item) => pathKey(item.worktree) === key || item.sandboxes?.some((sandbox) => pathKey(sandbox) === key))
        if (project) return project.worktree
      }
      return groups().find((group) => group.sessions.some((entry) => entry.session.id === sessionID))?.project.worktree
    }

    const draftID = activeDraftID()
    if (!draftID) return undefined
    const draft = tabs.store.find((tab) => tab.type === "draft" && tab.draftID === draftID)
    if (!draft || draft.type !== "draft") return undefined
    const directory = draft.worktree ?? draft.directory
    const key = pathKey(directory)
    return layout.projects
      .list()
      .find(
        (project) =>
          pathKey(project.worktree) === key || project.sandboxes?.some((sandbox) => pathKey(sandbox) === key),
      )?.worktree
  })
  const sidebarWidth = createMemo(() => layout.sidebar.width())
  const sidebarWidthMax = () =>
    typeof window === "undefined" ? 560 : Math.max(SIDEBAR_WIDTH_MIN, window.innerWidth * 0.4)

  const select = (entry: SidebarSession) => {
    const key = sessionPinKey(entry)
    if (unread.includes(key)) setUnread((items) => items.filter((item) => item !== key))
    const tab = tabs.addSessionTab({ server: entry.server, sessionId: entry.session.id })
    tabs.select(tab)
  }

  const toggle = (entry: SidebarSession) => setPinned(togglePin([...pinned], sessionPinKey(entry)))
  const isPinned = (entry: SidebarSession) => pinned.includes(sessionPinKey(entry))
  const isUnread = (entry: SidebarSession) => unread.includes(sessionPinKey(entry))
  const sessionWorking = (entry: SidebarSession) =>
    serverSync().session.data.session_working(entry.session.id)
  const markUnread = (entry: SidebarSession) => {
    const key = sessionPinKey(entry)
    if (!unread.includes(key)) setUnread((items) => [...items, key])
  }

  const copy = (value: string) => {
    void navigator.clipboard
      .writeText(value)
      .then(() => showToast({ variant: "success", title: language.t("sidebarLayout.copied") }))
      .catch((error) => {
        showToast({ title: language.t("common.requestFailed"), description: errorMessage(error, "") })
      })
  }

  const renameSession = async (entry: SidebarSession, title: string) => {
    const [, setStore] = serverSync().child(entry.directory, { bootstrap: true })
    const previous = entry.session.title
    setStore("session", (session) => session.id === entry.session.id, "title", title)
    return serverSDK()
      .api.session.rename({ sessionID: entry.session.id, title })
      .then(() => true)
      .catch((error) => {
        setStore("session", (session) => session.id === entry.session.id, "title", previous)
        showToast({ title: language.t("common.requestFailed"), description: errorMessage(error, "") })
        return false
      })
  }

  const archiveSession = async (entry: SidebarSession) => {
    if ((await serverSDK().protocol) !== "v1") return
    const [, setStore] = serverSync().child(entry.directory, { bootstrap: true })
    await serverSDK()
      .client.session.update({
        sessionID: entry.session.id,
        directory: entry.directory,
        time: { archived: Date.now() },
      })
      .then(() => {
        setStore(
          produce((draft) => {
            draft.session = draft.session.filter((session) => session.id !== entry.session.id)
          }),
        )
        tabs.removeSessionTab({ server: entry.server, sessionId: entry.session.id })
      })
      .catch((error) => {
        showToast({ title: language.t("common.requestFailed"), description: errorMessage(error, "") })
      })
  }

  const deleteSession = async (entry: SidebarSession) => {
    const [store, setStore] = serverSync().child(entry.directory, { bootstrap: true })
    const removed = sessionTreeIDs(store.session ?? [], entry.session.id)
    const deleted = await serverSDK()
      .api.session.remove({ sessionID: entry.session.id })
      .then(() => true)
      .catch((error) => {
        showToast({ title: language.t("session.delete.failed.title"), description: errorMessage(error, "") })
        return false
      })
    if (!deleted) return false
    setStore(
      produce((draft) => {
        draft.session = draft.session.filter((session) => !removed.includes(session.id))
      }),
    )
    tabs.removeSessions({ directory: entry.directory, server: entry.server, sessionIDs: removed })
    return true
  }

  const confirmDelete = (entry: SidebarSession) => {
    void dialog.show(() => (
      <DialogV2 fit>
        <DialogHeader hideClose>
          <DialogTitleGroup
            title={language.t("session.delete.title")}
            description={language.t("session.delete.confirm", {
              name: entry.session.title || language.t("command.session.new"),
            })}
          />
        </DialogHeader>
        <DialogFooter>
          <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2
            variant="danger"
            onClick={() => {
              void deleteSession(entry).then((deleted) => {
                if (deleted) dialog.close()
              })
            }}
          >
            {language.t("session.delete.button")}
          </ButtonV2>
        </DialogFooter>
      </DialogV2>
    ))
  }

  // A new chat starts in the project the user is currently looking at, falling back to the first
  // one in the list. It can be dragged into another project afterwards.
  const currentProject = () => {
    const active = activeProjectWorktree()
    if (active) return layout.projects.list().find((project) => project.worktree === active)
    return layout.projects.list()[0]
  }

  const newChat = (project = currentProject()) => {
    if (!project) return
    void tabs.newDraft({ server: server.key, directory: project.worktree, worktree: project.worktree })
  }

  const createProjectSession = async (directory: string) => {
    layout.projects.open(directory)
    const created = await serverSDK()
      .api.session.create({ location: { directory } })
      .then(normalizeSessionInfo)
      .catch((error) => {
        showToast({
          title: language.t("prompt.toast.sessionCreateFailed.title"),
          description: errorMessage(error, language.t("common.requestFailed")),
        })
        return undefined
      })
    if (!created) return

    serverSync().session.remember(created)
    // Fetch sessions lazily (no bootstrap:true) so the new tab can render
    // immediately instead of waiting for a full provider/path/agent bootstrap.
    serverSync().child(directory)[1]("session", (sessions) =>
      sessions.some((session) => session.id === created.id) ? sessions : [...sessions, created],
    )
    const tab = tabs.addSessionTab({ server: server.key, sessionId: created.id })
    tabs.select(tab)
  }

  const chooseProjectFolder = () => {
    const conn = server.current
    if (!conn) return
    dialog.close()
    queueMicrotask(() =>
      pickDirectory({
        server: conn,
        title: language.t("sidebarLayout.addProject"),
        multiple: false,
        onSelect: (result) => {
          if (!result) return
          const directory = Array.isArray(result) ? result[0] : result
          if (!directory) return
          // Kick off project registration without blocking: register first,
          // then create the session; do not chain via .then(...) which defers
          // the session creation until file.list/initGit completes.
          void Promise.resolve(home.project.add(conn, [directory])).then(() => createProjectSession(directory))
        },
      }),
    )
  }

  const addProject = () => {
    void dialog.show(() => (
      <ProjectStartDialog
        recent={layout.projects.recentlyClosed()}
        onChooseFolder={chooseProjectFolder}
        onReopen={(project) => {
          dialog.close()
          void createProjectSession(project.worktree)
        }}
        onManageServers={() => {
          dialog.close()
          queueMicrotask(showServers)
        }}
      />
    ))
  }

  const editProject = (project: LocalProject) => {
    const conn = server.current
    if (!conn) return
    void import("@/components/dialog-edit-project-v2").then(({ DialogEditProjectV2 }) => {
      void dialog.show(() => <DialogEditProjectV2 server={conn} project={project} />)
    })
  }

  const projectUnseenCount = (project: LocalProject) => {
    const state = notification.ensureServerState(server.key)
    return [project.worktree, ...(project.sandboxes ?? [])].reduce(
      (total, directory) => total + state.project.unseenCount(directory),
      0,
    )
  }

  const clearProjectNotifications = (project: LocalProject) => {
    const state = notification.ensureServerState(server.key)
    ;[project.worktree, ...(project.sandboxes ?? [])]
      .filter((directory) => state.project.unseenCount(directory) > 0)
      .forEach((directory) => state.project.markViewed(directory))
  }

  const revealProject = (project: LocalProject) => {
    if (!platform.revealPath) return
    void platform
      .revealPath(project.worktree)
      .catch((error) => showToast({ title: language.t("common.requestFailed"), description: errorMessage(error, "") }))
  }

  const closeDraft = (draft: DraftTab) => {
    const index = tabs.store.findIndex((item) => item.type === "draft" && item.draftID === draft.draftID)
    if (index !== -1) tabs.closeTab(index)
  }

  const onDragEnd: DragEventHandler = ({ draggable, droppable }) => {
    if (!draggable || !droppable) return
    const tab = tabs.store.find((item) => item.type === "draft" && item.draftID === String(draggable.id))
    const move = moveDraftTarget(tab, String(droppable.id))
    if (!move) return
    tabs.updateDraft(move.draftID, { directory: move.directory, worktree: move.worktree })
  }

  return (
    <div
      data-component="sidebar-layout-sidebar"
      class="relative h-full shrink-0 flex flex-col bg-v2-background-bg-layer-01 border-r border-border-weaker-base min-h-0"
      style={{ width: `${sidebarWidth()}px` }}
    >
      <div class="shrink-0 h-12 px-3 flex items-center gap-1">
        <Tooltip placement="bottom" value={language.t("sidebarLayout.toggle")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!size-8 shrink-0"
            onClick={() => layout.sidebar.toggle()}
            aria-label={language.t("sidebarLayout.toggle")}
            aria-expanded={layout.sidebar.opened()}
            icon={<Icon name="layout-left" size="small" />}
          />
        </Tooltip>
        <div class="flex-1" />
        <Tooltip placement="bottom" value={language.t("sidebarLayout.search")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!size-8 shrink-0"
            icon={<Icon name="magnifying-glass" size="small" />}
            onClick={() => {
              const next = !searching()
              setSearching(next)
              if (!next) setFilter("")
            }}
            aria-label={language.t("sidebarLayout.search")}
          />
        </Tooltip>
      </div>

      <Show when={searching()}>
        <div class="shrink-0 px-4 pb-2">
          <input
            autofocus
            value={filter()}
            onInput={(event) => setFilter(event.currentTarget.value)}
            placeholder={language.t("sidebarLayout.search")}
            class="w-full rounded-md bg-v2-background-bg-layer-02 px-2 py-1.5 text-13-regular text-text-strong outline-none"
          />
        </div>
      </Show>

      <div class="shrink-0 px-2 pb-3">
        <button
          type="button"
          onClick={() => newChat()}
          class="w-full h-9 flex items-center gap-2 rounded-lg px-2 text-14-regular text-text-base hover:bg-v2-background-bg-layer-02/60 hover:text-text-strong"
        >
          <Icon name="speech-bubble" size="small" class="text-icon-base" />
          <span class="flex-1 text-left truncate">{language.t("sidebarLayout.newChat")}</span>
        </button>
      </div>

      <DragDropProvider onDragEnd={onDragEnd}>
        <DragDropSensors />
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-4">
          <Show when={split().pinned.length > 0}>
            <div class="flex flex-col gap-0.5">
              <div class="px-2 py-1 text-12-medium text-text-weak">{language.t("sidebarLayout.pinned")}</div>
              <For each={split().pinned}>
                {(entry) => (
                  <SessionItem
                    entry={entry}
                    active={entry.session.id === activeSessionID()}
                    pinned
                    unread={isUnread(entry)}
                    working={() => sessionWorking(entry)}
                    onSelect={() => select(entry)}
                    onRename={(title) => renameSession(entry, title)}
                    onMarkUnread={() => markUnread(entry)}
                    onTogglePin={() => toggle(entry)}
                    onArchive={protocol() === "v1" ? () => archiveSession(entry) : undefined}
                    onDelete={() => confirmDelete(entry)}
                    onCopyTitle={() => copy(entry.session.title || language.t("sidebarLayout.untitled"))}
                    onCopyID={() => copy(entry.session.id)}
                    onCopyProject={() => copy(projectNameFor(entry))}
                  />
                )}
              </For>
            </div>
          </Show>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1 px-2 py-1 text-12-medium text-text-weak">
              <span class="flex-1">{language.t("sidebarLayout.projects")}</span>
              <Tooltip placement="top" value={language.t("sidebarLayout.addProject")}>
                <IconButton
                  icon="plus"
                  variant="ghost"
                  onClick={addProject}
                  aria-label={language.t("sidebarLayout.addProject")}
                />
              </Tooltip>
            </div>
            <For each={split().projects}>
              {(group) => (
                <ProjectGroup
                  group={group}
                  active={group.project.worktree === activeProjectWorktree()}
                  drafts={draftsForProject([...tabs.store], group.project.worktree)}
                  collapsed={collapsed.includes(group.project.worktree)}
                  sessionsExpanded={expandedSessions().includes(group.project.worktree)}
                  activeSessionID={activeSessionID()}
                  activeDraftID={activeDraftID()}
                  isPinned={isPinned}
                  isUnread={isUnread}
                  sessionWorking={sessionWorking}
                  onToggleCollapsed={() =>
                    setCollapsed((items) =>
                      items.includes(group.project.worktree)
                        ? items.filter((item) => item !== group.project.worktree)
                        : [...items, group.project.worktree],
                    )
                  }
                  onExpandSessions={() => setExpandedSessions([...expandedSessions(), group.project.worktree])}
                  onSelect={select}
                  onSelectDraft={(draft) => tabs.select(draft)}
                  onCloseDraft={closeDraft}
                  onRename={renameSession}
                  onMarkUnread={markUnread}
                  onTogglePin={toggle}
                  onNewChat={() => newChat(group.project)}
                  onEditProject={() => editProject(group.project)}
                  onCopyProjectName={() => copy(displayName(group.project))}
                  onCopyProjectPath={() => copy(group.project.worktree)}
                  onRevealProject={platform.revealPath ? () => revealProject(group.project) : undefined}
                  workspacesEnabled={layout.sidebar.workspaces(group.project.worktree)()}
                  onToggleWorkspaces={
                    group.project.vcs === "git"
                      ? () => layout.sidebar.toggleWorkspaces(group.project.worktree)
                      : undefined
                  }
                  unseenCount={projectUnseenCount(group.project)}
                  onClearNotifications={
                    projectUnseenCount(group.project) > 0 ? () => clearProjectNotifications(group.project) : undefined
                  }
                  onCloseProject={() => layout.projects.close(group.project.worktree)}
                  onCopySessionTitle={(entry) => copy(entry.session.title || language.t("sidebarLayout.untitled"))}
                  onCopySessionID={(entry) => copy(entry.session.id)}
                  onCopySessionProject={() => copy(displayName(group.project))}
                  onArchive={archiveSession}
                  onDelete={confirmDelete}
                  canArchive={protocol() === "v1"}
                />
              )}
            </For>
          </div>
        </div>
      </DragDropProvider>

      <div class="shrink-0 px-2 py-2 border-t border-border-weaker-base">
        <button
          type="button"
          onClick={() => showSettings()}
          class="w-full h-9 flex items-center gap-2 rounded-lg px-2 text-13-regular text-text-base hover:bg-v2-background-bg-layer-02/60 hover:text-text-strong"
        >
          <Icon name="settings-gear" size="small" class="text-icon-base" />
          <span class="flex-1 text-left truncate">{language.t("sidebar.settings")}</span>
        </button>
      </div>
      <ResizeHandle
        direction="horizontal"
        size={sidebarWidth()}
        min={SIDEBAR_WIDTH_MIN}
        max={sidebarWidthMax()}
        onResize={(width) => layout.sidebar.resize(width)}
      />
    </div>
  )
}
