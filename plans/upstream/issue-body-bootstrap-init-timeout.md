Title:
Instance service init has no timeout and can hang the bootstrap layer indefinitely

Description:
`packages/opencode/src/project/bootstrap.ts` calls `init()` on each per-instance service
(`lsp`, `share`, `format`, `vcs`, `snapshot`, `project`) inside an `Effect.forEach` with
`concurrency: "unbounded"`. Each `init()` is unbounded; the existing `catchCause` only
fires on rejection, not on hang; and there is no per-service log line. When a single
service hangs (broken native binding, deadlocked internal state, slow disk that
prevents the share/format services from enumerating, etc.) the bootstrap layer
silently waits, the rest of the services may also stall depending on shared
`InstanceState`, and there is no log line to point at the offending service.

`#33905` covered the related plugin-init npm install and was fixed in the npm install
path. The instance service bootstrap itself is a separate layer and still has no
timeout.

Plugins: n/a
OpenCode version: dev (dc4449df0d)

Steps to reproduce:
1. Replace one of the bootstrap services (e.g. `format`) with an implementation whose
   `init()` returns a never-resolving Effect.
2. Open a project directory.
3. `InstanceBootstrap.run` never returns. No log line identifies the hanging service.

Expected behaviour:
- The hanging service's `init` is interrupted within a few seconds.
- The bootstrap completes for the other services.
- A `logWarning` is emitted that names the service so the misbehaving one is locatable.

Actual behaviour:
- The bootstrap blocks indefinitely.
- No log line is emitted until the process is killed.

Operating System: n/a (reproducible on any platform)
Terminal: n/a

Related / duplicate check:
- #33905 (closed): same symptom class for the npm install inside the config layer.
- #37111 (open): `opencode web` hangs inside `@parcel/watcher` native subscribe; this
  issue is scoped to the bootstrap layer in `project/bootstrap.ts`, not the watcher.
