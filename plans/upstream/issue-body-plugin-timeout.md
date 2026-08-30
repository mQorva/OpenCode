Title:
Plugin init and config hook can block the opencode layer indefinitely

Description:
`packages/opencode/src/plugin/index.ts` loads each internal plugin with `await plugin(input)`
and notifies each loaded hook with `(hook as any).config?.(cfg)`. Neither call has a timeout
or any per-plugin log line about which plugin is currently being awaited. When a plugin
returns a promise that never resolves (sync throw inside a never-resolving promise, broken
native binding, etc.) the entire plugin layer init blocks until the process is killed; the
existing `logError` only fires on rejection, not on hang.

The npm-install-related hang from #33905 was fixed in #33905 itself. The two call sites in
`plugin/index.ts` still have no timeout and are unrelated to that fix.

Plugins: n/a
OpenCode version: dev (dc4449df0d)

Steps to reproduce:
1. Add a plugin to the internal plugins list whose `plugin(input)` returns a never-resolving
   Promise (or whose `config` hook does the same).
2. Start `opencode` against any project directory.
3. Plugin layer init never returns. No log line identifies which plugin is stuck.

Expected behaviour:
- The offending call fails or times out within a few seconds.
- The layer continues with the remaining plugins.
- The log identifies the plugin by name (or by index) so the misbehaving one is locatable.

Actual behaviour:
- The layer init blocks indefinitely.
- No log line is emitted until the process is killed externally.

Operating System: n/a (reproducible on any platform)
Terminal: n/a

Related / duplicate check:
- #33905 (closed): same symptom, but for the npm install inside the config layer; that path
  is already fixed.
- #38723: broader `opencode run` hangs during init; this issue is scoped to the plugin-layer
  init and config-hook call sites specifically.
- #37060: TUI port-related hang; different layer.
