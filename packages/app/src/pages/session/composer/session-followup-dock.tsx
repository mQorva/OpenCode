import { createSignal, For, Show } from "solid-js"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ComposerCard } from "@opencode-ai/ui/composer-card"
import { Icon } from "@opencode-ai/ui/icon"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4">
      <path
        d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5V15a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 14.5 15V5.5M8 8.5v5M12 8.5v5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4">
      <path d="M7.5 4.5v11M12.5 4.5v11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  )
}

function ResumeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4">
      <path
        d="M6.5 4.5l9 5.5-9 5.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  )
}

export function SessionFollowupDock(props: {
  items: { id: string; text: string; paused?: boolean }[]
  sending?: string
  onSend: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onMove: (fromID: string, toID: string, position: "before" | "after") => void
  onItemPauseToggle: (id: string) => void
}) {
  const language = useLanguage()
  const [dragging, setDragging] = createSignal<string>()
  const [dropTarget, setDropTarget] = createSignal<{ id: string; position: "before" | "after" } | undefined>()

  const startDrag = (event: DragEvent, id: string) => {
    setDragging(id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  }
  const endDrag = () => {
    setDragging(undefined)
    setDropTarget(undefined)
  }
  const computePosition = (event: DragEvent, target: HTMLElement): "before" | "after" => {
    const box = target.getBoundingClientRect()
    return event.clientY < box.top + box.height / 2 ? "before" : "after"
  }
  const onItemDragOver = (event: DragEvent & { currentTarget: HTMLDivElement }, id: string) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
    setDropTarget({ id, position: computePosition(event, event.currentTarget) })
  }
  const dropOn = (id: string) => {
    const from = dragging()
    const target = dropTarget()
    if (!from || !target || from === id) return
    props.onMove(from, target.id, target.position)
    endDrag()
  }

  return (
    <ComposerCard data-component="session-followup-dock" shape="tray">
      <div class="px-2 pt-2 pb-6 flex flex-col gap-0.5 max-h-42 overflow-y-auto no-scrollbar">
        <For each={props.items}>
          {(item, index) => (
            <>
              <Show when={dropTarget()?.id === item.id && dropTarget()?.position === "before"}>
                <DropIndicator />
              </Show>
              <div
                data-component="session-followup-item"
                draggable={true}
                classList={{
                  "flex items-center gap-1.5 min-w-0 rounded-lg px-1 py-1.5 cursor-grab active:cursor-grabbing": true,
                  "bg-v2-overlay-simple-overlay-hover": dragging() === item.id,
                  "opacity-60": dragging() !== undefined && dragging() !== item.id,
                }}
                onDragStart={(event) => startDrag(event, item.id)}
                onDragEnd={endDrag}
                onDragOver={(event) => onItemDragOver(event, item.id)}
                onDrop={() => dropOn(item.id)}
              >
                <div
                  data-component="session-followup-drag-handle"
                  draggable={false}
                  aria-hidden="true"
                  class="flex shrink-0 items-center justify-center text-v2-icon-icon-muted"
                >
                  <Icon name="grip-vertical" size="small" />
                </div>
                <span
                  classList={{
                    "min-w-0 flex-1 truncate text-13-regular cursor-default select-none": true,
                    "text-text-base": !item.paused,
                    // A held-back entry stays readable but stops looking like it is next in line.
                    "text-text-weak line-through decoration-text-weaker": !!item.paused,
                  }}
                >
                  {item.text}
                </span>
                <div class="shrink-0 flex items-center gap-1.5">
                  <TooltipV2 value={language.t("session.followupDock.steer")} placement="top">
                    <IconButtonV2
                      type="button"
                      size="small"
                      variant="ghost-muted"
                      class="shrink-0 text-v2-icon-icon-muted"
                      disabled={!!props.sending}
                      draggable={false}
                      aria-label={language.t("session.followupDock.steer")}
                      onClick={() => props.onSend(item.id)}
                    >
                      <Icon name="arrow-up" size="small" />
                    </IconButtonV2>
                  </TooltipV2>
                  <TooltipV2 value={language.t("session.followupDock.edit")} placement="top">
                    <IconButtonV2
                      type="button"
                      size="small"
                      variant="ghost-muted"
                      class="shrink-0 text-v2-icon-icon-muted"
                      draggable={false}
                      aria-label={language.t("session.followupDock.edit")}
                      onClick={() => props.onEdit(item.id)}
                    >
                      <Icon name="pencil-line" size="small" />
                    </IconButtonV2>
                  </TooltipV2>
                  <TooltipV2
                    value={
                      item.paused
                        ? language.t("session.followupDock.item.resume")
                        : language.t("session.followupDock.item.pause")
                    }
                    placement="top"
                  >
                    <IconButtonV2
                      type="button"
                      size="small"
                      variant="ghost-muted"
                      class="shrink-0 text-v2-icon-icon-muted"
                      state={item.paused ? "pressed" : undefined}
                      draggable={false}
                      aria-pressed={item.paused ? "true" : "false"}
                      aria-label={
                        item.paused
                          ? language.t("session.followupDock.item.resume")
                          : language.t("session.followupDock.item.pause")
                      }
                      onClick={() => props.onItemPauseToggle(item.id)}
                    >
                      <Show when={item.paused} fallback={<PauseIcon />}>
                        <ResumeIcon />
                      </Show>
                    </IconButtonV2>
                  </TooltipV2>
                  <TooltipV2 value={language.t("common.delete")} placement="top">
                    <IconButtonV2
                      type="button"
                      size="small"
                      variant="ghost-muted"
                      class="shrink-0 text-v2-icon-icon-muted"
                      draggable={false}
                      aria-label={language.t("common.delete")}
                      onClick={() => props.onRemove(item.id)}
                    >
                      <TrashIcon />
                    </IconButtonV2>
                  </TooltipV2>
                </div>
              </div>
              <Show
                when={
                  index() === props.items.length - 1 &&
                  dropTarget()?.id === item.id &&
                  dropTarget()?.position === "after"
                }
              >
                <DropIndicator />
              </Show>
            </>
          )}
        </For>
      </div>
    </ComposerCard>
  )
}

function DropIndicator() {
  return (
    <div
      data-component="session-followup-drop-indicator"
      aria-hidden="true"
      class="h-0.5 -my-0.5 mx-1 rounded-full bg-v2-text-text-base"
    />
  )
}
