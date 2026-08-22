import { useNavigate } from "@solidjs/router"
import { createEffect, Show } from "solid-js"
import { useLanguage, useLayout, useServer, useSettings, useTabs } from "./upstream"
import { tabHref } from "@/context/tabs"

/**
 * The sidebar layout has no separate start page: the sidebar already lists every project and
 * session, and it carries "open project". Landing on "/" therefore goes straight back into the
 * work — the most recent session, or a fresh draft in the first project.
 *
 * Only when there is no project at all does anything render here, and then just a pointer at the
 * sidebar.
 */
export function SidebarHome() {
  const language = useLanguage()
  const layout = useLayout()
  const server = useServer()
  const tabs = useTabs()
  const navigate = useNavigate()

  // Guarded so a repeat visit to "/" cannot spawn a second draft while the first is still
  // being created and navigated to.
  let creating = false

  createEffect(() => {
    if (!tabs.ready()) return

    const recent = tabs.store.findLast((tab) => tab.type === "session") ?? tabs.store[0]
    if (recent) {
      tabs.select(recent)
      navigate(tabHref(recent), { replace: true })
      return
    }

    const project = layout.projects.list()[0]
    if (!project || creating) return
    creating = true
    void tabs.newDraft({ server: server.key, directory: project.worktree, worktree: project.worktree })
  })

  return (
    <Show when={layout.projects.list().length === 0}>
      <div class="flex-1 w-full min-h-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div class="text-14-medium text-text-base">{language.t("sidebarLayout.empty.title")}</div>
        <div class="text-13-regular text-text-weak">{language.t("sidebarLayout.empty.description")}</div>
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
