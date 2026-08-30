### Issue for this PR

Closes #46301

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`packages/app/src/pages/session/composer/session-composer-state.ts` exposes a
`decide(response: "once" | "always" | "reject")` method that always sends the
chosen reply straight to the server. The server-side reply path in
`packages/opencode/src/permission/index.ts` only does pattern matching when the
incoming `Permission.Info.always` is a non-empty list of patterns; otherwise the
"always" reply silently downgrades to a one-off reply.

This PR adds a `permissionPersistent()` memo that returns `true` only when the
current permission request carries at least one `always` pattern, and short-
circuits `decide` when the user picks `"always"` for a request that does not
support persistence. The new memo is also exported from the controller state so
the dock can use it to hide or disable the "always" button. Nothing else in
`session-composer-state.ts` changes.

The fix is deliberately not gated on `protocol() === "v2"` or any other
transport signal. `Permission.Info.always` is a request field, not a transport
field; the same condition holds for both V1 and V2 request shapes.

### How did you verify your code works?

- One file, one commit, +7/-0: `packages/app/src/pages/session/composer/session-composer-state.ts`.
- `bun typecheck` in `packages/app` passes (`tsgo -b` exit 0) after `bun install
  --ignore-scripts` in the worktree, against `upstream/dev` head `10765ff2a9`
  plus this commit.
- Manually traced both ends:
  - Client: `decide` is the only call site that sends the reply; the new
    `permissionPersistent` guard is the first thing it checks after the
    `responding === perm.id` early-out.
  - Server: `packages/opencode/src/permission/index.ts` reads `request.always`
    before acting on `input.reply === "always"`. The client guard now matches
    the server's actual behaviour, so a request that does not support
    persistence cannot be answered with `"always"` from the client either.

### Screenshots / recordings

N/A — single boolean guard, no UI change. The dock already controls its own
button visibility; this PR only adds the data field needed for the dock to
filter the "always" button.

### Checklist

- [x] I have tested my changes locally
  - `bun typecheck` in `packages/app` passes (`tsgo -b` exit 0) after
    `bun install --ignore-scripts` in the worktree, against `upstream/dev`
    head `10765ff2a9` plus this commit.
- [x] I have not included unrelated changes in this PR
