import { For, Show } from "solid-js"
import { DialogHeader, DialogTitleGroup, DialogV2, Icon, displayName, useLanguage, type LocalProject } from "./upstream"

export function ProjectStartDialog(props: {
  recent: LocalProject[]
  onChooseFolder: () => void
  onReopen: (project: LocalProject) => void
  onManageServers: () => void
}) {
  const language = useLanguage()

  return (
    <DialogV2 fit>
      <DialogHeader>
        <DialogTitleGroup
          title={language.t("sidebarLayout.projectStart.title")}
          description={language.t("sidebarLayout.projectStart.description")}
        />
      </DialogHeader>
      <div class="flex w-[440px] max-w-full flex-col gap-2 px-6 pb-6">
        <button
          type="button"
          class="flex min-h-16 items-center gap-3 rounded-lg border border-border-weaker-base bg-v2-background-bg-base px-4 py-3 text-left hover:bg-v2-overlay-simple-overlay-hover"
          onClick={props.onChooseFolder}
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-v2-background-bg-strong">
            <Icon name="folder" size="small" class="text-v2-icon-icon-muted" />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-strong">
              {language.t("sidebarLayout.projectStart.folder")}
            </span>
            <span class="block text-[12px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
              {language.t("sidebarLayout.projectStart.folderDescription")}
            </span>
          </span>
        </button>

        <button
          type="button"
          class="flex min-h-16 items-center gap-3 rounded-lg border border-border-weaker-base bg-v2-background-bg-base px-4 py-3 text-left hover:bg-v2-overlay-simple-overlay-hover"
          onClick={props.onManageServers}
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-v2-background-bg-strong">
            <Icon name="server" size="small" class="text-v2-icon-icon-muted" />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-strong">
              {language.t("sidebarLayout.projectStart.server")}
            </span>
            <span class="block text-[12px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
              {language.t("sidebarLayout.projectStart.serverDescription")}
            </span>
          </span>
        </button>

        <Show when={props.recent.length > 0}>
          <div class="pt-3 text-[11px] font-[530] leading-4 tracking-[0.05px] text-v2-text-text-muted">
            {language.t("sidebarLayout.projectStart.recent")}
          </div>
          <div class="overflow-hidden rounded-lg border border-border-weaker-base">
            <For each={props.recent}>
              {(project) => (
                <button
                  type="button"
                  class="flex h-11 w-full items-center gap-3 border-b border-border-weaker-base px-3 text-left last:border-b-0 hover:bg-v2-overlay-simple-overlay-hover"
                  onClick={() => props.onReopen(project)}
                >
                  <Icon name="folder" size="small" class="shrink-0 text-v2-icon-icon-muted" />
                  <span class="min-w-0 flex-1 truncate text-[13px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-strong">
                    {displayName(project)}
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </DialogV2>
  )
}
