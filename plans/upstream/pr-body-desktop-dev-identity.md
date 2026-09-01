### Issue for this PR

Closes #46473

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Gives the unpackaged Electron desktop process its own Windows AppUserModelID instead of reusing the installed Dev application's identity.

The existing Dev user-data directory and every packaged channel ID remain unchanged. This prevents stale Electron shortcuts or pins from taking over the installed Dev taskbar group while preserving the taskbar identity setup introduced in #23368.

### How did you verify your code works?

- `bun test src/main/app-identity.test.ts` in `packages/desktop` (2 passed)
- `bun typecheck` in `packages/desktop`
- `bun run build` in `packages/desktop`
- Reproduced the identity collision on Windows 11 with installed and unpackaged downstream builds that preserve the same upstream ID relationship

### Screenshots / recordings

N/A — this changes the native Windows process identity used for taskbar association; the regression test covers the packaged and unpackaged identity contract.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
