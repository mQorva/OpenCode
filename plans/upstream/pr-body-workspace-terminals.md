### Issue for this PR

Closes #48531

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Moves the workspace-terminal cache from route scope to app scope so terminals survive session-route changes.

Previously `TerminalProvider` (mounted in the session page) created a per-route cache and disposed all its terminal sessions when the route unmounted. Switching chats in the same workspace directory therefore tore down an open bottom terminal. This PR introduces an app-level `TerminalRegistryProvider` that owns a `createWorkspaceTerminalRegistry` (LRU with the same `MAX_TERMINAL_SESSIONS` limit) and makes `TerminalProvider` resolve its workspace sessions through that registry instead of a route-local map. The draft page also mounts `TerminalProvider` so a new chat can reopen the same bottom terminal before its first prompt.

### How did you verify your code works?

- `bun typecheck` (tsgo) passes in `packages/app`.
- `terminal.test.ts` passes 8/8, including two new tests for `createWorkspaceTerminalRegistry` (reuse across same key, LRU eviction with per-workspace separation).
- `git diff --check` clean; no unrelated changes.

### Screenshots / recordings

n/a (behaviour fix; no visual change)

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...workspace-terminals
- mQorva issue / context: n/a

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR