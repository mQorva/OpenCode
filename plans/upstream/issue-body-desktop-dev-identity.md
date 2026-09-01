### Description

The unpackaged Electron app and an installed Dev build both use `ai.opencode.desktop.dev` as their Windows AppUserModelID. This lets Windows associate the installed application with an unpackaged Electron shortcut or pin. If that development target later disappears, the taskbar can resolve the group through the stale target and display the generic document icon instead of the packaged application icon.

This was reproduced on a downstream Windows build that preserves the same packaged/unpackaged identity relationship as current upstream `dev`. The collision originates from the AppUserModelID setup introduced in #23368; that PR correctly added an explicit identity, but the unpackaged fallback currently reuses the installed Dev identity.

The unpackaged process should use a distinct AppUserModelID while retaining the existing Dev user-data directory.

### Plugins

N/A

### OpenCode version

`dev` at `04284921ac`

### Steps to reproduce

1. Build and install the Windows Dev desktop application.
2. Launch the unpackaged Electron desktop application.
3. Confirm that both processes use `ai.opencode.desktop.dev` as AppUserModelID.
4. Leave a shortcut or pin for the unpackaged Electron target, then remove or move that target.
5. Launch the installed Dev application and observe that Windows can show the stale or generic taskbar identity instead of the packaged icon.

### Screenshot and/or share link

N/A

### Operating System

Windows 11

### Terminal

Windows Terminal
