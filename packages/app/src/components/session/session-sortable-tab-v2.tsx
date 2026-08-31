import { createMemo, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useSortable } from "@dnd-kit/solid/sortable"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { KeybindV2 } from "@opencode-ai/ui/v2/keybind-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { Tabs } from "@opencode-ai/ui/tabs"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useCommand } from "@/context/command"
import { FileVisual } from "./session-sortable-tab"

export function SortableTabV2(props: {
  tab: string
  index: () => number
  temporary?: boolean
  onTabClose: (tab: string) => void
  onTabDoubleClick?: (tab: string) => void
}): JSX.Element {
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const closeTabKeybind = createMemo(() => command.keybindParts("tab.close"))
  const sortable = useSortable({
    get id() {
      return props.tab
    },
    get index() {
      return props.index()
    },
  })
  const path = createMemo(() => file.pathFromTab(props.tab))
  const content = createMemo(() => {
    const value = path()
    if (!value) return
    return <FileVisual path={value} temporary={props.temporary} />
  })
  return (
    <div ref={sortable.ref} class="h-full flex items-center">
      <div class="relative">
        <Tabs.Trigger
          value={props.tab}
          closeButton={
            <TooltipV2
              value={
                <>
                  {language.t("common.closeTab")}
                  <Show when={closeTabKeybind().length > 0}>
                    <KeybindV2 keys={closeTabKeybind()} variant="neutral" />
                  </Show>
                </>
              }
              placement="bottom"
              gutter={10}
            >
              <IconButtonV2
                size="small"
                variant="ghost-muted"
                icon={<IconV2 name="xmark-small" size="small" />}
                class="h-5 w-5"
                onClick={() => props.onTabClose(props.tab)}
                aria-label={language.t("common.closeTab")}
              />
            </TooltipV2>
          }
          hideCloseButton
          onMiddleClick={() => props.onTabClose(props.tab)}
          onDblClick={() => props.onTabDoubleClick?.(props.tab)}
        >
          <Show when={content()}>{(value) => value()}</Show>
        </Tabs.Trigger>
      </div>
    </div>
  )
}
