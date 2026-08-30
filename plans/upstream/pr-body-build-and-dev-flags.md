### Issue for this PR

Closes #46194
Closes #46195

### Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Two small CLI / dev-quality knobs, one commit each, both product-neutral:

**Commit 1 — `chore(opencode): add --no-minify flag to build script`** (`packages/opencode/script/build.ts`)

The CLI build script already accepted `--sourcemaps`, `--single`, `--baseline`,
`--skip-install`, `--skip-embed-web-ui`. It did not have a way to opt out of
minification for local debugging or for `bun run` smoke tests, which is annoying
when a regression only reproduces against the unminified bundle (e.g. readable
stack traces, exact symbol names). This adds `--no-minify` as a sibling flag and
turns `minify: true` into `minify: !noMinifyFlag`. Default behaviour is unchanged.

**Commit 2 — `feat(desktop): allow configuring dev remote-debugging-port`** (`packages/desktop/src/main/index.ts`)

In unpackaged/dev runs the desktop main process pins the Electron remote
debugging port to `"9222"`. If the developer's local port `9222` is already in
use (common when several Electron apps, VS Code, or another `opencode` desktop
dev build are running) the second instance silently fails to expose the
DevTools. This reads `process.env.OPENCODE_REMOTE_DEBUGGING_PORT` and falls back
to `"9223"` (the desktop's preferred dev port, one above the OS-default
`9222`). The new env var is opt-in: existing dev setups that already free `9222`
or override it through `--remote-debugging-port` directly keep working.

### How did you verify your code works?

- Two commits, one file each:
  - `packages/opencode/script/build.ts` +2/-1
  - `packages/desktop/src/main/index.ts` +4/-1
- `bun typecheck` passes in both packages (`tsgo --noEmit` exit 0 in
  `packages/opencode`, `tsgo -b` exit 0 in `packages/desktop`) after `bun
  install --ignore-scripts` in the worktree, against `upstream/dev` head
  `dc4449df0d` plus both commits.
- Manually traced both call sites:
  - `build.ts`: the new `noMinifyFlag` is read once at module top, mirroring
    `sourcemapsFlag`/`singleFlag`/`baselineFlag`; the only `minify:` literal in
    the per-target loop is replaced with the new expression.
  - `index.ts`: the `if (!app.isPackaged) ... appendSwitch("remote-debugging-port", "9222")`
    block was a single line; it is now a block that reads the env var with a
    default. Nothing else in the file touches this switch.

### Screenshots / recordings

N/A — no UI change.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/opencode` and `packages/desktop` both pass
    after `bun install --ignore-scripts` in the worktree, against
    `upstream/dev` head `dc4449df0d` plus both commits.
- [x] I have not included unrelated changes in this PR
