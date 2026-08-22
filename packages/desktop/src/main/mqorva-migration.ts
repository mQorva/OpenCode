import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { LEGACY_OPENCODE_APP_IDS, type DesktopChannel } from "../../identity"

const MARKER = ".mqorva-migrated"

export function migrateMqorvaUserData(appDataPath: string, target: string, channel: DesktopChannel) {
  if (existsSync(target) && readdirSync(target).length > 0) return { migrated: false, copied: [] as string[] }

  const source = join(appDataPath, LEGACY_OPENCODE_APP_IDS[channel])
  if (!existsSync(source)) return { migrated: false, copied: [] as string[] }

  mkdirSync(target, { recursive: true })
  const copied = readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isFile() && persistedDesktopFile(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      copyFileSync(join(source, entry.name), join(target, entry.name))
      return entry.name
    })

  writeFileSync(join(target, MARKER), JSON.stringify({ source: LEGACY_OPENCODE_APP_IDS[channel], copied }, null, 2))
  return { migrated: true, copied }
}

function persistedDesktopFile(name: string) {
  if (name === "opencode.settings") return true
  if (name.endsWith(".dat")) return true
  if (name.startsWith("drafts.sqlite")) return true
  return name.startsWith("window-state-") && name.endsWith(".json")
}
