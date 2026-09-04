import { createEffect, createSignal, Show, type Accessor } from "solid-js"
import { createDraggable, createDroppable, useDragDropContext } from "@thisbeyond/solid-dnd"
import { Icon, MenuV2, Spinner, TooltipV2, useLanguage } from "./upstream"
import { SidebarMarquee } from "./marquee"
import type { SidebarSession } from "./sessions"
import { isNewChat } from "@/utils/session-title"

function PinIcon(props: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={props.filled ? "currentColor" : "none"} aria-hidden="true" class="size-4">
      <path
        d="M16 9V4h1V2H8v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function SessionMenuItems(props: {
  pinned: boolean
  onRename: () => void
  onMarkUnread: () => void
  onTogglePin: () => void
  onDelete: () => void
  onCopyTitle: () => void
  onCopyID: () => void
  onCopyProject: () => void
}) {
  const language = useLanguage()

  return (
    <>
      <MenuV2.Item onSelect={props.onRename}>{language.t("sidebarLayout.rename")}</MenuV2.Item>
      <MenuV2.Item onSelect={props.onMarkUnread}>{language.t("sidebarLayout.markUnread")}</MenuV2.Item>
      <MenuV2.Item onSelect={props.onTogglePin}>
        <Show when={props.pinned} fallback={language.t("sidebarLayout.pin")}>
          {language.t("sidebarLayout.unpin")}
        </Show>
      </MenuV2.Item>
      <MenuV2.Separator />
      <MenuV2.Item onSelect={props.onCopyTitle}>{language.t("sidebarLayout.copyTitle")}</MenuV2.Item>
      <MenuV2.Item onSelect={props.onCopyID}>{language.t("sidebarLayout.copyID")}</MenuV2.Item>
      <MenuV2.Item onSelect={props.onCopyProject}>{language.t("sidebarLayout.copyProject")}</MenuV2.Item>
      <MenuV2.Separator />
      <MenuV2.Item onSelect={props.onDelete}>{language.t("common.delete")}</MenuV2.Item>
    </>
  )
}

