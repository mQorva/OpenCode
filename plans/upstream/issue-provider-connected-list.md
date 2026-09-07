TITEL: App bootstrap fetches the whole models.dev catalog from /provider on every start, once per project

### Description

`GET /provider` always builds the full models.dev catalog. Measured against the HTTP API test
harness on this repo's `dev`, one call is **4,168,456 bytes and ~1.5 s**, while the connected
providers in the same instance amount to **4,468 bytes** — the catalog is 99.9% of the response.

The app bootstrap asks for that response even though it does not need the catalog yet:

- `bootstrapGlobal` fetches `loadProvidersQuery(scope, null, ...)` once
  (`packages/app/src/context/global-sync/bootstrap.ts`),
- `bootstrapDirectory` fetches it again for every project directory,
- and `loadProvidersQuery` carries no `staleTime`, so every consumer that mounts before the
  bootstrap has written its result refetches the same payload.

Only the model picker needs the catalog. Everything else on the startup path — rendering the
currently selected model, the composer controls — needs the connected providers alone. On a slow
or unstable connection the catalog is what the startup waits for.

Related, but different: #44180 makes building the same response cheaper on the server
(memoization); this is about not asking for it during startup at all. #35897 asks for a cap or
pagination on the same endpoint, which is another way to cut the same payload.

### Plugins

None

### OpenCode version

dev (ea2d59d7ca)

### Steps to reproduce

1. Start the app with several projects open.
2. Watch `GET /provider` in the server log or a proxy.
3. Every bootstrap — global plus one per project directory — transfers the full catalog.

Payload sizes can be reproduced without the app:

```
GET /provider                 -> 4,168,456 bytes
GET /provider?connected=true  -> 4,468 bytes   (with the linked PR applied)
```

### Screenshot and/or share link

N/A

### Operating System

Windows 11 (26200)
