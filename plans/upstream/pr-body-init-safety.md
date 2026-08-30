### Issue for this PR

Closes #42002
Closes #46161

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Two related plugin-init safety fixes in the opencode package, split into one commit each so they are reviewable on their own:

**Commit 1 — `fix(opencode): don't pin plugin version for 0.0.0-dev builds`** (`packages/opencode/src/config/config.ts`)

When the running opencode binary is a `0.0.0-dev` build, the install of `@opencode-ai/plugin` into each project config directory was pinned to that exact `0.0.0-dev.<commit>` version, which is unpublished and not resolvable from the npm registry. The previous code only skipped the pin when `InstallationLocal` was true, so a `bun run` against the dev build would fail to install the plugin at startup. The fix extends the existing guard to also skip the pin when `InstallationVersion.startsWith("0.0.0-dev")`. Issue #42002.

**Commit 2 — `fix(opencode): time out internal plugin init and config hooks`** (`packages/opencode/src/plugin/index.ts`)

`internalPlugins(flags)` and the per-hook `config?.(cfg)` notification were unbounded async calls. A misbehaving or hung plugin would block the entire plugin layer init forever (or, in the config hook case, silently hang the start-up sequence). This PR adds a 5-second `Effect.timeout` to both call sites, plus a stable per-plugin name (the plugin's own `name` if set, otherwise `internal-<index+1>`) and matching `logInfo` start/finish lines so the existing `logError` on timeout is actionable. The two changes are deliberately in one commit because they share the same debuggability story (a name to log against) and the same timeout scope (per-plugin init or per-hook call, not the layer).

Both changes are non-breaking: existing successful plugin inits are unchanged, and timeouts only fire on genuinely stuck plugins, which were already breaking the layer anyway.

### How did you verify your code works?

- Two commits, one file each:
  - `packages/opencode/src/config/config.ts` +4/-1
  - `packages/opencode/src/plugin/index.ts` +11/-5
- `bun typecheck` in `packages/opencode` passes (`tsgo --noEmit` exit 0) after `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus both commits.
- Manually traced both call sites:
  - `config.ts`: `npmSvc.install(dir, { add: [...] })` is the only place that pins `@opencode-ai/plugin`; the new guard sits next to the existing `InstallationLocal` check.
  - `plugin/index.ts`: `plugin(input)` and `(hook as any).config?.(cfg)` are the only async plugin calls inside the layer; both previously had no timeout and only logged on rejection, not on hang.

### Screenshots / recordings

N/A — server-side fix, no UI change.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/opencode` passes (`tsgo --noEmit` exit 0) after `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus both commits.
- [x] I have not included unrelated changes in this PR
