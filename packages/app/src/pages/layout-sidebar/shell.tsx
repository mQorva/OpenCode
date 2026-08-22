import { createEffect, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { Sidebar } from "./sidebar"
import { DebugBar, TabsInfoPopup, Titlebar, ToastRegion, setV2Toast, useLayout, usePlatform } from "./upstream"
import type { TitlebarUpdate } from "./upstream"

/**
 * Sidebar layout shell: window title bar without tabs, a grouped session sidebar on the left,
 * and the regular page content in the middle.
 */
export default function SidebarLayout(props: ParentProps) {
  const platform = usePlatform()
  const layout = useLayout()
  const [state, setState] = createStore({ debugTools: false })

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
      class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
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
          <Sidebar />
        </Show>
        <div class="flex-1 min-h-0 min-w-0 flex flex-col border-t border-border-weaker-base">
          <main class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict">
            <Suspense>{props.children}</Suspense>
          </main>
        </div>
      </div>
      {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}
