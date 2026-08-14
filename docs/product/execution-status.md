# Product execution status

Updated: 14 August 2026

Status vocabulary: `planned`, `ready`, `in-progress`, `review`, `rework`, `accepted`, `blocked`.

| ID | Status | Evidence or next action |
|---|---|---|
| AP-00 | in-progress | Technical work may proceed; product name, GitHub organization, final branding, signing, and publication remain owner decision gates. |
| AP-01 | accepted | Full `upstream/dev` history checked out at `8a55ba75b5b01fa1bbf1578a0a176cfc2a81d558`; official remote renamed to `upstream`; `origin` deliberately absent. |
| AP-02 | accepted | Root contract, product plan, architecture decisions, upstream base, and resumable execution status are present and verified. |
| AP-03 | in-progress | Fresh install, package typechecks, App build, standalone Windows build with smoke test, Electron build, and installer are successful. One visible Windows desktop start remains. |
| AP-04 | accepted | Build causes were repaired within the bounded loop; Windows x64 CLI, Desktop build, NSIS installer, and blockmap succeed. Visible desktop runtime evidence is tracked separately by AP-03. |
| AP-05 | accepted | `scripts/setup.ps1`, `check.ps1`, `build.ps1`, and `package.ps1` passed parser review and real end-to-end execution. |
| AP-06 | accepted | Four separated inventories cover project/task/session persistence, providers/settings, integrated coding workspace, and Electron/renderer architecture; consolidated evidence is in `current-ui-inventory.md`. |
| AP-07 | accepted | Retain and incrementally consolidate the existing Solid renderer behind a product adapter; no second renderer or replacement desktop shell. |
| AP-08 | accepted | Durable Project -> Task -> Run contract, lifecycle, concurrency, completion evidence, adapter boundary, errors, and compatibility mapping are defined in `product-domain-contract.md`. |
| AP-09 | accepted | Product schemas, restrictive migration, lifecycle service, HttpApi adapter, Windows-safe generator fix, and focused DB/OpenAPI tests pass. |
| AP-10 | accepted | OpenRouter credential kinds, protected storage, paste-key and PKCE flows, verification, usage/credits/model sources, UI, errors, export, and diagnostics are defined in `openrouter-account-contract.md` from current official documentation. |
| AP-11 | in-progress | Implement protected secret storage, OpenRouter account metadata/verification, PKCE, projections, and graphical adapter around the existing provider engine. |
| AP-12 | planned | Implement project navigation and task list. |
| AP-13 | planned | Implement task workspace. |
| AP-14 | planned | Implement diff, review, and completion workspace. |
| AP-15 | planned | Implement graphical settings. |
| AP-16 | planned | Add selected direct API providers. |
| AP-17 | planned | Add approved Codex or Claude authentication paths. |
| AP-18 | planned | Implement and test upstream update automation. |
| AP-19 | planned | Complete product hardening and multi-perspective review. |
| AP-20 | planned | Build and verify Windows distribution. |
| AP-21 | planned | Publish open-source repository after owner approval. |
| AP-22 | planned | Add and verify macOS and Linux distributions after stable Windows baseline. |

## Current critical path

1. Implement AP-11 protected OpenRouter account integration without persisting plaintext secrets.
2. Build AP-12 project/task navigation against the accepted ProductTask HttpApi adapter.
3. Complete the visible AP-03 desktop start after owner confirmation.

## Bounded AP-03/AP-04 repair ledger

- Stable-root-cause limit: 3 meaningful fixes.
- Total limit in one contiguous execution: 8 meaningful fixes.
- Meaningful repair actions used: 5 of 8 across three root causes.
- A repeated command without a changed premise, new diagnosis, or concrete fix does not count as a fix and must not be used as an endless retry.

### Repair ledger

1. `tree-sitter-powershell` could not locate `node-gyp`; supplying the Node 24 npm `node-gyp` path removed that error.
2. Failed platform-wide installs left an incomplete hoisted dependency tree; a lockfile installation restored declared packages.
3. A clean install exposed missing-file errors in the shared Bun cache; an isolated cache removed shared-cache interference.
4. The first isolated cache hit a Windows `EPERM` patch rename; a new short cache at `D:\bun-cache-opencode` completed successfully.
5. The standalone single-platform build now uses its upstream `--skip-install` switch so its optional all-platform install does not replace the verified hoisted Shiki dependency graph.

## Baseline environment evidence

- Git: 2.55.0.windows.3
- Node.js: 24.12.0
- npm: 11.6.2
- Bun: 1.3.14, installed from the pinned npm package
- Windows install strategy: `bun install --linker hoisted --frozen-lockfile`, matching the repository's Windows CI linker choice while preserving `bun.lock`
- Verified cache override on this machine: `D:\bun-cache-opencode`
