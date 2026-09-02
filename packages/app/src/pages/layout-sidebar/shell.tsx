import { createEffect, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { WorkspaceSkeleton } from "@/components/workspace-skeleton"
import { createLayoutCommands } from "../layout-commands"
import { createProjectStartController } from "./project-start"
import { createSidebarData } from "./sidebar-data"
import { Sidebar } from "./sidebar"
import {
  DebugBar,
  TabsInfoPopup,
  Titlebar,
  ToastRegion,
  createHomeController,
  pathKey,
  ServerConnection,
  setV2Toast,
  useCommand,
  useLanguage,
  useLayout,
  usePlatform,
  useTabs,
} from "./upstream"
import type { TitlebarUpdate } from "./upstream"
import "./shell.css"

/**
 * Sidebar layout shell: window title bar without tabs, a grouped session sidebar on the left,
 * and the regular page content in the middle.
 */
export default function SidebarLayout(props: ParentProps) {
  const platform = usePlatform()
  const layout = useLayout()
  const command = useCommand()
  const tabs = useTabs()
  const language = useLanguage()
  const [state, setState] = createStore({ debugTools: false })

  // The tab layout registers these in `pages/layout.tsx`; this layout replaces that shell and has to
  // bring its own, or the app menu entries stay disabled. They belong here rather than in `Sidebar`,
  // which is only mounted while the sidebar is open — registering them there takes the commands down
  // with the sidebar, leaving no way to reopen it and no way to add a project from the menu.
  createLayoutCommands()
  const projectStart = createProjectStartController({ home: createHomeController() })
  const data = createSidebarData()

  const navigateSession = (entry: { session: { id: string }; server: ServerConnection.Key }) => {
    const tab = tabs.addSessionTab({ server: entry.server, sessionId: entry.session.id })
    tabs.select(tab)
  }

  /** Step through the sidebar list, wrapping at both ends; an unknown position starts at the edge. */
  const stepSession = (offset: number) => {
    const entries = data.flat()
    if (entries.length === 0) return
    const route = layout.route()
    const at = route.type === "session" ? entries.findIndex((entry) => entry.session.id === route.sessionId) : -1
    const target = at === -1 ? (offset > 0 ? entries[0] : entries[entries.length - 1]) : entries[(at + offset + entries.length) % entries.length]
    if (target) navigateSession(target)
  }

  /**
   * Projects follow the sidebar's project order. A project is represented by its topmost session,
   * so one without sessions is skipped — there would be nothing to navigate to.
   */
  const stepProject = (offset: number) => {
    const groups = data.ordered().filter((group) => group.sessions.length > 0)
    if (groups.length === 0) return
    const route = layout.route()
    const at =
      route.type === "session"
        ? groups.findIndex((group) => group.sessions.some((entry) => entry.session.id === route.sessionId))
        : -1
    const target =
      at === -1
        ? offset > 0
          ? groups[0]
          : groups[groups.length - 1]
        : groups[(at + offset + groups.length) % groups.length]
    const first = target?.sessions[0]
    if (first) navigateSession(first)
  }



  command.register("sidebar-layout", () => [
    {
      id: "sidebar.toggle",
      title: language.t("command.sidebar.toggle"),
      category: language.t("command.category.view"),
      keybind: "mod+b",
      onSelect: () => layout.sidebar.toggle(),
    },
    {
      id: "session.previous",
      title: language.t("command.session.previous"),
      category: language.t("command.category.session"),
      keybind: "alt+arrowup",
      onSelect: () => stepSession(-1),
    },
    {
      id: "session.next",
      title: language.t("command.session.next"),
      category: language.t("command.category.session"),
      keybind: "alt+arrowdown",
      onSelect: () => stepSession(1),
    },
    {
      id: "project.previous",
      title: language.t("command.project.previous"),
      category: language.t("command.category.project"),
      keybind: "mod+alt+arrowup",
      onSelect: () => stepProject(-1),
    },
    {
      id: "project.next",
      title: language.t("command.project.next"),
      category: language.t("command.category.project"),
      keybind: "mod+alt+arrowdown",
      onSelect: () => stepProject(1),
    },
    {
      id: "project.add",
      title: language.t("sidebarLayout.addProject"),
      category: language.t("command.category.project"),
      keybind: "mod+o",
      onSelect: projectStart.addProject,
    },
  ])

  createEffect(() => setV2Toast(true))

  const update: TitlebarUpdate = {
    version: () => {
      const state = platform.updater?.state()
      if (state?.status !== "ready") return
      return state.version
    },
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      data-slot="sidebar-shell"
      class="relative bg-v2-background-bg-base flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
      style={{
        "padding-top": "env(safe-area-inset-top, 0px)",
        "padding-bottom": "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Titlebar
        update={update}
        sessionTabs={false}
        distributedMenu
        debugTools={
          import.meta.env.DEV
            ? { visible: state.debugTools, toggle: () => setState("debugTools", (value) => !value) }
            : undefined
        }
      />
      <div class="flex-1 min-h-0 min-w-0 flex flex-row">
        <Show when={layout.sidebar.opened()}>
          <Sidebar data={data} />
        </Show>
        <div class="flex-1 min-h-0 min-w-0 flex flex-col border-t border-border-weaker-base">
          <main
            data-slot="sidebar-workspace"
            class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict"
          >
            <Suspense fallback={<WorkspaceSkeleton />}>{props.children}</Suspense>
          </main>
        </div>
      </div>
      {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}
