### Issue for this PR

Closes #48014

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

The global event stream (`server-sdk.tsx`) reconnected after every failure with
the same fixed `RECONNECT_DELAY_MS` delay. This adds an exponential backoff:

- a `consecutiveErrors` counter resets on every successfully consumed event and
  increments on each catch;
- the reconnect wait becomes
  `min(5000, RECONNECT_DELAY_MS * 1.5 ** min(consecutiveErrors, 8))`,
  so repeated failures back off from 250 ms up to a 5 s cap, while a healthy
  stream keeps the fast cadence.

No other behaviour in the loop changes.

### How did you verify your code works?

- `bun typecheck` in `packages/app`: clean.
- The change is a 5-line delta restricted to the reconnect wait; the counter is
  scoped to the loop invocation and reset on any received event, so a recovered
  stream returns to the fast path immediately.

### Screenshots / recordings

N/A — not a UI change.

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...event-reconnect-backoff

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR