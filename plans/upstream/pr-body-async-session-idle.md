### Issue for this PR

Closes #45610

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

The `promptAsync` HTTP handler in `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts` forks the prompt into a background fiber and only publishes a `Session.Event.Error` when the prompt fails. The session's `SessionStatus` entry was never reset in that error path, so the session stays in its last non-idle status (`busy` or `retry`) and downstream callers see it as still running.

This PR adds a single `statusSvc.set(sessionID, { type: "idle" })` call inside the `Effect.catchCause` block of `promptAsync`, wrapped in `Effect.ignore` so a transient status write failure cannot mask the original error event. The fix mirrors what `prompt.cancel` already does on the synchronous loop path and keeps the rest of the handler unchanged.

The `idle` status also publishes the existing `SessionStatus.Event.Idle` event through the same `statusSvc.set` path, so subscribers (UI, TUI, plugin hooks) get a consistent transition they already handle.

### How did you verify your code works?

- The change is one line in one file: `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts` (the only Hunk in `git diff upstream/dev..HEAD`).
- Manually traced the call path: `promptAsync` → `requireSession` → `promptSvc.prompt` → `Effect.catchCause` → `Effect.forkIn`. The new call sits inside the catch block, so it only runs when the prompt fiber actually fails.
- `SessionStatus.set({ type: "idle" })` is the same API used by `SessionPrompt.cancel` and other status reset paths; verified it deletes the map entry and publishes the `Idle` event.
- `bun typecheck` runs cleanly in the package after `bun install` in the worktree (`tsgo --noEmit` exit 0, against `upstream/dev` head `dc4449df0d` + this one-line change).

### Screenshots / recordings

N/A — server-side fix, no UI change.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/opencode` passes (`tsgo --noEmit` exit 0) after a fresh `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus this one-line change.
- [x] I have not included unrelated changes in this PR
