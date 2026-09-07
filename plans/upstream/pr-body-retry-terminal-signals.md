### Issue for this PR

Closes #47685

### Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [ ] Documentation

### What does this PR do?

`retryable()` decides whether a provider error is worth another attempt by looking at prose — the
message and the response body run through `RETRYABLE_MESSAGE_PATTERNS`, plus two zen-specific
markers. A provider that reports an exhausted budget without a recognisable phrase, and without
asking for a long `retry-after`, falls through as an ordinary retryable error. The session then
spends all five attempts on a limit that resets on a billing or daily window.

This classifies the documented structural signals instead of the wording:

- HTTP 402,
- the OpenAI billing error codes (`insufficient_quota`, `billing_hard_limit_reached`,
  `billing_not_active`, `account_deactivated`), read from `error.type`/`error.code` or the
  top-level `code`/`type`,
- a google `QuotaFailure` whose `quotaId`/`quotaMetric` names a per-day window.

These are stable identifiers rather than message text, which varies per provider and locale.

A terminal result ends the schedule, but only after the retry status has been published, so the UI
reports the limit exactly as it does today and the error then reaches the caller instead of a
pending attempt. Per-minute quotas, plain 429s, 5xx and everything else keep their current retry
behavior — the new checks run after the existing classification and only add a `terminal` flag.

**Relation to the other open PRs in this area,** since they overlap in this file: #47339 stops on
the `free_tier_limit` and `account_rate_limit` reasons, which are derived from zen markers in the
body; #47641 stops when the requested wait exceeds a ceiling. This PR covers the case neither
reaches — a structural budget signal with a short or absent `retry-after` and no zen marker. All
three compose; none of them subsumes another.

### How did you verify your code works?

Five new tests in `packages/opencode/test/session/retry.test.ts`, additive — no existing
expectation was changed:

- HTTP 402 is terminal,
- a structured `insufficient_quota` body is terminal,
- a google per-day `QuotaFailure` is terminal,
- a per-minute `QuotaFailure` stays retryable,
- a plain 429 without structural markers stays retryable.

Verified the three terminal cases fail on unmodified `dev` and pass with the change.

- `bun test test/session/retry.test.ts` in `packages/opencode`: 65 pass, 0 fail
- `tsgo --noEmit` in `packages/opencode`: clean
- `prettier --check` on both changed files: clean
- `oxlint` on the changed file: 2 warnings, the same two present on `dev` before this change

Not verified: an exhausted account against a live provider. The classification is driven by the
documented response shapes, and the tests use those shapes verbatim.

### Screenshots / recordings

Not a UI change.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
