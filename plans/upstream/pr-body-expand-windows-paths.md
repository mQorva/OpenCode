### Issue for this PR

Fixes #36681

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Permission whitelist entries written as absolute Windows paths were never
compared against the runtime's normalised path form, so a fully-specified
`external_directory` allow block still prompted on every external read.

`Permission.expand()` expandes `~/…`, `$HOME/…` and keeps the literal string for
drive-letter patterns. The runtime (`external-directory.ts`) canonicalises ask
targets on Windows via `FSUtil.normalizePathPattern` — which resolves symlinks
and junctions (e.g. `~/.claude` resolving to `~/.codex`) and normalises
separators. A config entry such as `C:\Users\User\.config\opencode` therefore
never string-matched the `C:\Users\…\config\*` request glob, so the gate fell
through to the `ask` default: the documented allow block silently did not apply.

This change sends the same realpath pass over absolute Windows whitelist
patterns in `expand()`, so config patterns and request globs collapse onto the
same canonical prefix. Non-path patterns (`ls`, `*.env`, relative paths) are
left untouched; the drive-letter guard keeps the normalisation scoped to
absolute Windows paths.

### How did you verify your code works?

- New `Permission.expand` tests cover untouched non-path patterns, tilde/`$HOME`
  expansion, and (on Windows) drive-prefix + trailing-wildcard survival through
  the realpath pass.
- Updated `fromConfig` tilde/`$HOME` expectations to be platform-tolerant
  (Windows requests the normalised form).
- `bun typecheck` and `bun test test/permission/` in `packages/opencode`:
  88 pass / 0 fail.

### Screenshots / recordings

N/A — not a UI change.

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...expand-windows-paths
- Relation to open PR #40149: this fixes the config/pattern side (Windows
  realpath normalisation in `expand`), while #40149 fixes the tool/request side
  (external targets sent absolute instead of workspace-relative). The two are
  complementary; this PR does not modify tool call sites or `external-directory.ts`.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR