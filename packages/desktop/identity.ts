export type DesktopChannel = "dev" | "beta" | "prod"

export const MQORVA_APP_IDS: Record<DesktopChannel, string> = {
  dev: "de.mqorva.opencode.desktop.dev",
  beta: "de.mqorva.opencode.desktop.beta",
  prod: "de.mqorva.opencode.desktop",
}

export const MQORVA_APP_NAMES: Record<DesktopChannel, string> = {
  dev: "OpenCode mQorva Dev",
  beta: "OpenCode mQorva Beta",
  prod: "OpenCode mQorva",
}

export const MQORVA_UNPACKAGED_APP_ID = "de.mqorva.opencode.desktop.dev.unpacked"

export const LEGACY_OPENCODE_APP_IDS: Record<DesktopChannel, string> = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
}

export const MQORVA_PROTOCOL = "opencode-mqorva"
