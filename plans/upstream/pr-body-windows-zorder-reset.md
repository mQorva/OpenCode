### Issue for this PR

Closes #46304

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`packages/desktop/src/main/windows.ts` shows the main window inside the
`ready-to-show` handler. On Win32, frameless windows can latch into the
topmost Z-order level on that first show even though the app never called
`setAlwaysOnTop(true)`. The window then behaves as permanently-on-top,
covering every other application the user brings to focus.

This PR adds a single `if (process.platform === "win32") win.setAlwaysOnTop(false)`
line after `win.show()` inside the same handler. `setAlwaysOnTop(false)` is
the documented Win32 fix: it clears the latch without affecting any future
deliberate always-on-top request (the desktop does not currently set
always-on-top itself).

The change is gated on `process.platform === "win32"` because the latch is a
Win32-only behaviour; on macOS and Linux the call is unnecessary and is
skipped to avoid touching the platform layer.

### How did you verify your code works?

- One file, one commit, +5/-0: `packages/desktop/src/main/windows.ts`.
- `bun typecheck` in `packages/desktop` passes (`tsgo -b` exit 0) after
  `bun install --ignore-scripts` in the worktree, against `upstream/dev`
  head `10765ff2a9` plus this commit.
- Manually traced the call site: `createMainWindow` is the only place in the
  desktop main process that handles the first show; the new line is
  sequenced immediately after `win.show()` inside the `ready-to-show`
  callback, so it runs exactly once per window.
- **I did not perform a Windows runtime verification in this environment.**
  This worktree and the dev container run on a non-Windows host, so a
  physical Windows 10/11 reproduce-and-fix cycle is not possible here. The
  fix is a 1-line API call inside a `process.platform === "win32"` branch
  and follows the documented Win32 recovery for the topmost-Z-order latch.
  A maintainer with a Windows host should confirm before merge that the
  Z-order latch reproduces on a vanilla `dev` build and is cleared by the
  new call.

### Screenshots / recordings

N/A — no UI code path on this branch, the change is platform-conditional
`setAlwaysOnTop(false)` inside the desktop main process.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/desktop` passes (`tsgo -b` exit 0) after
    `bun install --ignore-scripts` in the worktree, against `upstream/dev`
    head `10765ff2a9` plus this commit. Windows runtime verification is
    blocked in this environment; see "How did you verify your code works?"
- [x] I have not included unrelated changes in this PR
