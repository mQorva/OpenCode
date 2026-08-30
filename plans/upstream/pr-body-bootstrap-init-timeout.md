### Issue for this PR

Closes #46166

### Type of change

- [ ] Bug fix
- [ ] New feature
- [x] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`InstanceBootstrap.run` in `packages/opencode/src/project/bootstrap.ts` awaits `init()` on
each per-instance service (`lsp`, `share`, `format`, `vcs`, `snapshot`, `project`) inside an
`Effect.forEach` with `concurrency: "unbounded"`. Each init was unbounded, the previous
`catchCause` only fired on rejection, and there was no per-service log line, so a single
misbehaving service could swallow the warning, and there was no signal at all on a hang.

This PR keeps the concurrency shape (`unbounded`, all services start in parallel) and adds:

- A 10-second `Effect.timeout` around each individual `service.init()`. On timeout the
  service's `init` is interrupted, the rest of the bootstrap continues, and a
  `logWarning("instance service init failed", { service, cause })` is emitted.
- A per-service `logInfo` start and finish line (`"instance service init started"` /
  `"instance service init completed"`) so the bootstrap log is navigable.
- A single `logInfo("bootstrap completed", { directory })` at the end so callers can
  confirm the layer reached the steady state.

The 10-second budget is a deliberate trade-off: a healthy service `init` is bounded by
local state materialization and should return in well under a second; 10 seconds is large
enough not to fire on slow disks, small enough that a hung init does not block the rest
of the bootstrap indefinitely. The previous behaviour was effectively "unbounded", so
this is strictly more recoverable, never less.

### How did you verify your code works?

- Single file: `packages/opencode/src/project/bootstrap.ts`, +16/-2.
- `bun typecheck` in `packages/opencode` passes (`tsgo --noEmit` exit 0) after
  `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus this commit.
- Manually traced: `bootstrap.run` is the only caller of the listed services' `init()` in
  this layer; the new `Effect.timeout` is scoped to that one `Effect.forEach` body. The
  outer `Effect.withSpan("InstanceBootstrap.init")` and the `Effect.withSpan` on `run`
  are unchanged, so the trace tree stays the same.

### Screenshots / recordings

N/A — server-side, no UI change.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/opencode` passes (`tsgo --noEmit` exit 0) after
    `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus this commit.
- [x] I have not included unrelated changes in this PR
