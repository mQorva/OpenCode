# Plan: Permission-Dock – „einmalig / für diese Session / für dieses Projekt"

Stand: **Umsetzung verifiziert (10.09.2026)**. Typechecks grün: `schema`, `core`,
`opencode`, `client`, `app`, `protocol`, `server`, `sdk-next`. Tests grün:
`core/test/permission.test.ts` 18/18 (inkl. 2 neue), `opencode/test/permission/*`
124/124 (inkl. 2 neue), App-Unit-Tests `server-compat`/`permission-auto-respond`/
`session-composer-state` 34/34.

## Ausgangslage

Der Permission-Dock (`session-permission-dock.tsx`) bot bisher drei Antworten:
`verweigern`, `für dieses Projekt immer erlauben` (bzw. „Always allow for this
project") und `einmal erlauben`. Es fehlte die **Session-Ebene**: im Projekt-Zugriff
fragte OpenCode bei jeder einzelnen Datei (Ordner, Dateiname, Unterordner …) erneut
nach, weil jeder Tool-Aufruf ein eigener Request mit eigenem Pattern ist.

Ziel (Ronny): Drei Stufen im Dock — `einmalig`, `Session`, `Projekt`. Der lange
„immer"-Zusatz entfällt, da der Geltungsbereich aus dem Button klar ist.

## Umsetzung

### 1. Wire-Format: `Reply` um `"session"` erweitert

- `packages/schema/src/permission.ts` (`Permission.Reply`, V2-Protokoll)
- `packages/schema/src/v1/permission.ts` (`PermissionV1.Reply`, Legacy-Route
  `/session/:sessionID/permissions/:permissionID`)

Additiv, kein Break. Regeneriert: `packages/client` (`bun run generate`) und
`packages/sdk` (`bun ./js/script/build.ts`).

### 2. Server: `"session"` = In-Memory-Freigabe pro Session

- **V1-Runtime** `packages/opencode/src/permission/index.ts`: neuer
  `state.sessionApproved: Map<SessionID, Rule[]>` im Instanz-State. `ask()` wertet
  `ruleset + approved + sessionApproved[sessionID]` aus (Session-Regeln hinten =
  höchste Priorität). `reply("session")` schiebt die `always`-Patterns nur in den
  Session-Scope und löst wartende Requests derselben Session auf; andere Sessions
  bleiben unberührt. („always" = instance-weit in-memory, bleibt wie bisher.)
- **V2-Server** `packages/core/src/permission.ts`: analoge
  `sessionApproved: Map<SessionID, Rule[]>`, angehängt in `PermissionV2.configured`,
  `reply("session")` schreibt **nichts** in `PermissionSaved` (DB), nur in den
  In-Memory-Scope.

### 3. UI: vier Buttons + kürzere Labels

- `session-permission-dock.tsx`: `verweigern · einmalig · für diese Session ·
  für dieses Projekt` (Projekt nur bei persistierbaren Patterns, wie bisher).
- `session-composer-state.ts`: `decide` akzeptiert `"session"`.
- `server-compat.ts`: `CompatiblePermissionApi.reply` nimmt `"session"` an (die App
  routed Permission-Antworten über die Legacy-Route); `createCompatibleApi`
  kastet Shape/Implementation auf `CompatibleApi`, weil das gvendorte
  `@opencode-ai/client@1.17.13-v2` den neuen Literal nicht kennt.
- i18n `en.ts` / `de.ts`: `allowOnce` = einmalig / Allow once,
  `allowSession` = für diese Session / For this session, `allowProject` =
  für dieses Projekt / For this project.

### 4. Dedup (Punkt 2.4 geprüft)

- **V1** hatte das schon (identische Requests derselben Session teilen eine
  `Deferred`-Instanz, `permission/index.ts`).
- **V2** fehlte es — ergänzt in `PermissionV2.create`: identische `(sessionID,
  action, resources)` teilen eine Pending-Zeile. Ein `reply` löst alle Wartenden
  gemeinsam auf. Getestet.

## Verifikation

Siehe Stand-Zeile oben. Manuell: Skill-Erstellung im Projekt-Zugriff → einmal
„für diese Session" → alle Folge-Fragen (Ordner/Dateiname/Unterordner) laufen in
diesem Chat durch; andere Sessions fragen weiterhin.

## Out of Scope

- TUI-Prompt (`packages/tui/.../permission.tsx`) und `opencode run` bleiben bei
  once/always/reject (V1-kompatible Flächen, keine mQorva-only Features).
- ACP-Antwortoptionen unverändert.