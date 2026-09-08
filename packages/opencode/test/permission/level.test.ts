import { describe, expect, test } from "bun:test"
import { Permission } from "../../src/permission"

// Mirrors the shape opencode's agents produce in src/agent/agent.ts: defaults grant
// "*", then narrower rules carve out what still needs a prompt.
const defaults = Permission.fromConfig({
  "*": "allow",
  doom_loop: "ask",
  external_directory: { "*": "ask", "/tmp/*": "allow" },
  read: { "*": "allow", "*.env": "ask", "*.env.example": "allow" },
})
const build = Permission.merge(defaults, Permission.fromConfig({ question: "allow" }))
const plan = Permission.merge(defaults, Permission.fromConfig({ edit: { "*": "deny" } }))
const explore = Permission.merge(defaults, Permission.fromConfig({ "*": "deny", read: "allow", grep: "allow" }))

const action = (ruleset: ReturnType<typeof Permission.forSession>, permission: string, pattern = "*") =>
  Permission.evaluate(permission, pattern, ruleset).action

describe("permission level", () => {
  test("workspace leaves the agent ruleset untouched", () => {
    const ruleset = Permission.forSession({ agent: build, level: "workspace" })
    expect(ruleset).toEqual([...build])
    expect(action(ruleset, "edit")).toBe("allow")
    expect(action(ruleset, "external_directory")).toBe("ask")
    expect(action(ruleset, "read", "secrets.env")).toBe("ask")
  })

  test("workspace is the default when no level is set", () => {
    expect(Permission.forSession({ agent: build })).toEqual([...build])
  })

  test("ask prompts for writes, shell and network but not for reads", () => {
    const ruleset = Permission.forSession({ agent: build, level: "ask" })
    expect(action(ruleset, "edit")).toBe("ask")
    expect(action(ruleset, "bash")).toBe("ask")
    expect(action(ruleset, "webfetch")).toBe("ask")
    expect(action(ruleset, "websearch")).toBe("ask")
    expect(action(ruleset, "read")).toBe("allow")
    expect(action(ruleset, "grep")).toBe("allow")
  })

  test("ask never softens a deny into a prompt", () => {
    const ruleset = Permission.forSession({ agent: explore, level: "ask" })
    expect(action(ruleset, "edit")).toBe("deny")
    expect(action(ruleset, "bash")).toBe("deny")
    expect(action(ruleset, "read")).toBe("allow")
  })

  test("full stops asking about external directories and env reads", () => {
    const ruleset = Permission.forSession({ agent: build, level: "full" })
    expect(action(ruleset, "external_directory")).toBe("allow")
    expect(action(ruleset, "read", "secrets.env")).toBe("allow")
    expect(action(ruleset, "edit")).toBe("allow")
  })

  test("full does not lift an agent's deny", () => {
    const ruleset = Permission.forSession({ agent: plan, level: "full" })
    expect(action(ruleset, "edit")).toBe("deny")
  })

  test("full keeps the doom loop guard asking", () => {
    const ruleset = Permission.forSession({ agent: build, level: "full" })
    expect(action(ruleset, "doom_loop")).toBe("ask")
  })

  test("a session ruleset still overrides the agent, and the level applies on top", () => {
    const session = Permission.fromConfig({ webfetch: "deny" })
    const ruleset = Permission.forSession({ agent: build, session, level: "ask" })
    expect(action(ruleset, "webfetch")).toBe("deny")
    expect(action(ruleset, "edit")).toBe("ask")
  })

  test("workspace treats skill as a silent read, promoting ask to allow", () => {
    // An agent that would prompt for skills (e.g. a "*": "ask" baseline) is
    // relaxed on the workspace level: skill loads are read-only.
    const restrictive = Permission.merge(defaults, Permission.fromConfig({ "*": "ask", read: "allow", grep: "allow" }))
    const ruleset = Permission.forSession({ agent: restrictive, level: "workspace" })
    expect(action(ruleset, "skill")).toBe("allow")
  })

  test("workspace does not lift an explicit skill deny", () => {
    const agent = Permission.merge(defaults, Permission.fromConfig({ skill: { "*": "deny" } }))
    const ruleset = Permission.forSession({ agent, level: "workspace" })
    expect(action(ruleset, "skill")).toBe("deny")
  })

  test("workspace keeps an explicit skill ask as an ask", () => {
    const agent = Permission.merge(defaults, Permission.fromConfig({ skill: { "*": "ask" } }))
    const ruleset = Permission.forSession({ agent, level: "workspace" })
    expect(action(ruleset, "skill")).toBe("ask")
  })
})
