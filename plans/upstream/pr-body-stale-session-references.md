### Issue for this PR

Closes #47683

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

Three references to a deleted session outlived it, all for the same reason, so they are fixed
together.

**Address bar.** The current-tab check in `removeSessions` required `params.dir`, which only the
legacy `/:dir/session/:id` route provides. On `/server/:serverKey/session/:id` there is no
directory, so `currentHref` stayed undefined, `removedCurrent` stayed false and the navigation to
the next tab never ran. `tabHref` builds the href from server and session id alone, so the
directory was never needed for this comparison — dropping it is the whole fix.

**Recent-tab pointer.** It was only cleared when the removed session still had an open tab, because
the check matched against the list of removed tab keys. The pointer is persisted on its own and
outlives the tab, so it is now matched against the deleted session ids directly, through the
extracted `recentKeyPointsAtSession`. That function matches the tail of the key rather than
splitting on the separator, because the server key can contain the separator itself.

**Persisted handoff.** It carries a session id across a layout switch and nothing cleared it on
deletion, so later starts restored a session that was gone. A listener on the existing
`SESSION_TABS_REMOVED_EVENT` drops it when its target is among the removed ids.

**Error path.** The two effects that read `current()` now go through `catchError`. Solid's
`ErrorBoundary` only catches throws during render; a throw from inside an effect passes the scoped
`SessionRouteErrorBoundary` — which would show the "not found" page — and reaches the global
boundary, replacing the whole window with "something went wrong". This is the same contract, not a
new behavior: the scoped page still handles the render path.

`recentKeyPointsAtSession` is extracted from the inline check so it can be tested without a router
or context. Writing that test caught a bug in my first version: it split the key on the separator
and read the second field, but the server key contains that separator, so the pointer was never
recognised.

### How did you verify your code works?

New tests in `packages/app/src/context/tabs.test.ts`, additive — no existing expectation changed:
the recent pointer is recognised for a deleted id and for one among several; it is not recognised
for an unrelated id, for an empty or missing key, for a draft key, or for an empty removal list;
and a session whose id merely ends with the same characters is not matched. A separate test pins
that the session href needs no directory.

- `bun test --conditions=solid --preload ./happydom.ts src/context/tabs.test.ts` in `packages/app`:
  16 pass, 0 fail
- `tsgo -b` in `packages/app`: clean
- `prettier --check` on all five changed files: clean
- `oxlint` on the changed files: 11 warnings, all present on `dev` before this change

What the tests do not cover: the `params.dir` condition and the handoff listener are not exercised
by a regression test — both need the router and the persisted layout store. The `params.dir` change
rests on the route shape, which the href test pins, and I reproduced the original behavior by
deleting an open session on `/server/:serverKey/session/:id`.

### Screenshots / recordings

Not a UI change — no visual difference, only which references survive a deletion.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
