import { createSignal, For, Show } from "solid-js"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { DockTray } from "@opencode-ai/ui/dock-surface"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
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
  onMove: (fromID: string, toID: string) => void
  onItemPauseToggle: (id: string) => void
}) {
  const language = useLanguage()
  const [dragging, setDragging] = createSignal<string>()

  const startDrag = (event: DragEvent, id: string) => {
    setDragging(id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  }
  const dropOn = (id: string) => {
    const from = dragging()
    if (!from) return
    props.onMove(from, id)
    setDragging(undefined)
  }

  return (
    // Sits behind the composer like a sheet: inset on both sides, no border of its own, and a step
    // lighter than the input. The overlap then reads as depth rather than as two cards colliding.
    <DockTray
      data-component="session-followup-dock"
      class="mx-2.5 border-0 bg-v2-background-bg-layer-02"
      style={{
        "margin-bottom": "-0.875rem",
        "border-bottom-left-radius": 0,
        "border-bottom-right-radius": 0,
      }}
    >
      <div class="px-2 pt-2 pb-6 flex flex-col gap-0.5 max-h-42 overflow-y-auto no-scrollbar">
        <For each={props.items}>
          {(item) => (
            <div
              data-component="session-followup-item"
              classList={{
                "flex items-center gap-1.5 min-w-0 rounded-lg px-1 py-1.5": true,
                "bg-v2-overlay-simple-overlay-hover": dragging() === item.id,
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
              }}
              onDrop={() => dropOn(item.id)}
            >
              <IconButtonV2
                type="button"
                size="small"
                variant="ghost-muted"
                icon={<Icon name="grip-vertical" size="small" />}
                class="shrink-0 cursor-grab"
                aria-label={language.t("session.followupDock.drag")}
                onDragStart={(event) => startDrag(event, item.id)}
                onDragEnd={() => setDragging(undefined)}
                onPointerDown={(event) => event.stopPropagation()}
              />
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
                <Tooltip value={language.t("session.followupDock.steer")} placement="top">
                  <IconButtonV2
                    type="button"
                    size="small"
                    variant="ghost-muted"
                    class="shrink-0 text-v2-icon-icon-muted"
                    disabled={!!props.sending}
                    aria-label={language.t("session.followupDock.steer")}
                    onClick={() => props.onSend(item.id)}
                  >
                    <Icon name="arrow-up" size="small" />
                  </IconButtonV2>
                </Tooltip>
                <Tooltip value={language.t("session.followupDock.edit")} placement="top">
                  <IconButtonV2
                    type="button"
                    size="small"
                    variant="ghost-muted"
                    class="shrink-0 text-v2-icon-icon-muted"
                    aria-label={language.t("session.followupDock.edit")}
                    onClick={() => props.onEdit(item.id)}
                  >
                    <Icon name="pencil-line" size="small" />
                  </IconButtonV2>
                </Tooltip>
                <Tooltip
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
                </Tooltip>
                <Tooltip value={language.t("common.delete")} placement="top">
                  <IconButtonV2
                    type="button"
                    size="small"
                    variant="ghost-muted"
                    class="shrink-0 text-v2-icon-icon-muted"
                    aria-label={language.t("common.delete")}
                    onClick={() => props.onRemove(item.id)}
                  >
                    <TrashIcon />
                  </IconButtonV2>
                </Tooltip>
              </div>
            </div>
          )}
        </For>
      </div>
    </DockTray>
  )
}
