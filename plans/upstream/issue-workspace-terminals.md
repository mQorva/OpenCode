### Description

Workspace terminals are torn down when navigating between chat routes.

The terminal cache is created per route inside `TerminalProvider`, which lives in the session page. Switching sessions (or moving between a draft and a session) destroys the previous terminal cache and disposes all terminal sessions, so an open bottom terminal disappears instead of persisting for the same workspace directory.

### Plugins

n/a

### OpenCode version

latest `dev`

### Steps to reproduce

1. Open a workspace terminal in a chat.
2. Navigate to another chat in the same workspace directory (or open a new draft).
3. The bottom terminal is gone instead of persisting.

### Screenshot and/or share link

n/a

### Operating System

n/a (all)

### Terminal

n/a
