import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { migrateMqorvaUserData } from "./mqorva-migration"

const roots: string[] = []

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

describe("mQorva desktop data migration", () => {
  test("copies persisted settings without Chromium caches", () => {
    const root = mkdtempSync(join(tmpdir(), "mqorva-migration-"))
    roots.push(root)
    const source = join(root, "ai.opencode.desktop.dev")
    const target = join(root, "de.mqorva.opencode.desktop.dev")
    mkdirSync(join(source, "Cache"), { recursive: true })
    writeFileSync(join(source, "opencode.settings"), "settings")
    writeFileSync(join(source, "opencode.global.dat"), "projects")
    writeFileSync(join(source, "drafts.sqlite"), "drafts")
    writeFileSync(join(source, "Preferences"), "chromium")

    expect(migrateMqorvaUserData(root, target, "dev")).toEqual({
      migrated: true,
      copied: ["drafts.sqlite", "opencode.global.dat", "opencode.settings"],
    })
    expect(readFileSync(join(target, "opencode.settings"), "utf8")).toBe("settings")
    expect(readFileSync(join(target, "opencode.global.dat"), "utf8")).toBe("projects")
    expect(readFileSync(join(target, "drafts.sqlite"), "utf8")).toBe("drafts")
    expect(() => readFileSync(join(target, "Preferences"), "utf8")).toThrow()
  })

  test("does not overwrite an initialized mQorva profile", () => {
    const root = mkdtempSync(join(tmpdir(), "mqorva-migration-"))
    roots.push(root)
    const source = join(root, "ai.opencode.desktop.dev")
    const target = join(root, "de.mqorva.opencode.desktop.dev")
    mkdirSync(source, { recursive: true })
    mkdirSync(target, { recursive: true })
    writeFileSync(join(source, "opencode.settings"), "legacy")
    writeFileSync(join(target, "opencode.settings"), "mqorva")

    expect(migrateMqorvaUserData(root, target, "dev")).toEqual({ migrated: false, copied: [] })
    expect(readFileSync(join(target, "opencode.settings"), "utf8")).toBe("mqorva")
  })
})
