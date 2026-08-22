import type { DesktopChannel } from "../../identity"

const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: DesktopChannel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

// mQorva releases are updated through the reviewed upstream merge and packaging flow.
// Never let the official OpenCode updater overwrite this separately identified edition.
export const UPDATER_ENABLED = false
