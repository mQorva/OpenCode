### Issue for this PR

Closes #47677

### Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`GET /provider` always builds the full models.dev catalog. In the HTTP API test harness on
current `dev` that response is 4,168,456 bytes and takes ~1.5 s; the connected providers in the
same instance are 4,468 bytes. The catalog is 99.9% of the payload, and only the model picker
needs it.

The app bootstrap asks for it anyway, once globally and once per project directory, and
`loadProvidersQuery` has no `staleTime`, so any consumer mounting before the bootstrap result is
written fetches it again.

Two commits:

**Server.** An optional `connected` query parameter on `GET /provider`. With `connected=true` the
handler answers from `Provider.list()` and never reads the models.dev snapshot or the config
filter, so none of the expensive work happens. The parameter is optional and the default path is
untouched, so existing clients see no change. One deliberate difference in the connected view: the
full response also reports catalog providers that only have stored credentials, which cannot be
resolved without the catalog; they appear once the caller fetches it.

**Client.** The bootstrap requests the connected providers, then pulls the catalog once, three
seconds later, into the same cache entry. `loadProvidersQuery` defaults to connected-only on
purpose — every consumer shares the query key, so leaving the full catalog as the default means a
single early consumer pulls all of it and the saving is gone. The catalog is written with
`setQueryData` rather than `fetchQuery`, because `fetchQuery` rewrites the stored query options
and a `staleTime` override there leaves the entry permanently stale, making every consumer refetch.
Only the global entry warms the catalog; it is identical for every directory, so warming per
directory would pull the same payload once per project.

### How did you verify your code works?

Measured in the HTTP API test harness, same instance, both endpoints:

```
GET /provider                 4,168,456 bytes   1507 ms
GET /provider?connected=true      4,468 bytes     19 ms
```

New regression test in `packages/opencode/test/server/httpapi-provider.test.ts`: the connected view
is non-empty, strictly smaller than the catalog, a subset of it, and lists exactly the providers it
returns. Verified that it fails without the change — with the early return disabled the catalog and
the connected view both return 159 providers and the size assertion fails.

New regression test in `packages/app/src/context/global-sync/bootstrap.test.ts`: the query asks for
`{ connected: true }` by default and for the full catalog only when explicitly requested.

- `bun test test/server/httpapi-provider.test.ts` in `packages/opencode`: 6 pass, 1 skip, 0 fail
- `bun test --conditions=solid --preload ./happydom.ts src/context/global-sync/bootstrap.test.ts` in
  `packages/app`: 11 pass, 0 fail
- `tsgo --noEmit` in `packages/opencode`: clean
- `tsgo -b` in `packages/app`: clean
- `prettier --check` on all changed files: clean
- `oxlint` on the changed files: 5 warnings, all present on `dev` before this change

The SDK and OpenAPI changes are the output of `bun ./script/generate.ts`.

Not measured: startup wall-clock in a packaged desktop build. The numbers above are payload size
and handler time from the test harness.

### Screenshots / recordings

Not a UI change.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
