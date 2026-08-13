# Windows baseline verification

Date: 14 August 2026  
Branch: `product-bootstrap`  
Upstream base: `8a55ba75b5b01fa1bbf1578a0a176cfc2a81d558`

## Environment

- Windows 10.0.26200
- Git 2.55.0.windows.3
- Node.js 24.12.0
- npm 11.6.2
- Bun 1.3.14
- Bun linker: `hoisted`
- Lockfile: frozen
- Successful isolated cache: `D:\bun-cache-opencode`

## Evidence

| Check | Working directory | Result |
|---|---|---|
| Frozen dependency installation | repository root | passed with `bun install --linker hoisted --frozen-lockfile` and isolated short cache |
| OpenCode typecheck | `packages/opencode` | passed: `bun typecheck` |
| App typecheck | `packages/app` | passed: `bun typecheck` |
| Desktop typecheck | `packages/desktop` | passed: `bun typecheck` |
| App production build | `packages/app` | passed: `bun run build` |
| Standalone Windows build | `packages/opencode` | passed: `bun run build --single --skip-install` |
| Standalone smoke test | build script | passed: generated `opencode.exe --version` returned the product-bootstrap version |
| Electron production build | `packages/desktop` | passed: `bun run build` |
| Windows package | `packages/desktop` | passed: `bun run package:win` |
| Reproducible setup contract | repository root | passed: `pwsh -NoProfile -File scripts/setup.ps1 -CacheDirectory D:\bun-cache-opencode` |
| Reproducible check contract | repository root | passed: `pwsh -NoProfile -File scripts/check.ps1` |
| Reproducible build contract | repository root | passed: `pwsh -NoProfile -File scripts/build.ps1` |
| Reproducible package contract | repository root | passed: `pwsh -NoProfile -File scripts/package.ps1` |
| Visible desktop start | packaged application | pending explicit UI-run approval |

## Produced artifacts

- `packages/opencode/dist/opencode-windows-x64/bin/opencode.exe`
- `packages/desktop/out/main/index.js`
- `packages/desktop/out/preload/index.js`
- `packages/desktop/out/renderer/index.html`
- `packages/desktop/dist/win-unpacked/OpenCode Dev.exe`
- `packages/desktop/dist/opencode-desktop-win-x64.exe` (184,176,370 bytes)
- `packages/desktop/dist/opencode-desktop-win-x64.exe.blockmap` (192,960 bytes)

## Existing non-blocking warnings

- Vite reports existing dynamic/static import overlap and large chunks.
- Electron Vite reports existing `eval` use in the bundled OpenCode Node server.
- Electron Builder reports missing optional non-Windows and ARM packages for this x64 package.
- `packages/desktop/native` is absent upstream and is reported as an optional missing source.
- None of these warnings changed the successful exit code of the relevant build or package step.

## Repair conclusions

The Windows `--single` local build must not run the build script's all-platform dependency installation against a verified hoisted workspace. All required Windows x64 native packages are installed by the frozen workspace setup, and the upstream `--skip-install` option preserves the correct Shiki dependency graph. The permanent build script must encode this distinction.
