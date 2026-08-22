import { createEffect, createSignal, Show } from "solid-js"
import { ContextMenu, DropdownMenu, IconButton, Tooltip, useLanguage } from "./upstream"
import type { SidebarSession } from "./sessions"

function PinIcon(props: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill={props.filled ? "currentColor" : "none"} aria-hidden="true" class="size-4">
      <path
        d="m7.25 3.25 5.5 0-.65 4.1 2.15 2.15v1H10.5V17l-.5.75-.5-.75v-6.5H5.75v-1L7.9 7.35l-.65-4.1Z"
        stroke="currentColor"
        stroke-width="1.15"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function relativeAge(timestamp: number, locale: string) {
  const minutes = Math.round((timestamp - Date.now()) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, "hour")
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return format.format(days, "day")
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return format.format(months, "month")
  return format.format(Math.round(months / 12), "year")
}

function SessionMenuItems(props: {
  pinned: boolean
  onRename: () => void
  onMarkUnread: () => void
  onTogglePin: () => void
  onArchive?: () => void
  onDelete: () => void
  onCopyTitle: () => void
  onCopyID: () => void
  onCopyProject: () => void
  context?: boolean
}) {
  const language = useLanguage()
  const Menu = props.context ? ContextMenu : DropdownMenu

  return (
    <>
      <Menu.Item onSelect={props.onRename}>
        <Menu.ItemLabel>{language.t("sidebarLayout.rename")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onMarkUnread}>
        <Menu.ItemLabel>{language.t("sidebarLayout.markUnread")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onTogglePin}>
        <Menu.ItemLabel>
          <Show when={props.pinned} fallback={language.t("sidebarLayout.pin")}>
            {language.t("sidebarLayout.unpin")}
          </Show>
        </Menu.ItemLabel>
      </Menu.Item>
      <Show when={props.onArchive}>
        <Menu.Item onSelect={props.onArchive}>
          <Menu.ItemLabel>{language.t("common.archive")}</Menu.ItemLabel>
        </Menu.Item>
      </Show>
      <Menu.Separator />
      <Menu.Item onSelect={props.onCopyTitle}>
        <Menu.ItemLabel>{language.t("sidebarLayout.copyTitle")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onCopyID}>
        <Menu.ItemLabel>{language.t("sidebarLayout.copyID")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Item onSelect={props.onCopyProject}>
        <Menu.ItemLabel>{language.t("sidebarLayout.copyProject")}</Menu.ItemLabel>
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item onSelect={props.onDelete}>
        <Menu.ItemLabel>{language.t("common.delete")}</Menu.ItemLabel>
      </Menu.Item>
    </>
  )
}

export function SessionItem(props: {
  entry: SidebarSession
  active: boolean
  pinned: boolean
  unread: boolean
  indent?: boolean
  onSelect: () => void
  onRename: (title: string) => Promise<boolean>
  onMarkUnread: () => void
  onTogglePin: () => void
  onArchive?: () => void
  onDelete: () => void
  onCopyTitle: () => void
  onCopyID: () => void
  onCopyProject: () => void
}) {
  const language = useLanguage()
  const title = () => props.entry.session.title?.trim() || language.t("sidebarLayout.untitled")
  const [editing, setEditing] = createSignal(false)
  const [value, setValue] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)
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

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        as="div"
        classList={{
          "group/session relative w-full min-w-0 h-8 flex items-center rounded-lg text-13-regular transition-colors outline-none": true,
          "pl-2": !props.indent,
          "pl-8": props.indent,
          "pr-1": true,
          "bg-v2-background-bg-layer-02 text-text-strong": props.active,
          "text-text-base hover:bg-v2-background-bg-layer-02/60 hover:text-text-strong focus-within:bg-v2-background-bg-layer-02/60":
            !props.active,
        }}
      >
        <Show when={props.active}>
          <span class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-icon-strong-base" />
        </Show>
        <Show
          when={editing()}
          fallback={
            <button
              type="button"
              onClick={props.onSelect}
              title={title()}
              class="min-w-0 h-full flex-1 flex items-center gap-2 truncate text-left outline-none"
              aria-current={props.active ? "page" : undefined}
            >
              <Show when={props.unread}>
                <span
                  class="size-1.5 shrink-0 rounded-full bg-icon-info-base"
                  aria-label={language.t("sidebarLayout.unread")}
                />
              </Show>
              <span class="truncate">{title()}</span>
            </button>
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
            class="min-w-0 flex-1 h-6 rounded-md border border-border-focus bg-v2-background-bg-base px-1.5 text-13-regular text-text-strong outline-none"
            aria-label={language.t("sidebarLayout.rename")}
          />
        </Show>

        <Show when={!editing()}>
          <Show when={!menuOpen() && !props.pinned}>
            <span class="shrink-0 px-1 text-11-regular text-text-weaker group-hover/session:hidden group-focus-within/session:hidden">
              {relativeAge(props.entry.session.time.updated, language.locale())}
            </span>
          </Show>
          <div
            classList={{
              "shrink-0 items-center": true,
              flex: menuOpen() || props.pinned,
              "hidden group-hover/session:flex group-focus-within/session:flex": !menuOpen() && !props.pinned,
            }}
          >
            <DropdownMenu open={menuOpen()} onOpenChange={setMenuOpen} gutter={4} placement="bottom-end" flip={false}>
              <DropdownMenu.Trigger
                as={IconButton}
                icon="dot-grid"
                iconSize="small"
                variant="ghost"
                class="!size-7 shrink-0 rounded-md text-icon-base"
                title={language.t("common.moreOptions")}
                aria-label={language.t("common.moreOptions")}
              />
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <SessionMenuItems
                    pinned={props.pinned}
                    onRename={beginRename}
                    onMarkUnread={props.onMarkUnread}
                    onTogglePin={props.onTogglePin}
                    onArchive={props.onArchive}
                    onDelete={props.onDelete}
                    onCopyTitle={props.onCopyTitle}
                    onCopyID={props.onCopyID}
                    onCopyProject={props.onCopyProject}
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
            <Tooltip
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
            </Tooltip>
            <Show when={props.onArchive}>
              <Tooltip value={language.t("common.archive")} placement="top">
                <IconButton
                  icon="archive"
                  iconSize="small"
                  variant="ghost"
                  class="!size-7 shrink-0 rounded-md text-icon-base"
                  onClick={props.onArchive}
                  aria-label={language.t("common.archive")}
                />
              </Tooltip>
            </Show>
          </div>
        </Show>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content>
          <SessionMenuItems
            context
            pinned={props.pinned}
            onRename={beginRename}
            onMarkUnread={props.onMarkUnread}
            onTogglePin={props.onTogglePin}
            onArchive={props.onArchive}
            onDelete={props.onDelete}
            onCopyTitle={props.onCopyTitle}
            onCopyID={props.onCopyID}
            onCopyProject={props.onCopyProject}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  )
}
