Title:
Frameless desktop windows can stay always-on-top on Windows after first show

Description:
`packages/desktop/src/main/windows.ts` calls `win.show()` inside the
`ready-to-show` handler. On Win32, frameless windows (which the opencode
desktop uses) can latch into the topmost Z-order level on that first show,
even though the app never set `setAlwaysOnTop(true)`. The result: every other
window the user brings to front gets covered again, the opencode desktop
window behaves as if it were permanently on top, and the only known recovery
is to kill the process or minimise/restore the window repeatedly.

`setAlwaysOnTop(false)` after the first show is the documented Win32 fix: it
clears the latch and lets the OS treat the window as normal from then on.
The change is gated on `process.platform === "win32"` because the latch is a
Win32-only behaviour.

Plugins: n/a
OpenCode version: dev (10765ff2a9)

Steps to reproduce:
1. Build the desktop bundle against `dev` on a Windows 10 or Windows 11 host.
2. Start the app, open the main window.
3. Click another application to bring it to the front.
4. The opencode desktop window stays on top, covering the focused window.

Expected behaviour:
- After the first show, the opencode desktop window behaves like a normal
  window: it can be covered by other applications.

Actual behaviour:
- The opencode desktop window remains on top of every other window until the
  process is killed.

Operating System: Windows 10, Windows 11
Terminal: n/a

Related / duplicate check: no related upstream issue found.
