import type { ProductTaskInfo } from "@opencode-ai/sdk/v2/types"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Tag as TagV2 } from "@opencode-ai/ui/v2/badge-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createMemo, For, Show, type Accessor } from "solid-js"
import { DialogProductTask } from "@/components/dialog-product-task"
import type { LocalProject } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { errorMessage, displayName } from "@/pages/layout/helpers"
import type { HomeProjectTasksController } from "./home-project-tasks-controller"

const statusLabel = (language: ReturnType<typeof useLanguage>, status: ProductTaskInfo["status"]) => {
  if (status === "active") return language.t("home.tasks.status.active")
  if (status === "waiting") return language.t("home.tasks.status.waiting")
  if (status === "review") return language.t("home.tasks.status.review")
  if (status === "completed") return language.t("home.tasks.status.completed")
  if (status === "cancelled") return language.t("home.tasks.status.cancelled")
  return language.t("home.tasks.status.ready")
}

export function HomeProjectTasks(props: {
  tasks: HomeProjectTasksController
  onShowSessions: () => void
}) {
  return <HomeProjectTasksView {...props} />
}

type HomeProjectTasksViewProps = {
  tasks: HomeProjectTasksController
  onShowSessions: () => void
}

function HomeProjectTasksView(props: HomeProjectTasksViewProps) {
  const language = props.tasks.copy.language
  const dialog = useDialog()
  const project = props.tasks.project as Accessor<LocalProject | undefined>
  const active = createMemo(() => props.tasks.data.list().filter((task) => !task.archivedAt))
  const archived = createMemo(() => props.tasks.data.list().filter((task) => !!task.archivedAt))

  const openCreate = () => {
    const target = props.tasks.target()
    if (!target) return
    void dialog.show(() => <DialogProductTask onSave={(input) => props.tasks.task.create(target, input)} />)
  }
  const openEdit = (task: ProductTaskInfo) => {
    const target = props.tasks.target()
    if (!target) return
    void dialog.show(() => (
      <DialogProductTask task={task} onSave={(input) => props.tasks.task.update(target, task, input)} />
    ))
  }
  const withTarget = (action: (target: NonNullable<ReturnType<typeof props.tasks.target>>) => void) => {
    const target = props.tasks.target()
    if (target) action(target)
  }
  const error = () =>
    props.tasks.data.error()
      ? errorMessage(props.tasks.data.error(), language.t("common.requestFailed"))
      : undefined

  return (
    <section class="flex min-h-full min-w-0 flex-1 flex-col px-3 pb-16 pt-6 lg:px-0 lg:pt-12">
      <header class="flex min-w-0 items-start justify-between gap-4 pb-6">
        <div class="min-w-0">
          <div class="mb-1 text-[12px] font-[440] leading-4 text-v2-text-text-muted">
            {project() ? displayName(project()!) : language.t("home.tasks.project")}
          </div>
          <h1 class="truncate text-[20px] font-[600] leading-7 tracking-[-0.2px] text-v2-text-text-base">
            {language.t("home.tasks.title")}
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <ButtonV2 variant="ghost-muted" size="normal" onClick={props.onShowSessions}>
            {language.t("home.tasks.viewSessions")}
          </ButtonV2>
          <ButtonV2 variant="contrast" size="normal" icon="plus" onClick={openCreate}>
            {language.t("home.tasks.create.action")}
          </ButtonV2>
        </div>
      </header>

      <Show when={!props.tasks.data.loading}>
        <Show
          when={!error()}
          fallback={
            <div class="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[10px] bg-v2-background-bg-layer-01 px-6 text-center">
              <div class="text-[13px] font-[530] text-v2-text-text-base">{language.t("home.tasks.error")}</div>
              <div class="max-w-[420px] text-[13px] leading-5 text-v2-text-text-muted">{error()}</div>
              <ButtonV2 variant="neutral" size="normal" onClick={() => void props.tasks.data.reload()}>
                {language.t("home.tasks.retry")}
              </ButtonV2>
            </div>
          }
        >
          <Show
            when={active().length > 0 || archived().length > 0}
            fallback={
              <div class="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[10px] bg-v2-background-bg-layer-01 px-6 text-center">
                <IconV2 name="checklist" class="text-v2-icon-icon-muted" />
                <div class="text-[13px] font-[530] text-v2-text-text-base">{language.t("home.tasks.empty")}</div>
                <div class="max-w-[420px] text-[13px] leading-5 text-v2-text-text-muted">
                  {language.t("home.tasks.empty.description")}
                </div>
                <div class="flex items-center gap-2">
                  <ButtonV2
                    variant="ghost-muted"
                    size="normal"
                    onClick={props.tasks.data.toggleArchived}
                  >
                    {language.t("home.tasks.showArchived")}
                  </ButtonV2>
                  <ButtonV2 variant="neutral" size="normal" icon="plus" onClick={openCreate}>
                    {language.t("home.tasks.create.action")}
                  </ButtonV2>
                </div>
              </div>
            }
          >
            <div class="flex min-w-0 flex-col gap-6">
              <TaskSection
                title={language.t("home.tasks.active")}
                tasks={active()}
                onEdit={openEdit}
                onArchive={(task) => withTarget((target) => void props.tasks.task.archive(target, task))}
                onRestore={(task) => withTarget((target) => void props.tasks.task.restore(target, task))}
                onReopen={(task) => withTarget((target) => void props.tasks.task.reopen(target, task))}
                onOpenWorkspace={(task) => withTarget((target) => void props.tasks.task.openWorkspace(target, task))}
                language={language}
              />
              <Show when={props.tasks.data.includeArchived() || active().length > 0}>
                <div class="flex items-center justify-between">
                  <div class="text-[13px] font-[530] text-v2-text-text-muted">
                    {language.t("home.tasks.archived")}
                  </div>
                  <ButtonV2
                    variant="ghost-muted"
                    size="small"
                    onClick={props.tasks.data.toggleArchived}
                  >
                    {props.tasks.data.includeArchived()
                      ? language.t("home.tasks.hideArchived")
                      : language.t("home.tasks.showArchived")}
                  </ButtonV2>
                </div>
                <Show when={props.tasks.data.includeArchived()}>
                  <TaskSection
                    title=""
                    tasks={archived()}
                    onEdit={openEdit}
                    onArchive={(task) => withTarget((target) => void props.tasks.task.archive(target, task))}
                    onRestore={(task) => withTarget((target) => void props.tasks.task.restore(target, task))}
                    onReopen={(task) => withTarget((target) => void props.tasks.task.reopen(target, task))}
                    onOpenWorkspace={(task) => withTarget((target) => void props.tasks.task.openWorkspace(target, task))}
                    language={language}
                  />
                </Show>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={props.tasks.data.loading}>
        <div class="flex min-w-0 flex-col gap-2" aria-busy="true" aria-label={language.t("common.loading")}>
          <For each={[0, 1, 2, 3]}>{() => <div class="h-16 rounded-[8px] bg-v2-background-bg-layer-01" />}</For>
        </div>
      </Show>
    </section>
  )
}

