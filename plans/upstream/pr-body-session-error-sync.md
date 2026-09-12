### Issue for this PR

Closes #48530

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

The global sync reducer now handles `session.error` events instead of ignoring them. When a session turn fails, the reducer resets the session status to idle and marks the last assistant message with an error and `finish: "error"`. A new optional `notifyError` callback is threaded into `applyDirectoryEvent`; the server-sync layer uses it to show a toast with the error message (reusing the existing `notification.session.error.*` i18n keys).

### How did you verify your code works?

- `bun typecheck` (tsgo) passes in `packages/app`.
- `event-reducer.test.ts` passes 17/17, including a new test asserting the status reset and assistant error marker on `session.error`.
- `git diff --check` clean; no unrelated changes.

### Screenshots / recordings

n/a (server/state behaviour; the toast is the only UI, using existing keys)

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...session-error-sync
- mQorva issue / context: n/a

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
