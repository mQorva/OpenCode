import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { ShellID } from "@/tool/shell/id"
import { evaluate } from "./evaluate"

export const Level = PermissionV1.Level
export type Level = PermissionV1.Level

export const DEFAULT_LEVEL: Level = "workspace"

// Permissions the "ask" level turns into a prompt. Reads (read, grep, glob, list,
// lsp) stay silent on every level.
const ASKABLE = ["edit", ShellID.ToolID, "webfetch", "websearch"]

// The doom loop prompt guards against a model repeating the same call forever. That
// is a spend guard, not a permission, so "full" must not switch it off. The doom
// loop path reads the agent ruleset rather than the session one and would be
// unaffected anyway, but keeping the exception here means the intent lives in the
// code instead of depending on which ruleset a caller happens to pass.
const NEVER_ALLOWED = "doom_loop"

// Rules the level contributes, to be appended after the agent and session rulesets.
// "ask" and "full" are symmetric: each shifts one step along allow -> ask -> deny and
// neither touches deny, so a level can never grant more than the agent allows.
export function rules(level: Level, ruleset: PermissionV1.Ruleset): PermissionV1.Rule[] {
  if (level === "workspace") {
    // Skills are read-only loads (SKILL.md plus a sampled file list); the actual risk sits in
    // the downstream tools the skill then drives, which keep their own permission prompts.
    // So on the workspace level a skill load is a silent read: if the current rules would ask,
    // promote it to allow. An explicit agent/session skill rule still wins — deny stays deny and
    // an explicit ask stays an ask — so we never grant more than the configuration allows.
    if (ruleset.some((rule) => rule.permission === "skill")) return []
    const skill = evaluate("skill", "*", ruleset)
    if (skill.action !== "ask") return []
    return [{ permission: "skill", pattern: "*", action: "allow" }]
  }

  if (level === "ask")
    // The filter is load-bearing: opencode writes its defaults as "*": "allow" or
    // "*": "deny" on the wildcard permission rather than under the concrete key, so
    // appending edit/bash/webfetch/websearch unconditionally would soften an agent's
    // deny (explore, compaction) into a prompt.
    return ASKABLE.filter((permission) => evaluate(permission, "*", ruleset).action === "allow").map((permission) => ({
      permission,
      pattern: "*",
      action: "ask",
    }))

  return ruleset
    .filter((rule) => rule.action === "ask" && rule.permission !== NEVER_ALLOWED)
    .map((rule) => ({ ...rule, action: "allow" as const }))
}

// The ruleset a session evaluates against: agent defaults, session overrides, then
// the level on top.
export function forSession(input: {
  agent: PermissionV1.Ruleset
  session?: PermissionV1.Ruleset
  level?: Level
}): PermissionV1.Rule[] {
  const ruleset = [...input.agent, ...(input.session ?? [])]
  return [...ruleset, ...rules(input.level ?? DEFAULT_LEVEL, ruleset)]
}