function TaskSection(props: {
  title: string
  tasks: ProductTaskInfo[]
  language: ReturnType<typeof useLanguage>
  onEdit: (task: ProductTaskInfo) => void
  onArchive: (task: ProductTaskInfo) => void
  onRestore: (task: ProductTaskInfo) => void
  onReopen: (task: ProductTaskInfo) => void
  onOpenWorkspace: (task: ProductTaskInfo) => void
}) {
  return (
    <Show when={props.tasks.length > 0}>
      <section class="flex min-w-0 flex-col gap-2" aria-label={props.title || undefined}>
        <Show when={props.title}>
          <div class="px-1 text-[13px] font-[530] text-v2-text-text-muted">{props.title}</div>
        </Show>
        <div class="flex min-w-0 flex-col gap-1">
          <For each={props.tasks}>
            {(task) => <TaskRow {...props} task={task} />}
          </For>
        </div>
      </section>
    </Show>
  )
}

function TaskRow(
  props: {
    task: ProductTaskInfo
    language: ReturnType<typeof useLanguage>
    onEdit: (task: ProductTaskInfo) => void
    onArchive: (task: ProductTaskInfo) => void
    onRestore: (task: ProductTaskInfo) => void
    onReopen: (task: ProductTaskInfo) => void
    onOpenWorkspace: (task: ProductTaskInfo) => void
  },
) {
  const archived = () => !!props.task.archivedAt
  const reopenable = () => props.task.status === "completed" || props.task.status === "cancelled"
  return (
    <article class="flex min-w-0 flex-col gap-2 rounded-[8px] px-3 py-3 transition-[background-color] hover:bg-v2-overlay-simple-overlay-hover">
      <div class="flex min-w-0 items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <h2 class="min-w-0 flex-1 truncate text-[14px] font-[530] leading-5 text-v2-text-text-base">
              {props.task.title}
            </h2>
            <TagV2 class="shrink-0">{statusLabel(props.language, props.task.status)}</TagV2>
          </div>
          <Show when={props.task.description}>
            <p class="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-v2-text-text-muted">
              {props.task.description}
            </p>
          </Show>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Show when={!archived()}>
            <ButtonV2 variant="ghost-muted" size="small" onClick={() => props.onOpenWorkspace(props.task)}>
              {props.language.t("home.tasks.workspace")}
            </ButtonV2>
          </Show>
          <ButtonV2 variant="ghost-muted" size="small" onClick={() => props.onEdit(props.task)}>
            {props.language.t("common.edit")}
          </ButtonV2>
          <Show when={archived()} fallback={
            <ButtonV2 variant="ghost-muted" size="small" onClick={() => props.onArchive(props.task)}>
              {props.language.t("common.archive")}
            </ButtonV2>
          }>
            <ButtonV2 variant="ghost-muted" size="small" onClick={() => props.onRestore(props.task)}>
              {props.language.t("home.tasks.restore")}
            </ButtonV2>
          </Show>
        </div>
      </div>
      <Show when={reopenable()}>
        <div class="flex items-center">
          <ButtonV2 variant="ghost-muted" size="small" onClick={() => props.onReopen(props.task)}>
            {props.language.t("home.tasks.reopen")}
          </ButtonV2>
        </div>
      </Show>
    </article>
  )
}
