import { onCleanup } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useCommand } from "@/context/command"
import { useLanguage, type Locale } from "@/context/language"
import { useSettings } from "@/context/settings"
import { useTheme, type ColorScheme } from "@opencode-ai/ui/theme/context"
import { showToast } from "@/utils/toast"

/**
 * Commands that belong to the application rather than to a layout: appearance, language, settings,
 * server and provider dialogs.
 *
 * They used to live in `pages/layout.tsx`, which meant they only existed while the tab layout was
 * mounted — the sidebar layout replaces that shell, so switching to it silently lost all of them,
 * along with every app menu entry pointing at one. Registering here instead keeps them tied to the
 * contexts they actually need, all of which are global.
 *
 * `layout-commands.test.ts` guards the split: a new command added to `pages/layout.tsx` upstream
 * fails that test unless it is genuinely layout-bound, so the gap cannot silently come back.
 */
export function createLayoutCommands() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()
  const settings = useSettings()
  const theme = useTheme()

  // Dialogs load lazily, so a late import must not open a dialog for a screen the user already
  // left. `run` invalidates in-flight imports, `dead` covers unmount.
  let run = 0
  let dead = false
  onCleanup(() => {
    dead = true
  })

  const showLater = (load: () => Promise<{ default?: unknown } & Record<string, unknown>>, pick: string) => {
    const ticket = ++run
    void load().then((module) => {
      if (dead || run !== ticket) return
      const Component = module[pick] as () => never
      dialog.show(() => <Component />)
    })
  }

  const connectProvider = () => showLater(() => import("@/components/dialog-connect-provider"), "DialogConnectProvider")
  const openServer = () => showLater(() => import("@/components/dialog-select-server"), "DialogSelectServer")
  const openSettings = () =>
    showLater(
      () => (settings.general.newLayoutDesigns() ? import("@/components/settings-v2") : import("@/components/dialog-settings")),
      "DialogSettings",
    )

  const themeIds = () => theme.ids()
  const colorSchemeOrder: ColorScheme[] = ["system", "light", "dark"]
  const colorSchemeKey: Record<ColorScheme, "theme.scheme.system" | "theme.scheme.light" | "theme.scheme.dark"> = {
    system: "theme.scheme.system",
    light: "theme.scheme.light",
    dark: "theme.scheme.dark",
  }
  const colorSchemeLabel = (scheme: ColorScheme) => language.t(colorSchemeKey[scheme])

  function cycleTheme(direction = 1) {
    const ids = themeIds()
    if (ids.length === 0) return
    const at = ids.indexOf(theme.themeId())
    const next = ids[at === -1 ? 0 : (at + direction + ids.length) % ids.length]
    if (!next) return
    theme.setTheme(next)
    showToast({
      title: language.t("toast.theme.title"),
      description: language.t("toast.theme.description", { theme: theme.name(next) }),
    })
  }

  function cycleColorScheme(direction = 1) {
    const at = colorSchemeOrder.indexOf(theme.colorScheme())
    const next = colorSchemeOrder[at === -1 ? 0 : (at + direction + colorSchemeOrder.length) % colorSchemeOrder.length]
    if (!next) return
    theme.setColorScheme(next)
    showToast({
      title: language.t("toast.scheme.title"),
      description: language.t("toast.scheme.description", { scheme: colorSchemeLabel(next) }),
    })
  }

  function setLocale(next: Locale) {
    if (next === language.locale()) return
    language.setLocale(next)
    showToast({
      title: language.t("toast.language.title"),
      description: language.t("toast.language.description", { language: language.label(next) }),
    })
  }

  function cycleLanguage(direction = 1) {
    const locales = language.locales
    const at = locales.indexOf(language.locale())
    const next = locales[at === -1 ? 0 : (at + direction + locales.length) % locales.length]
    if (next) setLocale(next)
  }

  command.register("app-commands", () => [
    {
      id: "provider.connect",
      title: language.t("command.provider.connect"),
      category: language.t("command.category.provider"),
      onSelect: () => connectProvider(),
    },
    {
      id: "server.switch",
      title: language.t("command.server.switch"),
      category: language.t("command.category.server"),
      onSelect: () => openServer(),
    },
    {
      id: "settings.open",
      title: language.t("command.settings.open"),
      category: language.t("command.category.settings"),
      keybind: "mod+comma",
      onSelect: () => openSettings(),
    },
    {
      id: "theme.cycle",
      title: language.t("command.theme.cycle"),
      category: language.t("command.category.theme"),
      keybind: "mod+shift+t",
      onSelect: () => cycleTheme(1),
    },
    ...themeIds().map((id) => ({
      id: `theme.set.${id}`,
      title: language.t("command.theme.set", { theme: theme.name(id) }),
      category: language.t("command.category.theme"),
      onSelect: () => theme.commitPreview(),
      onHighlight: () => {
        theme.previewTheme(id)
        return () => theme.cancelPreview()
      },
    })),
    {
      id: "theme.scheme.cycle",
      title: language.t("command.theme.scheme.cycle"),
      category: language.t("command.category.theme"),
      keybind: "mod+shift+s",
      onSelect: () => cycleColorScheme(1),
    },
    ...colorSchemeOrder.map((scheme) => ({
      id: `theme.scheme.${scheme}`,
      title: language.t("command.theme.scheme.set", { scheme: colorSchemeLabel(scheme) }),
      category: language.t("command.category.theme"),
      onSelect: () => theme.commitPreview(),
      onHighlight: () => {
        theme.previewColorScheme(scheme)
        return () => theme.cancelPreview()
      },
    })),
    {
      id: "language.cycle",
      title: language.t("command.language.cycle"),
      category: language.t("command.category.language"),
      onSelect: () => cycleLanguage(1),
    },
    ...language.locales.map((locale) => ({
      id: `language.set.${locale}`,
      title: language.t("command.language.set", { language: language.label(locale) }),
      category: language.t("command.category.language"),
      onSelect: () => setLocale(locale),
    })),
  ])

  return { openSettings, connectProvider, openServer, cycleTheme, cycleColorScheme, cycleLanguage, setLocale }
}
