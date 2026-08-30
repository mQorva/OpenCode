Title:
Allow configuring the desktop dev remote-debugging port

Description:
`packages/desktop/src/main/index.ts` calls
`app.commandLine.appendSwitch("remote-debugging-port", "9222")` in unpackaged
runs, hard-coded. When the developer already has something on `9222` (VS Code,
another Electron app, a second opencode desktop dev build), the DevTools port
silently fails to bind. There is no env-var override today.

Plugins: n/a
OpenCode version: dev (dc4449df0d)

Steps to reproduce:
1. Start anything that listens on `9222` (e.g. `bun --inspect=9222`).
2. `bun run dev` in `packages/desktop`.
3. The DevTools port is taken; the second instance fails to expose the
   inspector.

Expected behaviour:
- An env var (`OPENCODE_REMOTE_DEBUGGING_PORT`) selects the port.
- A default value (e.g. `9223`, one above the OS-default `9222`) keeps current
  behaviour when nothing is on `9222`.

Actual behaviour:
- Port is hard-coded, no override, build script does not even log a warning.

Operating System: n/a
Terminal: n/a

Related / duplicate check: no related upstream issue found.
