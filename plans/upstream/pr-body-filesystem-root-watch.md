### Issue for this PR

Closes #45611

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

The `FileWatcher` service in `packages/core/src/filesystem/watcher.ts` is currently created for every location the user opens, even when that location is a filesystem root (`/` on POSIX, `C:\` on Windows) or an empty string. `@parcel/watcher` then tries to subscribe a recursive native watch on the entire root, which either errors out on POSIX (denied permissions on `/proc`, `/sys`, etc.) or fans out across the whole drive on Windows and saturates the event bus with `add`/`change`/`unlink` for files OpenCode has no business tracking.

This PR adds a small `isRootOrSystemDirectory` helper and gates the two `subscribe` call sites in the watcher layer on it: the project-directory subscribe and the resolved VCS (`.git`) directory subscribe both skip when their target is a root. Everything else in the layer is unchanged.

`isRootOrSystemDirectory` is intentionally narrow:

- `""` (empty) → skip
- `/` → skip
- `C:`, `D:`, … (Windows drive root, with or without trailing slash) → skip
- everything else → keep watching

I did **not** add a regression test. The existing `watcher.test.ts` uses temp directories and does not exercise the root case, and `tsgo --noEmit` does not enforce behavioural contracts. A root-path test would need platform-specific path constants and a mock for `@parcel/watcher`'s `subscribe`, which is more code than the two-line guard warrants. Happy to add one if a maintainer wants it.

### How did you verify your code works?

- `git diff upstream/dev..HEAD` shows a single file: `packages/core/src/filesystem/watcher.ts`, +7/-2.
- `bun typecheck` in `packages/core` passes after `bun install` in the worktree (`tsgo --noEmit` exit 0, against `upstream/dev` head `dc4449df0d` plus this change).
- Manually traced the two `subscribe` call sites: the project directory at `location.directory` and the resolved `.git` at `vcs`. Both are passed in from the location/git services and are the only places where root-path subscriptions would be created.

### Screenshots / recordings

N/A — no UI change.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/core` passes (`tsgo --noEmit` exit 0) after `bun install` in the worktree, against `upstream/dev` head `dc4449df0d` plus this change. No regression test added (see "What does this PR do?").
- [x] I have not included unrelated changes in this PR
