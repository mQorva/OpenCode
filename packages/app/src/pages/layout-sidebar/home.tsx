import { useNavigate } from "@solidjs/router"
import { createEffect, Show } from "solid-js"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { useLanguage, useLayout, useSettings, useTabs } from "./upstream"
import { NEW_SESSION_SIDEBAR_CONTENT_WIDTH } from "@/pages/session/new-session-layout"
import { tabHref } from "@/context/tabs"

/**
 * The sidebar layout has no separate start page: the sidebar already lists every project and
 * session, and it carries "open project". Landing on "/" therefore goes straight back into the
 * most recent session.
 *
 * With nothing to return to, this points at the sidebar rather than opening a chat: a chat needs
 * a project, and picking one is the user's choice, not something to guess at.
 */
export function SidebarHome() {
  const language = useLanguage()
  const layout = useLayout()
  const tabs = useTabs()

  // Without a project the user has to open one; with projects listed, the next step is starting a
  // session from one of them.
  const hasProjects = () => layout.projects.list().length > 0
  const navigate = useNavigate()

  createEffect(() => {
    if (!tabs.ready()) return

    const recent = tabs.store.findLast((tab) => tab.type === "session") ?? tabs.store[0]
    if (!recent) return
    tabs.select(recent)
    navigate(tabHref(recent), { replace: true })
  })

  return (
    <Show when={tabs.store.length === 0}>
      {/* The same empty stage a new session opens on, minus the composer — there is no session to
          type into yet. The hint below it says what to do next. */}
      <div data-component="sidebar-home-empty" class="relative flex-1 min-h-0 w-full overflow-hidden">
        <div class="pointer-events-none absolute inset-x-0 top-[25.375%] hidden justify-center md:flex">
          <div class={NEW_SESSION_SIDEBAR_CONTENT_WIDTH}>
            <WordmarkV2 class="h-auto w-full text-v2-background-bg-inverse" />
          </div>
        </div>
        <div class="h-full flex flex-col items-center justify-end gap-2 px-6 pb-16 text-center">
          <div class="text-[13px] font-[530] leading-4 tracking-[-0.04px] text-text-base">
            {hasProjects()
              ? language.t("sidebarLayout.empty.noSession.title")
              : language.t("sidebarLayout.empty.title")}
          </div>
          <div class="text-[13px] font-[440] leading-4 tracking-[-0.04px] text-text-weak">
            {hasProjects()
              ? language.t("sidebarLayout.empty.noSession.description")
              : language.t("sidebarLayout.empty.description")}
          </div>
        </div>
      </div>
    </Show>
  )
}

/**
 * Route seam for "/". Keeps the upstream home page for the tab layout and swaps in the sidebar
 * behaviour only when the setting is on.
 */
export function createHomeRoute(upstreamHome: () => import("solid-js").JSX.Element) {
  return () => {
    const settings = useSettings()
    return (
      <Show when={settings.general.layoutMode() === "sidebar"} fallback={upstreamHome()}>
        <SidebarHome />
      </Show>
    )
  }
}
