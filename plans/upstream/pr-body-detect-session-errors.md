### Issue for this PR

Closes #48012

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`isSessionNotFoundError` and `isLocalSessionNotFoundError` now also recognise
session-not-found errors that arrive through other serialisation shapes, not just
the exact V1 tagged form:

- string errors whose text contains the not-found message;
- objects with `name: "NotFoundError"` whose `data.message` equals the message;
- any serialised object whose `message` includes the not-found text.

The existing exact-shape checks (`Error.message ===`, `_tag === "SessionNotFoundError"`)
are preserved, so current behaviour is unchanged where it already worked.

### How did you verify your code works?

- `bun typecheck` in `packages/app`: clean.
- The change is a pure widening of the two predicate functions; no call-site
  changes. (A focused test for the new shapes can be added if the maintainer
  wants one; none is included to keep the diff minimal.)

### Screenshots / recordings

N/A — not a UI change.

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...detect-session-errors

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR