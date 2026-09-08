### Issue for this PR

Closes #40736
Closes #33940
Closes #46783

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

The snapshot store is worktree-global (`snapshot/<project>/<worktree-hash>`), but the
patch file list was computed from `git diff --cached --name-only <hash>` over the whole
staged worktree delta. Any change another session, subagent, editor, or external process
makes between two snapshot captures landed in that list. `revert()` then wrote those files
back or — when a path was absent from the target tree — deleted it with `fs.remove`
unconditionally. That produced real data loss (reported as issues #46783, #33940,
and the cross-session attribution in #40736).

This PR makes the destructive half of revert conservative on three independent axes:

1. **Patch list scoping.** `patch(hash, files?)` now accepts the set of paths the owning
   turn actually reported (write/edit/apply_patch report `metadata.filepath` / `metadata.files`
   / an `input.filePath`). The session processor (the only production caller) collects these
   paths per turn via `completeToolCall` and passes them in, so the diff `--` pathspec is
   trimmed to that set. Unrelated worktree changes can no longer enter the patch list, and a
   revert therefore cannot touch or delete them. Unknown/empty reported sets stay
   conservative (no files). The optional parameter keeps the debug CLI and existing tests
   working.

2. **Ownership guard between capture and revert.** `track(owner?)` now records an
   owner-plus-generation ledger inside the store (`owner-log.json`). `revert(patches, owner?)`
   refuses when a different owner captured a snapshot after the revert target. In the
   production caller the owner is the session ID, so one session can no longer roll back over
   work another session captured in the same worktree in between (the exact setup in #33940 /
   #40736). Legacy stores without a ledger, or patches whose hashes predate tracking, are
   left accessible rather than locked out.

3. **Delete budget.** Deleting files is the destructive half of a revert. The pre-fix code
   deleted every patch file absent from the target tree with no ceiling, no dry run, and no
   question — in the underlying report 421 times in five seconds. This PR caps deletions
   (`maxDeletions = 100`); exceeding the cap aborts the remainder of the revert. Combined
   with the patch scoping in (1), the worst case is now bounded instead of a bulk unlink.

Additionally, `diffFull` (used to render the diff after a revert) is bounded so a large
revert cannot OOM the server loop: a small unified-diff context (`diffContext = 3`),
per-file and total patch budgets (reusing the module's existing `limit`), and a
`yield* Effect.yieldNow` per batch so the loop stays interruptible.

### How did you verify your code works?

- `bun typecheck` in `packages/opencode` exits 0.
- `bun test test/snapshot/snapshot.test.ts` — 57 pass / 3 skip / 0 fail, including four new
  regression tests:
  - `patch restricts the file list to tool-reported paths` (foreign file untouched/absent)
  - `patch with an empty tool list produces no files`
  - `revert refuses when another run tracked since the target snapshot` (file survives)
  - `revert refuses to delete files when the delete budget is exceeded` (survivors intact)
- `bun test test/session/revert-compact.test.ts` — 8 pass / 0 fail (test turns now pass the
  session ID as owner, mirroring production).
- The two changes are intentionally complementary: the patch scoping (1) prevents foreign
  paths from ever reaching revert; the delete budget (3) is a final bound for anything that
  slips through a mis-labeled or legacy patch.

### Screenshots / recordings

N/A — backend/Opencode server change without UI.

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...snapshot-revert-guard
- mQorva context: fixes were built and verified against the mQorva fork's `dev` (which
  carries the same `packages/opencode` snapshot/`SessionPrompt` path as `upstream/dev`),
  then re-based onto `upstream/dev@ecbc6ccac8` as an isolated package. The restore-scope
  fix in upstream PR #45141 is intentionally not duplicated here.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR