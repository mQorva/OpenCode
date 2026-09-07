### Issue for this PR

Closes #47681

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Two independent causes in `bootstrap.ts`, same effect: the app refetches data the bootstrap just
loaded.

**staleTime.** None of the bootstrap queries set one, so every entry is stale the moment it is
written and each consumer that mounts afterwards issues its own request. `BOOTSTRAP_STALE_TIME`
(30s) is applied to `config`, `project`, `providers`, `agents`, `path` and `references`. Thirty
seconds covers the startup burst without holding data past the point where a reload would matter;
all six are invalidated explicitly on the events that change them, so the window does not decide
freshness, only whether the same startup asks twice.

**Query key.** The directory-scoped keys were built from the raw directory the bootstrap was
handed, while consumers reach the same queries through the `PathKey` facade in `server-sync.tsx`,
which normalises backslashes to slashes. `bootstrapInstance` already computes `directoryKey()` for
its own bookkeeping but passes the raw path into `bootstrapDirectory`, so on Windows `C:\repo\app`
and `C:/repo/app` are two entries for one directory and the consumer side never hits what the
bootstrap loaded. `directoryKeyPart` puts the key through the same `pathKey` normalisation the
consumers use. Non-Windows paths are unchanged by `pathKey`, so this is a no-op there.

### How did you verify your code works?

New regression test in `packages/app/src/context/global-sync/bootstrap.test.ts`: both spellings of a
Windows directory map onto the same query key for `path`, `providers`, `agents` and `references`.
Verified it fails on unmodified `dev` — the two spellings produce different keys — and passes with
the change.

- `bun test --conditions=solid --preload ./happydom.ts src/context/global-sync/bootstrap.test.ts` in
  `packages/app`: 11 pass, 0 fail
- `tsgo -b` in `packages/app`: clean
- `prettier --check` on both changed files: clean
- `oxlint` on the changed file: 5 warnings, all present on `dev` before this change

The test file is additive against `dev`; no existing expectation was changed.

### Screenshots / recordings

Not a UI change.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
