### Description

The app's global event stream reconnects after **every** failure with the same fixed `RECONNECT_DELAY_MS` (250 ms) — there is no back-off. When the server is briefly unavailable (restart, proxy blip, network drop), the client retries in a tight loop: a long outage produces hundreds of rapid attempts, keeps the CPU busy and spams the server with connections, even though a slow cadence would work just as well for recovery.

### Plugins

N/A

### OpenCode version

dev (current upstream/dev)

### Steps to reproduce

1. Start the app so the global event stream is subscribed.
2. Stop the backend or cut the connection for > 1 second.
3. Observe the client reconnect loop: it retries every 250 ms with no growth in the delay.

### Screenshot and/or share link

N/A

### Operating System

Platform-independent

### Terminal

N/A (app / desktop)

### Related / duplicate check

- #26416 (idle CPU on macOS) can be aggravated by a tight reconnect loop.
- #38458 (SSE stream closes) is a different root cause (mid-turn closure), not this retry cadence.
- No issue covers the missing backoff itself.