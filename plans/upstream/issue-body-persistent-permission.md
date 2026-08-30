Title:
Permission dock offers 'always' even when the request has no `always` patterns

Description:
The permission dock in the session composer renders a button for each of the three
response values `once`, `always`, `reject`. The server-side reply path in
`packages/opencode/src/permission/index.ts` already treats the `always` case as a
no-op when the incoming `Permission.Info` has an empty `always` pattern list (it
falls through to "once" or rejects), so the client offering a button that the
server will silently downgrade is misleading.

Tracked:
- The client-side `permissionRequest()` returns a `Permission.Info` whose `always`
  field may be empty.
- The current `decide(response)` path does not check whether the request supports
  `always`; it just sends `reply: "always"` to the server.
- On the server, the `reply === "always"` branch is only meaningful when
  `request.always` is a non-empty list of patterns to persist.

Expected behaviour:
- When `request.always` is empty, the client should not offer the `always` button
  (or, defensively, the `decide` path should refuse to send `"always"`), so the
  user never sees a "remember this choice" affordance that has no effect.

Actual behaviour:
- The dock shows the `always` button for any permission request, regardless of
  whether the request carries `always` patterns.
- Tapping it sends `reply: "always"` to the server, which silently falls through
  to a one-off reply.

Plugins: n/a
OpenCode version: dev (10765ff2a9)

Steps to reproduce:
1. Trigger a permission request whose `Permission.Info.always` is empty (most
   default tool/permission paths, e.g. a plain `bash` request without an
   explicit pattern list).
2. The permission dock renders three buttons, including "always".
3. Tap "always".
4. The server replies with the same behaviour as "once"; no pattern is
   remembered.

Expected behaviour:
- The "always" button is hidden or disabled when `request.always` is empty.
- Tapping it (if still rendered) is a no-op, not a silently-downgraded reply.

Operating System: n/a
Terminal: n/a

Related / duplicate check: no related upstream issue found.
