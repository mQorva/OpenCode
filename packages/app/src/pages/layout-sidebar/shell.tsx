import { createEffect, createSignal, on, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { WorkspaceSkeleton } from "@/components/workspace-skeleton"
import { createLayoutCommands } from "../layout-commands"
import { createProjectStartController } from "./project-start"
import { stepIndex, stepIndexSkipping } from "./sessions"
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

  // `navigate()` reaches the router asynchronously, so `layout.route()` still reports the previous
  // session right after a jump. Two quick presses would then both start from the same spot and land
  // on the same target. The cursor holds the position we last sent the user to and hands over to the
  // route as soon as that catches up — or whenever the user navigates by any other means.
  const [cursor, setCursor] = createSignal<string>()
  createEffect(
    on(
      () => layout.route(),
      (route) => setCursor(route.type === "session" ? route.sessionId : undefined),
      { defer: true },
    ),
  )
  const currentSessionID = () => {
    const route = layout.route()
    return cursor() ?? (route.type === "session" ? route.sessionId : undefined)
  }

  const navigateSession = (entry: { session: { id: string }; server: ServerConnection.Key }) => {
    setCursor(entry.session.id)
    const tab = tabs.addSessionTab({ server: entry.server, sessionId: entry.session.id })
    tabs.select(tab)
  }

  /** Step through the sidebar list, wrapping at both ends; an unknown position starts at the edge. */
  const stepSession = (offset: number) => {
    const entries = data.flat()
    const active = currentSessionID()
    const at = active ? entries.findIndex((entry) => entry.session.id === active) : -1
    const target = entries[stepIndex(entries.length, at, offset)]
    if (target) navigateSession(target)
  }

  /**
   * Projects follow the sidebar's project order. A project is represented by its topmost session,
   * so one without sessions is skipped — there would be nothing to navigate to.
   */
  const stepProject = (offset: number) => {
    // Every project stays in the list, even while its sessions are still loading — dropping them
    // would shift the positions of the rest between two keypresses. Empty ones are stepped over.
    const groups = data.ordered()
    const active = currentSessionID()
    const at = active ? groups.findIndex((group) => group.sessions.some((entry) => entry.session.id === active)) : -1
    const target = groups[stepIndexSkipping(groups.length, at, offset, (index) => !!groups[index]?.sessions.length)]
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
