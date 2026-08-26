import { createPromptProjectController } from "@/components/prompt-project-selector"
import FileTreeV2 from "@/components/file-tree-v2"
import { getFilename } from "@opencode-ai/core/util/path"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { createMediaQuery } from "@solid-primitives/media"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useFile } from "@/context/file"
import { TerminalPanelV2 } from "@/pages/session/terminal-panel-v2"
import { createSizing } from "@/pages/session/helpers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { createEffect, createMemo, createResource, createSignal, Show } from "solid-js"
import { createNewSessionDraftController } from "./new-session/new-session-draft-controller"
import { NewSessionView } from "./new-session/new-session-view"
import { createNewSessionWorkspaceController } from "./new-session/new-session-workspace-controller"
import { useNewSessionCommands } from "./new-session/use-new-session-commands"

/** The draft-only V2 session page. Submitting promotes the draft into a real session. */
export default function NewSessionPage() {
  const language = useLanguage()
  const layout = useLayout()
  const { view } = useSessionLayout()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const size = createSizing()
  const [workspaceOpen, setWorkspaceOpen] = createSignal(false)
  const workspace = createNewSessionWorkspaceController()
  const projectName = createMemo(() => {
    const directory = workspace.selection.value()
    const current = layout.projects
      .list()
      .find((project) => project.worktree === directory || project.sandboxes?.includes(directory))
    return current?.name || getFilename(directory || "") || language.t("sidebarLayout.project")
  })
  const draft = createNewSessionDraftController({
    worktree: workspace.selection.value,
    resetWorktree: workspace.selection.reset,
  })
  const project = createPromptProjectController({
    controls: draft.project.controls,
    onDone: draft.input.restoreFocus,
  })
  useNewSessionCommands({
    restoreFocus: draft.input.restoreFocus,
    project: {
      empty: project.empty,
      open: () => project.setOpen(true),
    },
  })
  createEffect(() => {
    if (!draft.prompt.ready()) return
    draft.input.restoreFocus()
  })
  const ready = Promise.resolve()
  const [suspendUntilPromptReady] = createResource(
    () => draft.prompt.readyPromise() ?? ready,
    (promise) => promise.then(() => true),
  )

  return (
    <div class="relative size-full overflow-hidden bg-v2-background-bg-base flex flex-col">
      {suspendUntilPromptReady()}
      <header class="h-12 shrink-0 flex items-center gap-1 px-3">
        <Show when={!layout.sidebar.opened()}>
          <TooltipV2 placement="bottom" value={language.t("sidebarLayout.toggle")}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="large"
              class="!size-8 shrink-0"
              onClick={layout.sidebar.toggle}
              aria-label={language.t("sidebarLayout.toggle")}
              aria-expanded={false}
              icon={<Icon name="layout-left" size="small" />}
            />
          </TooltipV2>
        </Show>
        <div class="min-w-0 flex-1 flex items-center gap-2 text-13-regular">
          <span class="max-w-[42%] truncate text-v2-text-text-muted">{projectName()}</span>
          <span class="shrink-0 text-v2-text-text-faint" aria-hidden="true">
            /
          </span>
          <span class="min-w-0 truncate text-14-medium text-v2-text-text-strong">
            {language.t("command.session.new")}
          </span>
        </div>
        <TooltipV2 placement="bottom" value={language.t("command.terminal.toggle")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!size-8 shrink-0"
            state={view().terminal.opened() ? "pressed" : undefined}
            onClick={() => view().terminal.toggle()}
            aria-label={language.t("command.terminal.toggle")}
            aria-expanded={view().terminal.opened()}
            aria-controls="terminal-panel"
            icon={<Icon name="layout-bottom" size="small" />}
          />
        </TooltipV2>
        <Show when={!workspaceOpen()}>
          <TooltipV2 placement="bottom" value={language.t("sidebarLayout.workspace.toggle")}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="large"
              class="!size-8 shrink-0"
              onClick={() => setWorkspaceOpen(true)}
              aria-label={language.t("sidebarLayout.workspace.toggle")}
              aria-expanded={false}
              aria-controls="draft-workspace-panel"
              icon={<Icon name="layout-right" size="small" />}
            />
          </TooltipV2>
        </Show>
      </header>
      <div class="flex-1 min-h-0 flex">
        <div class="flex-1 min-w-0 min-h-0 flex flex-col">
          <NewSessionView input={draft.input} project={project} workspace={workspace} />
        </div>
        <Show when={isDesktop() && workspaceOpen()}>
          <DraftWorkspacePanel onClose={() => setWorkspaceOpen(false)} onResizeStart={size.start} />
        </Show>
      </div>
      <Show when={view().terminal.opened()}>
        <Show when={isDesktop()}>
          <div class="relative h-2 shrink-0" onPointerDown={() => size.start()}>
            <ResizeHandle
              class="!relative !inset-auto !h-full !w-full !transform-none"
              direction="vertical"
              size={layout.terminal.height()}
              min={100}
              max={typeof window === "undefined" ? 600 : window.innerHeight * 0.6}
              collapseThreshold={50}
              onResize={(height) => {
                size.touch()
                layout.terminal.resize(height)
              }}
              onCollapse={() => view().terminal.close()}
            />
          </div>
        </Show>
        <TerminalPanelV2 stacked={isDesktop()} />
      </Show>
    </div>
  )
}

function DraftWorkspacePanel(props: { onClose: () => void; onResizeStart: () => void }) {
  const file = useFile()
  const language = useLanguage()
  const layout = useLayout()
  const empty = createMemo(() => {
    const state = file.tree.state("")
    return !!state?.loaded && file.tree.children("").length === 0
  })

  return (
    <aside
      id="draft-workspace-panel"
      class="relative -mt-12 h-[calc(100%+3rem)] min-h-0 shrink-0 overflow-hidden border-l border-t border-border-weaker-base bg-v2-background-bg-base flex flex-col"
      style={{ width: `${Math.max(240, layout.fileTree.width())}px` }}
      aria-label={language.t("sidebarLayout.workspace.toggle")}
    >
      <div class="h-12 shrink-0 flex items-center justify-between gap-2 px-4">
        <div class="min-w-0 flex items-center gap-2 text-13-medium text-v2-text-text-strong">
          <Icon name="file-tree" size="small" />
          <span class="truncate">{language.t("session.files.all")}</span>
        </div>
        <TooltipV2 placement="bottom" value={language.t("sidebarLayout.workspace.toggle")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!size-8 shrink-0"
            onClick={props.onClose}
            aria-label={language.t("sidebarLayout.workspace.toggle")}
            aria-expanded={true}
            aria-controls="draft-workspace-panel"
            icon={<Icon name="layout-right" size="small" />}
          />
        </TooltipV2>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">
        <Show
          when={!empty()}
          fallback={
            <div class="px-3 py-3 text-12-regular text-v2-text-text-faint">{language.t("session.files.empty")}</div>
          }
        >
          <FileTreeV2 draggable={false} />
        </Show>
      </div>
      <div onPointerDown={props.onResizeStart}>
        <ResizeHandle
          direction="horizontal"
          edge="start"
          size={layout.fileTree.width()}
          min={240}
          max={480}
          onResize={(width) => layout.fileTree.resize(width)}
          onCollapse={props.onClose}
        />
      </div>
    </aside>
  )
}
