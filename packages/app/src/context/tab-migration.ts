import type { ServerConnection } from "./server"
import type { Tab } from "./tabs"

export function migrateTabs(value: unknown, fallback: ServerConnection.Key): Tab[] {
  if (!Array.isArray(value)) return []
  return value.flatMap<Tab>((tab) => {
    if (!tab || typeof tab !== "object") return []
    if ("server" in tab && typeof tab.server !== "string") return []
    const server = ("server" in tab ? tab.server : fallback) as ServerConnection.Key
    if (tab.type === "session" && typeof tab.sessionId === "string") {
      return [{ type: tab.type, server, sessionId: tab.sessionId }]
    }
    if (
      tab.type === "draft" &&
      typeof tab.draftID === "string" &&
      typeof tab.directory === "string" &&
      (tab.worktree === undefined || typeof tab.worktree === "string")
    ) {
      const productTask = (() => {
        if (!("productTask" in tab) || tab.productTask === undefined) return undefined
        const value = tab.productTask
        if (!value || typeof value !== "object") return undefined
        if (!("taskID" in value) || typeof value.taskID !== "string") return undefined
        if (!("expectedVersion" in value) || !Number.isInteger(value.expectedVersion) || value.expectedVersion < 1)
          return undefined
        if (
          !("trigger" in value) ||
          (value.trigger !== "new" && value.trigger !== "continue" && value.trigger !== "retry" && value.trigger !== "reopen")
        )
          return undefined
        if (!("sessionID" in value) || typeof value.sessionID !== "string") return undefined
        if (!("messageID" in value) || typeof value.messageID !== "string") return undefined
        return {
          taskID: value.taskID,
          expectedVersion: value.expectedVersion,
          trigger: value.trigger,
          sessionID: value.sessionID,
          messageID: value.messageID,
        }
      })()
      return [{
        type: tab.type,
        server,
        draftID: tab.draftID,
        directory: tab.directory,
        worktree: tab.worktree,
        productTask,
      }]
    }
    return []
  })
}
