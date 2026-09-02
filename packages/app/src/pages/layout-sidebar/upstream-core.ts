// Seam for the parts of upstream OpenCode that carry no UI.
//
// `upstream.ts` re-exports components too, so importing it pulls in the router, dialogs and the
// debug bar. Pure logic modules — and the tests around them — must not drag that in: it makes them
// slow and, under `bun test`, the router fails to resolve when several suites share a process.
// Everything here is data or a plain function, so this file stays cheap to import.
//
// Same rule as `upstream.ts`: an upstream sync that changes one of these signatures breaks exactly
// one file. Do not import upstream modules directly from the pure modules in this folder.

export { ServerConnection } from "@/context/server"
export { tabKey } from "@/context/tab-key"
export type { DraftTab, SessionTab, Tab } from "@/context/tabs"
export { pathKey } from "@/utils/path-key"

export type { LocalProject } from "@/context/layout"
export type { Session } from "@opencode-ai/sdk/v2/client"
