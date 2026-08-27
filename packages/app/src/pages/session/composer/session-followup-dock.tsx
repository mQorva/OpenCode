import { createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { DockTray } from "@opencode-ai/ui/dock-surface"
import { IconButton } from "@opencode-ai/ui/icon-button"
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
  /** Queue-wide, not per item: while paused nothing is sent on its own. */
  paused?: boolean
  onSend: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onMove: (fromID: string, toID: string) => void
  onItemPauseToggle: (id: string) => void
  onPauseToggle: () => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    collapsed: false,
  })
  const [dragging, setDragging] = createSignal<string>()

  const toggle = () => setStore("collapsed", (value) => !value)
  const total = createMemo(() => props.items.length)
  const label = createMemo(() => language.plural("session.followupDock.summary", total()))
  const preview = createMemo(() => props.items[0]?.text ?? "")

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
    <DockTray
      data-component="session-followup-dock"
      class="bg-v2-background-bg-layer-01 border-b border-border-weaker-base"
      style={{
        "margin-bottom": "-0.875rem",
        "border-bottom-left-radius": 0,
        "border-bottom-right-radius": 0,
      }}
    >
      <div
        class="pl-3 pr-2 py-2 flex items-center gap-2"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          toggle()
        }}
      >
        <span class="shrink-0 text-13-medium text-text-strong cursor-default">{label()}</span>
        <Show when={props.paused}>
          <span class="shrink-0 text-13-regular text-text-weak cursor-default">
            {language.t("session.followupDock.pausedHint")}
          </span>
        </Show>
        <Show when={store.collapsed && preview()}>
          <span class="min-w-0 flex-1 truncate text-13-regular text-text-base cursor-default">{preview()}</span>
        </Show>
        <div class="ml-auto shrink-0 flex items-center gap-1">
          {/* Pausing holds the whole queue, which is why it sits in the header rather than on a
              row. Aborting a run already sets this state — until now nothing showed it, so a
              queue could sit still with no indication why. */}
          <Tooltip
            value={
              props.paused ? language.t("session.followupDock.resume") : language.t("session.followupDock.pause")
            }
            placement="top"
          >
            <IconButtonV2
              type="button"
              size="small"
              variant="ghost-muted"
              class="shrink-0 text-v2-icon-icon-muted"
              state={props.paused ? "pressed" : undefined}
              aria-pressed={props.paused ? "true" : "false"}
              aria-label={
                props.paused ? language.t("session.followupDock.resume") : language.t("session.followupDock.pause")
              }
              onMouseDown={(event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event: MouseEvent) => {
                event.stopPropagation()
                props.onPauseToggle()
              }}
            >
              <Show when={props.paused} fallback={<PauseIcon />}>
                <ResumeIcon />
              </Show>
            </IconButtonV2>
          </Tooltip>
          <IconButton
            data-collapsed={store.collapsed ? "true" : "false"}
            icon="chevron-down"
            size="normal"
            variant="ghost"
            style={{ transform: `rotate(${store.collapsed ? 180 : 0}deg)` }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
            aria-label={
              store.collapsed ? language.t("session.followupDock.expand") : language.t("session.followupDock.collapse")
            }
          />
        </div>
      </div>

      <Show when={store.collapsed}>
        <div class="h-5" aria-hidden="true" />
      </Show>

      <Show when={!store.collapsed}>
        <div class="px-2 pb-6 flex flex-col gap-0.5 max-h-42 overflow-y-auto no-scrollbar">
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
                <IconButton
                  type="button"
                  draggable
                  icon="chevron-grabber-vertical"
                  iconSize="small"
                  variant="ghost"
                  class="shrink-0 cursor-grab text-text-weaker hover:text-text-strong"
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
                <Tooltip value={language.t("session.followupDock.steer")} placement="top">
                  <ButtonV2
                    size="small"
                    variant="ghost-muted"
                    class="shrink-0 gap-1 px-1.5"
                    disabled={!!props.sending}
                    onClick={() => props.onSend(item.id)}
                  >
                    <IconV2 name="outline-square-arrow" size="small" />
                    <span>{language.t("session.followupDock.steer")}</span>
                  </ButtonV2>
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
                <MenuV2 gutter={6} placement="bottom-end">
                  <MenuV2.Trigger
                    as={IconButtonV2}
                    type="button"
                    size="small"
                    variant="ghost-muted"
                    class="shrink-0 text-v2-icon-icon-muted"
                    aria-label={language.t("common.moreOptions")}
                    icon={<IconV2 name="outline-dots" />}
                  />
                  <MenuV2.Portal>
                    <MenuV2.Content style={{ "min-width": "140px" }}>
                      <MenuV2.Item
                        onSelect={() => props.onSend(item.id)}
                        disabled={!!props.sending}
                      >
                        {language.t("session.followupDock.steer")}
                      </MenuV2.Item>
                      <MenuV2.Item onSelect={() => props.onEdit(item.id)}>
                        {language.t("session.followupDock.edit")}
                      </MenuV2.Item>
                      <MenuV2.Item onSelect={() => props.onItemPauseToggle(item.id)}>
                        {item.paused
                          ? language.t("session.followupDock.item.resume")
                          : language.t("session.followupDock.item.pause")}
                      </MenuV2.Item>
                      <MenuV2.Separator />
                      <MenuV2.Item onSelect={() => props.onRemove(item.id)}>
                        {language.t("common.delete")}
                      </MenuV2.Item>
                    </MenuV2.Content>
                  </MenuV2.Portal>
                </MenuV2>
              </div>
            )}
          </For>
        </div>
      </Show>
    </DockTray>
  )
}