// Single seam between the sidebar layout and upstream OpenCode.
//
// Everything the sidebar layout borrows from upstream is re-exported here, so an upstream
// sync that changes one of these signatures fails to compile in exactly one file instead of
// scattering breakage across the layout. Do not import upstream modules directly from the
// other files in this folder.

export { DebugBar } from "@/components/debug-bar"
export { TabsInfoPopup } from "@/components/help-button"
export { Titlebar, type TitlebarUpdate } from "@/components/titlebar"

export { useLanguage } from "@/context/language"
export { useCommand } from "@/context/command"
export { useGlobal } from "@/context/global"
export { getProjectAvatarVariant, useLayout, type LocalProject } from "@/context/layout"
export { usePlatform } from "@/context/platform"
export { useNotification } from "@/context/notification"
export { usePermission } from "@/context/permission"
export { useSettings } from "@/context/settings"
export { ServerConnection, useServer } from "@/context/server"
export { useServerSync } from "@/context/server-sync"
export { useServerSDK } from "@/context/server-sdk"
export { createSessionIndexQuery } from "@/context/global-sync/session-index-query"
export { sessionHasOpenTab, tabKey, useTabs, type DraftTab, type SessionTab, type Tab } from "@/context/tabs"

export { useDirectoryPicker } from "@/components/directory-picker"
export { useSettingsDialog } from "@/components/settings-dialog"
export { createHomeController } from "@/pages/home/home-controller"

export { compareSessionTime, displayName, errorMessage, getProjectAvatarSource, sortedRootSessions } from "@/pages/layout/helpers"

export { Persist, persisted } from "@/utils/persist"
export { pathKey } from "@/utils/path-key"
export { normalizeSessionInfo } from "@/utils/session"
export { setV2Toast, showToast, ToastRegion } from "@/utils/toast"

export { ContextMenu } from "@opencode-ai/ui/context-menu"
export { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
export { useDialog } from "@opencode-ai/ui/context/dialog"
export { Icon } from "@opencode-ai/ui/icon"
export { IconButton } from "@opencode-ai/ui/icon-button"
export { Spinner } from "@opencode-ai/ui/spinner"
export { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
export { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
export { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
export { ResizeHandle } from "@opencode-ai/ui/resize-handle"
export { ScrollView } from "@opencode-ai/ui/scroll-view"
export { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
export { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
export { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"

export type { Session } from "@opencode-ai/sdk/v2/client"
