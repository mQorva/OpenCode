import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DESKTOP_MENU } from "../desktop-menu"

/**
 * Guards the split between layout-bound and application-wide commands.
 *
 * `pages/layout.tsx` is only mounted for the tab layout. Anything registered there is gone in the
 * sidebar layout, which silently disables every app menu entry pointing at it — that is how the
 * appearance, language, settings, server and provider commands went missing. Application-wide
 * commands therefore belong in `layout-commands.tsx`.
 *
 * Upstream changes `layout.tsx` often, so a merge can reintroduce the gap without anyone noticing.
 * These tests fail on a new id in that file until it is either moved or listed below as genuinely
 * layout-bound.
 */

const pages = join(import.meta.dir)
const read = (name: string) => readFileSync(join(pages, name), "utf8")

/** Ids that legitimately need the tab layout: they drive its own navigation and project state. */
const LAYOUT_BOUND = new Set([
  "sidebar.toggle",
  "project.open",
  "project.previous",
  "project.next",
  "project.${number}",
  "session.previous",
  "session.next",
  "session.previous.unseen",
  "session.next.unseen",
  "workspace.new",
  "workspace.toggle",
])

/** Menu entries whose command is registered by a session screen rather than by a layout. */
const SESSION_SCOPED = new Set(["fileTree.toggle", "terminal.toggle", "session.new"])

function registeredIds(source: string) {
  return new Set(Array.from(source.matchAll(/\bid: [`"]([^`"]+)[`"]/g), (match) => match[1]!))
}

describe("layout command split", () => {
  test("pages/layout.tsx only registers commands that genuinely need the tab layout", () => {
    const source = read("layout.tsx")
    const block = source.slice(source.indexOf('command.register("layout"'), source.indexOf("    return commands\n  })"))
    const unexpected = [...registeredIds(block)].filter((id) => !LAYOUT_BOUND.has(id))

    expect(unexpected).toEqual([])
  })

  test("application-wide commands live in layout-commands.tsx", () => {
    const ids = registeredIds(read("layout-commands.tsx"))

    for (const id of ["settings.open", "server.switch", "provider.connect", "theme.cycle", "language.cycle"]) {
      expect(ids.has(id)).toBe(true)
    }
  })

  test("every desktop menu command is reachable outside the tab layout", () => {
    const layoutBound = [...LAYOUT_BOUND]
    const missing = DESKTOP_MENU.flatMap((menu) => menu.items ?? [])
      .flatMap((item) => (item.type === "item" && item.command ? [item.command] : []))
      .filter((id) => !SESSION_SCOPED.has(id))
      .filter((id) => layoutBound.includes(id))

    // Every one of these is registered by the sidebar shell as well, so the menu works in both
    // layouts. A new entry showing up here is a menu item that would be dead in the sidebar layout.
    const shell = readFileSync(join(pages, "layout-sidebar", "shell.tsx"), "utf8")
    const covered = registeredIds(shell)
    expect(missing.filter((id) => !covered.has(id))).toEqual([])
  })
})
