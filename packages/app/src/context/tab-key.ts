import { sessionHref } from "@/utils/session-route"
import type { Tab } from "./tabs"

// Plain addressing for tabs, kept apart from the tab context itself.
//
// `tabs.tsx` pulls in the router, so anything importing it inherits that. These four are pure string
// functions used by logic modules and their tests, which must stay cheap to load — the type import
// above disappears at runtime, so this file drags nothing along.

export const draftHref = (draftID: string) => `/new-session?draftId=${encodeURIComponent(draftID)}`

export const tabHref = (tab: Tab) =>
  tab.type === "draft" ? draftHref(tab.draftID) : sessionHref(tab.server, tab.sessionId)

export const tabKey = (tab: Tab) => (tab.type === "draft" ? `draft:${tab.draftID}` : `${tab.server}\n${tabHref(tab)}`)
