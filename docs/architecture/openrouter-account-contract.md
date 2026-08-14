# OpenRouter account and provider contract

Status: accepted for AP-11 implementation

Updated: 14 August 2026

Official references verified on 14 August 2026:

- [OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [Current API key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key)
- [Credits](https://openrouter.ai/docs/api/api-reference/credits/get-credits)
- [Models](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)

## Contract classification

- Contract type: mandatory provider integration, secret input, external API, graphical account workflow, and visible usage/model artifacts.
- Same object as a direct provider key or a Codex/Claude subscription: no.
- Own contract required: yes.

## Product promise

OpenRouter is a first-class mandatory provider. A user can connect it graphically, verify the connection, inspect its safe metadata, choose models, run tasks, understand provider-specific failures, and remove the connection without editing JSON or using a CLI.

The implementation may reuse OpenCode's existing OpenRouter AI SDK integration and model transformation logic. Existing technical availability alone does not satisfy this product contract.

## Credential kinds

The product distinguishes:

- `openrouter_api_key`: a user-pasted OpenRouter inference API key.
- `openrouter_pkce_key`: a user-controlled OpenRouter API key created by the official browser PKCE flow.
- `openrouter_management_key`: an optional, separately authorized management key for endpoints that explicitly require it.
- direct provider API keys and provider-specific OAuth credentials: different account types outside this contract.
- Codex or Claude subscription authentication: different account types and never labelled OpenRouter.

An OpenRouter PKCE connection ultimately yields an API key. It is still recorded with its PKCE origin so reconnect, diagnostics, help text, and deletion semantics remain truthful.

## Scope and ownership

- Initial scope is local installation/user, shared across projects on that installation.
- A task/run stores only the provider/model reference used for execution, never a secret.
- More than one OpenRouter account may be supported later, but AP-11 may enforce one active OpenRouter inference credential if the UI says so explicitly.
- A management key is never silently used as the default inference key and an inference key is never presented as management-capable unless verification proves it.

## Secret storage

- Plain API keys, PKCE verifiers, authorization codes, and management keys are secrets.
- Secrets must not be stored in renderer state persistence, logs, events, diagnostics, task/run records, exports, URLs, error messages, or ordinary SQLite JSON/text columns.
- Desktop production storage uses the operating system's protected credential facility through an Electron main-process boundary. Windows uses Credential Manager or DPAPI-backed storage; equivalent secure stores are required before macOS/Linux release.
- SQLite stores only a product credential ID, provider, kind, label, safe verification metadata, timestamps, state, and a secret-store reference.
- Renderer code receives masked display data only. It submits a secret once over the existing trusted preload/IPC boundary and clears input state after the result.
- Deletion removes both metadata and protected secret. Partial deletion is surfaced as a persistence error with a recoverable cleanup action.
- Existing OpenCode credentials found in plaintext storage are not silently migrated or deleted. AP-11 requires an explicit adopt-and-protect migration with rollback-safe ordering.

## Connection flows

### Paste API key

1. User chooses OpenRouter and enters a key in a password field.
2. The main/backend boundary stores it provisionally in protected storage.
3. Verification calls `GET /api/v1/key` with Bearer authentication.
4. On success, safe key metadata is persisted and the connection becomes `connected`.
5. On failure, provisional secret material is removed unless the user explicitly chooses to retain an unverified configuration.

Whitespace around a pasted key is removed. Empty values are rejected. The product does not hardcode the complete key format as authentication truth; OpenRouter verification is authoritative.

### Browser PKCE

1. Generate a cryptographically random verifier and S256 challenge in the trusted desktop/backend boundary.
2. Bind an ephemeral loopback listener to `127.0.0.1` on a random available port and construct the exact callback URL.
3. Open the official OpenRouter `/auth` page in the system browser with callback, challenge, and `S256` method.
4. Accept one matching callback, reject missing/mismatched state or code, and stop the listener on success, cancellation, or timeout.
5. Exchange the code at `POST /api/v1/auth/keys` with the verifier.
6. Store the returned user-controlled API key only in protected storage, verify it, and erase verifier/code from memory as soon as practical.

PKCE cancellation, callback timeout, callback mismatch, exchange rejection, secret-storage failure, and verification failure are distinct outcomes. No browser cookie is imported into the desktop app.

## Verification projection

Safe metadata from `GET /api/v1/key` may include:

- masked/returned label;
- free-tier, management-key, and provisioning-key flags;
- limit, remaining limit, reset period, and expiry when supplied;
- aggregate usage values returned for the current key;
- `verifiedAt` and product connection state.

The product must not infer a person's email, organization name, or billing identity if OpenRouter does not return it. `user_id` returned during PKCE exchange may be stored as an opaque provider subject, not displayed as a human identity without another authoritative source.

Connection states are:

```text
unconfigured | verifying | connected | attention | disconnected
```

`attention` includes expired/revoked credentials, insufficient credits, or lost protected secret where metadata still exists. Provider unavailability does not invalidate the saved credential.

## Credits, limits, usage, and cost

- `GET /api/v1/key` is the default safe source for current-key limits and usage.
- `GET /api/v1/credits` requires a management key and is shown only when that separate capability is configured and verified.
- Session/run token and cost telemetry is execution evidence produced by OpenCode.
- OpenRouter key usage/limit and account credit data are provider snapshots.
- These sources must be labelled separately and must not be arithmetically merged into an invented account balance.
- Provider snapshots have `fetchedAt`, can become stale, and retain the last successful safe value with a visible refresh error.

## Model catalog

- The existing OpenCode catalog remains the runtime integration point.
- OpenRouter model identity is the exact provider model slug; aliases are not rewritten into a different canonical model silently.
- `GET /api/v1/models` is the authoritative remote source for OpenRouter availability and advertised model properties at refresh time.
- Product model projections include stable slug, display name, context length, modalities, supported parameters/capabilities, and pricing fields needed for informed selection.
- Unknown fields are ignored safely; required malformed fields make that model unavailable and create a diagnostic record without breaking the entire catalog.
- Cache last successful catalog with `fetchedAt`; refresh failure must not erase usable cached models.
- Disabled aliases and OpenRouter-specific transformations already present in OpenCode remain engine policy behind the adapter and require focused regression tests.

## Request attribution

- `HTTP-Referer` and `X-Title` use the final product website/name after AP-00 decisions.
- Until then, do not ship false mQorva branding by merely retaining upstream `https://opencode.ai/` and `opencode` values as product identity.
- Attribution values are centralized provider configuration, not repeated across request call sites.

## Error semantics

The adapter separates at least:

- `validation`: missing or malformed local input;
- `secret_storage`: protected-store read/write/delete failure;
- `auth_cancelled`: user cancelled browser authentication;
- `auth_callback`: callback state/code/listener failure;
- `provider_auth`: HTTP 401 or explicit authentication error;
- `provider_payment`: HTTP 402 or explicit payment/credit error;
- `provider_permission`: HTTP 403 or explicit permission error;
- `provider_rate_limit`: HTTP 429, retaining `Retry-After` when valid;
- `provider_timeout`: timeout/408;
- `provider_unavailable`: network failure, 502, or 503;
- `provider_protocol`: malformed or unexpected successful/error payload;
- `persistence`: safe metadata could not be persisted;
- `engine_configuration`: verified account exists but the OpenCode execution adapter cannot use it.

An internal app, IPC, database, or protected-store failure is never shown as “OpenRouter key invalid”. A 402 credit failure is never shown as an authentication failure. Retry is automatic only for bounded idempotent reads and respects `Retry-After`; credential submission and PKCE exchange are not blindly replayed.

## Graphical UI contract

The OpenRouter settings surface provides:

- `Mit OpenRouter verbinden` with `API-Schlüssel einfügen` and `Im Browser anmelden`;
- masked connection label, connection state, last verification, safe limit/usage metadata, and expiry where available;
- `Verbindung prüfen`, `Schlüssel ersetzen`, and `Verbindung entfernen`;
- searchable/filterable model selection with capabilities, context, and pricing information;
- clear separation between OpenRouter, direct providers, and later subscription accounts;
- loading, empty, stale-data, offline, and typed error states without JSON editing.

The UI never displays or offers to copy a stored plaintext key after submission.

## Export, import, and diagnostics

- Normal settings export includes provider kind, safe labels/preferences, selected models, and non-secret metadata only.
- Secrets are excluded by default and cannot be recovered from an export.
- A future explicit encrypted secret transfer is a separate contract; AP-11 must not approximate it with plaintext JSON.
- Diagnostics include request category, endpoint category, HTTP status/error type, correlation/timing data, and redacted payload shape. Authorization headers, keys, codes, verifiers, prompts, and provider response bodies containing secrets are excluded.

## AP-11 acceptance variants

- valid pasted key and invalid/revoked key;
- key with limit, expiry, free tier, and management capability combinations;
- PKCE success, user cancellation, wrong state, timeout, exchange rejection, and app restart during flow;
- protected-store failure before and after metadata persistence;
- provider offline/timeout, 401, 402, 403, 429 with retry information, 502, 503, and malformed payload;
- model refresh success, partial malformed models, cache fallback, and no cache;
- key replacement and full deletion without a recoverable plaintext secret;
- one real, explicitly approved OpenRouter verification and minimal model request, with cost implications stated before execution.

## Decision for implementation

AP-11 implements OpenRouter account metadata, protected desktop secret storage, paste-key verification, PKCE, provider projections, and graphical adapter endpoints around the existing OpenCode integration. Management-key features are optional and visually separate. Direct providers and subscription authentication remain later work.
