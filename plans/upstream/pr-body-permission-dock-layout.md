### Issue for this PR

Closes #48532

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Adds an opt-in `footerInside` prop to `DockPrompt` so permission actions can live inside the dock shell instead of a detached bottom tray, and tightens the permission footer layout for narrow widths.

`DockPrompt` renders the footer in a separate `DockTray` below the shell. On narrow composer widths the permission buttons overflow and the footer looks detached from the content. The new `footerInside` prop keeps the actions inside the shell, wrapped and right-aligned; the default behaviour (footer in the tray) is unchanged, so question docks are not affected. `SessionPermissionDock` opts in via `footerInside`, and the storybook story documents the permission variant.

### How did you verify your code works?

- `bun typecheck` (tsgo) passes in `packages/app` and `packages/session-ui`.
- Manual observation of the permission dock at narrow composer widths, with the footer wrapped inside the shell; question docks render unchanged (footer stays in the tray).
- `git diff --check` clean; no unrelated changes.

### Screenshots / recordings

n/a — will add a Storybook screenshot if a maintainer requests one.

### Fork

- Source fork: https://github.com/mQorva/OpenCode
- Diff against this fork's dev: https://github.com/mQorva/OpenCode/compare/dev...permission-dock-layout
- mQorva issue / context: n/a

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR