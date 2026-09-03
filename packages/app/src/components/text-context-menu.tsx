import { createSignal, For, Show, type JSX } from "solid-js"
import { ContextMenu } from "@opencode-ai/ui/context-menu"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSettings } from "@/context/settings"

// mQorva: Im Verlauf und in der Dateivorschau kam bislang das native Chromium-Menü von
// `electron-context-menu` — fremde Optik, englische Beschriftung. Hier steht stattdessen
// das Menü aus dem Design-System. Eingabefelder behalten das native Menü, weil dort
// Rechtschreibvorschläge und ein zuverlässiges Einfügen gebraucht werden.

type Target = { selection: string; path?: string; link?: string }

type Entry = { label: string; disabled: boolean; run: () => void }

export function TextContextMenu(props: { children: JSX.Element; class?: string }) {
  const language = useLanguage()
  const platform = usePlatform()
  const settings = useSettings()
  const [target, setTarget] = createSignal<Target>({ selection: "" })
  let root: HTMLElement | undefined

  // Kobalte öffnet das Menü in seinem eigenen `contextmenu`-Handler. Der Ziel-Zustand wird
  // deshalb in der Capture-Phase gelesen, damit er beim Aufbau der Einträge schon steht.
  const attach = (el: HTMLElement) => {
    root = el
    el.addEventListener(
      "contextmenu",
      (event) => {
        const node = event.target
        const selection = window.getSelection()?.toString() ?? ""
        if (!(node instanceof Element)) {
          setTarget({ selection })
          return
        }
        const anchor = node.closest("a[href]")
        setTarget({
          selection,
          path: node.closest("code[data-file-link]")?.textContent?.trim() || undefined,
          link: anchor instanceof HTMLAnchorElement && anchor.protocol.startsWith("http") ? anchor.href : undefined,
        })
      },
      true,
    )
  }

  const write = (value: string | undefined) => {
    if (!value) return
    void navigator.clipboard?.writeText(value)
  }

  const copy = () => {
    // `webContents.copy()` übernimmt die Auswahl mitsamt Formatierung; im Web bleibt der Text.
    if (platform.runDesktopMenuAction) {
      void platform.runDesktopMenuAction("edit.copy")
      return
    }
    write(target().selection)
  }

  // Bewusst nicht `edit.selectAll`: das markiert das gesamte Fenster inklusive Seitenleiste.
  // Markiert wird nur der Bereich, in dem das Menü geöffnet wurde.
  const selectAll = () => {
    const selection = window.getSelection()
    if (!root || !selection) return
    const range = document.createRange()
    range.selectNodeContents(root)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const entries = (): Entry[] => {
    const current = target()
    return [
      { label: language.t("contextMenu.copy"), disabled: !current.selection, run: copy },
      { label: language.t("contextMenu.selectAll"), disabled: false, run: selectAll },
      ...(current.path
        ? [{ label: language.t("contextMenu.copyPath"), disabled: false, run: () => write(current.path) }]
        : []),
      ...(current.link
        ? [{ label: language.t("contextMenu.copyLink"), disabled: false, run: () => write(current.link) }]
        : []),
    ]
  }

  return (
    <Show
      when={settings.general.newLayoutDesigns()}
      fallback={
        <ContextMenu>
          <ContextMenu.Trigger as="div" ref={attach} class={props.class}>
            {props.children}
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content>
              <For each={entries()}>
                {(entry) => (
                  <ContextMenu.Item disabled={entry.disabled} onSelect={entry.run}>
                    <ContextMenu.ItemLabel>{entry.label}</ContextMenu.ItemLabel>
                  </ContextMenu.Item>
                )}
              </For>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu>
      }
    >
      <MenuV2.Context>
        <MenuV2.Context.Trigger as="div" ref={attach} class={props.class}>
          {props.children}
        </MenuV2.Context.Trigger>
        <MenuV2.Context.Portal>
          <MenuV2.Context.Content>
            <For each={entries()}>
              {(entry) => (
                <MenuV2.Item disabled={entry.disabled} onSelect={entry.run}>
                  {entry.label}
                </MenuV2.Item>
              )}
            </For>
          </MenuV2.Context.Content>
        </MenuV2.Context.Portal>
      </MenuV2.Context>
    </Show>
  )
}
