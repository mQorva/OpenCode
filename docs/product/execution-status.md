# Product execution status

Updated: 14 August 2026

Status vocabulary: `planned`, `ready`, `in-progress`, `review`, `rework`, `accepted`, `blocked`.

| ID    | Status      | Evidence or next action                                                                                                                                                                                                                                                                                                                                                        |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AP-00 | in-progress | Technical work may proceed; product name, GitHub organization, final branding, signing, and publication remain owner decision gates.                                                                                                                                                                                                                                           |
| AP-01 | accepted    | Full `upstream/dev` history checked out at `8a55ba75b5b01fa1bbf1578a0a176cfc2a81d558`; official remote renamed to `upstream`; `origin` deliberately absent.                                                                                                                                                                                                                    |
| AP-02 | accepted    | Root contract, product plan, architecture decisions, upstream base, and resumable execution status are present and verified.                                                                                                                                                                                                                                                   |
| AP-03 | in-progress | Fresh install, package typechecks, App build, standalone Windows build with smoke test, Electron build, and installer are successful. One visible Windows desktop start remains.                                                                                                                                                                                               |
| AP-04 | accepted    | Build causes were repaired within the bounded loop; Windows x64 CLI, Desktop build, NSIS installer, and blockmap succeed. Visible desktop runtime evidence is tracked separately by AP-03.                                                                                                                                                                                     |
| AP-05 | accepted    | `scripts/setup.ps1`, `check.ps1`, `build.ps1`, and `package.ps1` passed parser review and real end-to-end execution.                                                                                                                                                                                                                                                           |
| AP-06 | accepted    | Four separated inventories cover project/task/session persistence, providers/settings, integrated coding workspace, and Electron/renderer architecture; consolidated evidence is in `current-ui-inventory.md`.                                                                                                                                                                 |
| AP-07 | accepted    | Retain and incrementally consolidate the existing Solid renderer behind a product adapter; no second renderer or replacement desktop shell.                                                                                                                                                                                                                                    |
| AP-08 | accepted    | Durable Project -> Task -> Run contract, lifecycle, concurrency, completion evidence, adapter boundary, errors, and compatibility mapping are defined in `product-domain-contract.md`.                                                                                                                                                                                         |
| AP-09 | accepted    | Product schemas, restrictive migration, lifecycle service, HttpApi adapter, Windows-safe generator fix, and focused DB/OpenAPI tests pass.                                                                                                                                                                                                                                     |
| AP-10 | accepted    | OpenRouter credential kinds, protected storage, paste-key and PKCE flows, verification, usage/credits/model sources, UI, errors, export, and diagnostics are defined in `openrouter-account-contract.md` from current official documentation.                                                                                                                                  |
| AP-11 | in-progress | Protected Windows secret storage, paste-key and PKCE flows, safe account/model projections, local API, generated SDK, engine credential projection, account metadata, key replacement, catalog details, and OpenRouter-filtered model selection pass focused checks and production builds. One explicitly approved live verification remains. |
| AP-12 | accepted    | The graphical project task list is integrated into the existing home renderer and generated ProductTask client, including create, edit, archive, restore, reopen, archived visibility, and explicit task/session navigation. Focused lint, App typecheck, 722 App tests, and the App production build pass.                                                                                  |
| AP-13 | planned     | Implement task workspace.                                                                                                                                                                                                                                                                                                                                                      |
| AP-14 | planned     | Implement diff, review, and completion workspace.                                                                                                                                                                                                                                                                                                                              |
| AP-15 | planned     | Implement graphical settings.                                                                                                                                                                                                                                                                                                                                                  |
| AP-16 | planned     | Add selected direct API providers.                                                                                                                                                                                                                                                                                                                                             |
| AP-17 | planned     | Add approved Codex or Claude authentication paths.                                                                                                                                                                                                                                                                                                                             |
| AP-18 | planned     | Implement and test upstream update automation.                                                                                                                                                                                                                                                                                                                                 |
| AP-19 | planned     | Complete product hardening and multi-perspective review.                                                                                                                                                                                                                                                                                                                       |
| AP-20 | planned     | Build and verify Windows distribution.                                                                                                                                                                                                                                                                                                                                         |
| AP-21 | planned     | Publish open-source repository after owner approval.                                                                                                                                                                                                                                                                                                                           |
| AP-22 | planned     | Add and verify macOS and Linux distributions after stable Windows baseline.                                                                                                                                                                                                                                                                                                    |

## Current critical path

1. Build AP-13 task workspace and safe task-run/session orchestration against the accepted ProductTask HttpApi adapter.
2. Complete the one explicitly approved live AP-11 OpenRouter verification.
3. Complete the visible AP-03 desktop start after owner confirmation.

## Bounded repair policy

- Every contiguous implementation or verification loop may address at most three distinct, evidenced failure causes.
- An unchanged retry without a changed premise is prohibited.
- At the limit, preserve the reproducible state and document the exact blocker, attempted fixes, and owner options before continuing.
- A green verification closes the loop; the next independently scoped package receives a fresh limit.

### AP-11 protected-secret verification ledger

- Limit: 3 distinct failure causes.
- Causes used: 2 of 3; loop closed green.
- Cause 1: Protected credential deletion removed metadata before the OS secret, preventing a clean retry after a secret-store failure. Secret removal now precedes metadata deletion and the retry behavior is covered by a focused test.
- Cause 2: Updating only a protected value attempted an empty label update after replacing the secret. The database update now runs only when a label was supplied.
- Evidence: Core typecheck, 9 credential/protected-secret tests, migration synchronization check, Desktop typecheck, 13 OS-store/bridge tests, and complete Desktop production build pass.