export function SessionItem(props: {
  entry: SidebarSession
  /** Key used for dragging and as a drop target; omitted where reordering makes no sense. */
  dragID?: string
  active: boolean
  pinned: boolean
  unread: boolean
  attention: Accessor<"permission" | "question" | undefined>
  working: Accessor<boolean>
  indent?: boolean
  onSelect: () => void
  onRename: (title: string) => Promise<boolean>
  onMarkUnread: () => void
  onTogglePin: () => void
  onDelete: () => void
  onCopyTitle: () => void
  onCopyID: () => void
  onCopyProject: () => void
  canDrop: (source: string, target: string) => boolean
}) {
  const language = useLanguage()
  const title = () => {
    const value = props.entry.session.title?.trim()
    if (isNewChat(value)) return language.t("sidebarLayout.newChat")
    return value || language.t("sidebarLayout.untitled")
  }
  const dragID = () => props.dragID ?? `static:${props.entry.session.id}`
  const draggable = createDraggable(dragID())
  const droppable = createDroppable(dragID())
  const dnd = useDragDropContext()
  const [editing, setEditing] = createSignal(false)
  const [value, setValue] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  let input: HTMLInputElement | undefined

  createEffect(() => {
    if (!editing()) return
    setValue(title())
    queueMicrotask(() => input?.select())
  })

  const beginRename = () => setEditing(true)
  const cancelRename = () => {
    setEditing(false)
    setValue(title())
  }
  const commitRename = async () => {
    if (!editing() || saving()) return
    const next = value().trim()
    if (!next || next === title()) {
      cancelRename()
      return
    }
    setSaving(true)
    const renamed = await props.onRename(next)
    setSaving(false)
    if (renamed) setEditing(false)
  }
  const dropActive = () => {
    if (!props.dragID || !droppable.isActiveDroppable) return false
    const source = dnd?.[0].active.draggable?.id
    if (source === undefined || source === null) return false
    return props.canDrop(String(source), props.dragID)
  }

  return (
    <MenuV2.Context>
      <MenuV2.Context.Trigger
        as="div"
        data-sidebar-row=""
        ref={(el: HTMLElement) => {
          if (!props.dragID) return
          draggable(el)
          droppable(el)
        }}
        data-drop={dropActive() ? "" : undefined}
        classList={{
          "opacity-50": !!props.dragID && draggable.isActiveDraggable,
          "group/session relative w-full min-w-0 h-8 flex items-center rounded-lg text-[13px] font-[440] leading-4 tracking-[-0.04px] transition-colors outline-none": true,
          "pl-2": !props.indent,
          "pl-8": props.indent,
          "pr-1": true,
          "bg-v2-background-bg-layer-02 text-text-base hover:text-text-strong": props.active,
          "text-text-base hover:bg-v2-background-bg-layer-02/60 hover:text-text-strong focus-within:bg-v2-background-bg-layer-02/60":
            !props.active,
        }}
      >
        <Show
          when={editing()}
          fallback={
            <TooltipV2 value={title()} placement="right" class="min-w-0 h-full flex-1">
              <button
                type="button"
                onClick={props.onSelect}
                class="min-w-0 h-full w-full flex items-center gap-2 text-left outline-none"
                aria-current={props.active ? "page" : undefined}
              >
                <SidebarMarquee>{title()}</SidebarMarquee>
              </button>
            </TooltipV2>
          }
        >
          <input
            ref={input}
            value={value()}
            disabled={saving()}
            onInput={(event) => setValue(event.currentTarget.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                cancelRename()
                return
              }
              if (event.key !== "Enter") return
              event.preventDefault()
              void commitRename()
            }}
            class="min-w-0 flex-1 h-6 rounded-md border border-border-focus bg-v2-background-bg-base px-1.5 text-[13px] font-[440] leading-4 tracking-[-0.04px] text-text-strong outline-none"
            aria-label={language.t("sidebarLayout.rename")}
          />
        </Show>

        <Show when={!editing()}>
          {/* Actions replace the status marker on hover — the row is too narrow for both. */}
          <div class="shrink-0 items-center hidden group-hover/session:flex group-focus-within/session:flex">
            <TooltipV2
              value={props.pinned ? language.t("sidebarLayout.unpin") : language.t("sidebarLayout.pin")}
              placement="top"
            >
              <button
                type="button"
                onClick={props.onTogglePin}
                class="size-7 shrink-0 rounded-md flex items-center justify-center text-icon-base hover:bg-v2-background-bg-layer-02 hover:text-text-strong"
                aria-label={props.pinned ? language.t("sidebarLayout.unpin") : language.t("sidebarLayout.pin")}
                aria-pressed={props.pinned}
              >
                <PinIcon filled={props.pinned} />
              </button>
            </TooltipV2>
          </div>

          <Show when={props.attention()}>
            {(attention) => (
              <TooltipV2
                value={language.t(
                  attention() === "permission" ? "notification.permission.title" : "notification.question.title",
                )}
                placement="top"
              >
                <span
                  class="shrink-0 px-1 flex items-center text-icon-warning-base"
                  aria-label={language.t(
                    attention() === "permission" ? "notification.permission.title" : "notification.question.title",
                  )}
                >
                  <Icon name={attention() === "permission" ? "checklist" : "bubble-5"} size="small" />
                </span>
              </TooltipV2>
            )}
          </Show>
          <Show when={!props.attention()}>
            <Show
              when={props.working()}
              fallback={
                <span class="shrink-0 flex items-center group-hover/session:hidden group-focus-within/session:hidden">
                  <Show
                    when={props.unread}
                    fallback={
                      <Show when={props.pinned}>
                        <span class="px-1 text-icon-weak" aria-hidden="true">
                          <PinIcon filled />
                        </span>
                      </Show>
                    }
                  >
                    <span
                      class="mx-1 size-1.5 rounded-full bg-v2-icon-icon-accent"
                      aria-label={language.t("sidebarLayout.unread")}
                    />
                  </Show>
                </span>
              }
            >
              <span class="shrink-0 px-1 group-hover/session:hidden group-focus-within/session:hidden">
                <Spinner class="size-3.5" />
              </span>
            </Show>
          </Show>
        </Show>
      </MenuV2.Context.Trigger>
      <MenuV2.Context.Portal>
        <MenuV2.Context.Content>
          <SessionMenuItems
            pinned={props.pinned}
            onRename={beginRename}
            onMarkUnread={props.onMarkUnread}
            onTogglePin={props.onTogglePin}
            onDelete={props.onDelete}
            onCopyTitle={props.onCopyTitle}
            onCopyID={props.onCopyID}
            onCopyProject={props.onCopyProject}
          />
        </MenuV2.Context.Content>
      </MenuV2.Context.Portal>
    </MenuV2.Context>
  )
}
