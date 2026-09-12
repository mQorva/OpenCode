### Description

A failed session turn is not reflected in the UI's session state and produces no visible error.

When the server emits a `session.error` event, the global sync reducer ignores it. The session stays in its last non-idle status (busy) and the failed assistant message keeps no error marker, so the user is not told that the turn failed.

### Plugins

n/a

### OpenCode version

latest `dev`

### Steps to reproduce

1. Trigger a session that fails with an error event.
2. The session status stays `busy` and no error toast appears; the last assistant message does not get an error marker.

### Screenshot and/or share link

n/a

### Operating System

n/a (all)

### Terminal

n/a