### AP-11 account-service verification ledger

- Limit: 3 distinct failure causes.
- Causes used: 2 of 3; loop closed green.
- Cause 1: Raw OpenRouter pricing is transported as decimal strings while the safe product projection uses validated numbers; the adapter now parses and rejects invalid or negative prices.
- Cause 2: A rejected replacement candidate initially marked the still-valid active account as needing attention. Candidate verification and active-account re-verification are now separate, and a regression test preserves the active state and secret.
- Evidence: Schema typecheck and 6 schema tests; Core typecheck, 17 credential/client/account tests, migration synchronization check; safe model-cache fallback and retryable deletion tests.

### AP-11 local-API verification ledger

- Limit: 3 distinct failure causes.
- Causes used: 1 of 3; loop closed green.
- Cause 1: The installed Effect HttpApi version names its DELETE builder `delete`, not `del`; the adapter now uses the repository's established form.
- Evidence: OpenCode typecheck, 19 public OpenAPI tests including six OpenRouter routes and response-secret exclusions, Desktop typecheck, and complete Desktop production build pass.
- Live boundary: No real OpenRouter credential or paid/provider request was used. Live verification remains an explicit owner gate.

### AP-11 PKCE verification ledger

- Limit: 3 distinct failure causes per contiguous loop.
- PKCE primitive causes used: 3 of 3; loop closed green. State is bound through the documented callback URL rather than an undocumented authorization parameter; provider denial precedes missing-code classification; Effect listener lifecycle and types were corrected.
- Account integration causes used: 0 of 3; loop closed green.
- API adapter causes used: 0 of 3; loop closed green.
- Final verification causes used: 1 of 3; loop closed green. The only failure was an incorrect OpenAPI test filter; the existing public OpenAPI test path was then selected once.
- Evidence: Schema typecheck and 7 schema tests; Core typecheck and 20 focused PKCE/client/account tests; OpenCode typecheck and 19 public OpenAPI tests; generated client typecheck. Successful, rejected, cancelled, wrong-state, timeout, protected-store-failure, and secret-exclusion paths are covered.
- Security boundary: callback verifier, state, one-time code, and exchanged key remain transient in the core process and are absent from API projections and persisted account/credential rows.

### AP-11 graphical-account verification ledger

- Limit: 3 distinct failure causes; loop closed green at 3 of 3.
- Cause 1: The initial SDK response helper used an unnecessary generic assertion. It now validates missing data explicitly and reports a localized protocol message.
- Cause 2: Closing the dialog stopped only renderer polling while leaving the server-side PKCE attempt active. Cleanup now requests cancellation for every still-pending attempt.
- Cause 3: Renderer polling had no local stop condition if a server remained incorrectly pending. It now stops at the provider expiry and at a fixed maximum of 800 polls, then cancels the server attempt.
- Evidence: regenerated v2 SDK includes OpenRouter and Product Task namespaces; SDK and App typechecks pass; focused lint has zero findings; App and complete Desktop production builds pass.
- Runtime boundary: The visible dialog and real OpenRouter redirect have not been exercised because visible app launch and productive credentials require owner approval.

### AP-11 model-and-replacement verification ledger

- Limit: 3 distinct failure causes; loop closed green at 2 of 3.
- Cause 1: A successful credential mutation was initially coupled to fallible projection refreshes and could therefore be presented as failed. Mutation responses now update local account/catalog resources immediately; only PKCE's separate follow-up reads are settled and reported independently.
- Cause 2: The catalog search initially relied only on a placeholder. It now has an explicit accessible name.
- A review suggestion to lowercase standalone German field labels was rejected because it conflicts with the repository rule requiring normal German capitalization at the start of independent UI labels.
- Evidence: The existing model manager now supports an optional provider filter and leaves unfiltered behavior unchanged; focused lint is clean for new code, App typecheck passes, and the App production build passes.
- UI scope: The account dialog now shows safe usage, remaining limit, verification and expiry timestamps, supports protected key replacement, displays searchable model capabilities/context/pricing, and opens model visibility management filtered to OpenRouter.

### AP-12 graphical-task verification ledger

- Limit: 3 distinct failure causes; loop closed green at 3 of 3.
- Cause 1: Solid's resource refetch may return a value or a promise. Failure recovery now awaits it inside a guarded block instead of calling `.catch()` on an uncertain return type.
- Cause 2: Dialogs and actions initially resolved the currently selected server and project only when the mutation ran. Every action now binds its original server/project target so a navigation change cannot write to another target.
- Cause 3: A successful task mutation was initially coupled to a fallible follow-up read and could therefore be presented as failed. Mutation responses now update the local task projection directly; a refetch is reserved for reconciling actual mutation failures.
- Evidence: focused lint has zero findings; App typecheck passes; all 722 App tests pass with 3,019 expectations; the App production build exits with code 0.
- Scope boundary: Starting a task run is deliberately not part of AP-12. AP-13 must create and link a coding session through one safe orchestration path so a partial UI sequence cannot leave an orphaned active run.

### Product i18n fallback verification ledger

- Limit: 3 distinct failure causes; loop closed green at 1 of 3.
- Cause 1: The upstream parity test required every new product key in all 64 locale dictionaries, although only German and English product translations exist. The policy now explicitly permits English runtime fallback for the `home.tasks.*` and `settings.openrouter.*` namespaces in other upstream locales.
- Evidence: German and English contain complete product keys; all 5 parity tests pass with 979 expectations; the complete App test suite passes.

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
