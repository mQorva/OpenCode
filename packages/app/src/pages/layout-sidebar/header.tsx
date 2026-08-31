import { Show } from "solid-js"
import { IconButton, TooltipV2, useLanguage } from "./upstream"

/** The compact fallback control when the project and chat sidebar is collapsed. */
export function ContentHeader(props: { sidebarOpened: boolean; onToggleSidebar: () => void }) {
  const language = useLanguage()

  return (
    <div data-component="sidebar-layout-header" class="shrink-0 h-11 px-2 flex items-center gap-1">
      <Show when={!props.sidebarOpened}>
        <TooltipV2 placement="bottom" value={language.t("sidebarLayout.toggle")}>
          <IconButton
            icon="sidebar"
            variant="ghost"
            onClick={props.onToggleSidebar}
            aria-label={language.t("sidebarLayout.toggle")}
            aria-expanded={false}
          />
        </TooltipV2>
      </Show>
    </div>
  )
}
