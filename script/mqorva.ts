import { spawnSync } from "node:child_process"

import manifest from "../mqorva-version.json"

export const MQORVA = {
  edition: manifest.edition,
  revision: manifest.revision,
  upstream: manifest.upstream,
}

export function mqorvaBuildCommit(cwd: string) {
  const commit = spawnSync("git", ["rev-parse", "--short=10", "HEAD"], { cwd, encoding: "utf8" })
  const value = commit.status === 0 ? commit.stdout.trim() : "unknown"
  if (value === "unknown") return value

  const status = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" })
  return status.status === 0 && status.stdout.trim() ? `${value}-dirty` : value
}

export function mqorvaDisplayVersion(buildCommit: string) {
  return `OpenCode ${MQORVA.upstream.version} · ${MQORVA.edition} r${MQORVA.revision} · ${buildCommit}`
}
