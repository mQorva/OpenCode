import { randomUUID } from "node:crypto"
import { Effect } from "effect"

import { ProtectedSecret } from "@opencode-ai/core/protected-secret"

const REQUEST_ID_PATTERN = /^psr_[A-Za-z0-9_-]{8,128}$/
const REF_PATTERN = /^sec_[A-Za-z0-9_-]{1,128}$/
const MAX_SECRET_LENGTH = 64 * 1024

export const PROTECTED_SECRET_REQUEST_TIMEOUT_MS = 5_000

export type ProtectedSecretRequest =
  | { type: "protected-secret"; requestId: string; operation: "put"; value: string; ref?: string }
  | { type: "protected-secret"; requestId: string; operation: "get"; ref: string }
  | { type: "protected-secret"; requestId: string; operation: "remove"; ref: string }

type ProtectedSecretResponse =
  | { type: "protected-secret-result"; requestId: string; operation: "put"; ok: true; ref: string }
  | {
      type: "protected-secret-result"
      requestId: string
      operation: "get"
      ok: true
      found: true
      value: string
    }
  | { type: "protected-secret-result"; requestId: string; operation: "get"; ok: true; found: false }
  | {
      type: "protected-secret-result"
      requestId: string
      operation: "remove"
      ok: true
      removed: boolean
    }
  | {
      type: "protected-secret-result"
      requestId: string
      operation: ProtectedSecretRequest["operation"]
      ok: false
      error: { code: "unavailable" | "operation_failed" }
    }

export type ProtectedSecretMessageChannel = {
  postMessage(message: unknown): void
  on(event: "message", listener: (message: unknown) => void): void
  off(event: "message", listener: (message: unknown) => void): void
}

export type ProtectedSecretStoreLike = {
  put(value: string, existingRef?: string): string
  get(ref: string): string | undefined
  delete(ref: string): boolean
}

export type ProtectedSecretHostOptions = {
  store: ProtectedSecretStoreLike
  isEncryptionAvailable: () => boolean
}

export type ProtectedSecretClient = {
  readonly adapter: ProtectedSecret.Adapter
  readonly close: () => void
}

type PendingRequest = {
  operation: ProtectedSecretRequest["operation"]
  resolve: (value: ProtectedSecretResponse) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

type OutgoingRequest =
  | Omit<Extract<ProtectedSecretRequest, { operation: "put" }>, "requestId">
  | Omit<Extract<ProtectedSecretRequest, { operation: "get" }>, "requestId">
  | Omit<Extract<ProtectedSecretRequest, { operation: "remove" }>, "requestId">

export function installProtectedSecretHost(
  child: ProtectedSecretMessageChannel,
  options: ProtectedSecretHostOptions,
): () => void {
  let active = true
  const inFlight = new Set<string>()
  const onMessage = (message: unknown) => {
    const request = parseRequest(message)
    if (!request || !active || inFlight.has(request.requestId)) return

    inFlight.add(request.requestId)
    void handleRequest(request)
  }

  child.on("message", onMessage)

  return () => {
    if (!active) return
    active = false
    inFlight.clear()
    child.off("message", onMessage)
  }

  async function handleRequest(request: ProtectedSecretRequest) {
    try {
      if (!options.isEncryptionAvailable()) throw new ProtectedSecretBridgeError("unavailable")

      if (request.operation === "put") {
        const ref = options.store.put(request.value, request.ref)
        if (active)
          child.postMessage({
            type: "protected-secret-result",
            requestId: request.requestId,
            operation: "put",
            ok: true,
            ref,
          })
      }

      if (request.operation === "get") {
        const value = options.store.get(request.ref)
        if (!active) return
        if (value === undefined) {
          child.postMessage({
            type: "protected-secret-result",
            requestId: request.requestId,
            operation: "get",
            ok: true,
            found: false,
          })
          return
        }
        child.postMessage({
          type: "protected-secret-result",
          requestId: request.requestId,
          operation: "get",
          ok: true,
          found: true,
          value,
        })
      }

      if (request.operation === "remove") {
        const removed = options.store.delete(request.ref)
        if (active)
          child.postMessage({
            type: "protected-secret-result",
            requestId: request.requestId,
            operation: "remove",
            ok: true,
            removed,
          })
      }
    } catch (error) {
      if (!active) return
      child.postMessage({
        type: "protected-secret-result",
        requestId: request.requestId,
        operation: request.operation,
        ok: false,
        error: { code: isEncryptionUnavailable(error) ? "unavailable" : "operation_failed" },
      })
    } finally {
      inFlight.delete(request.requestId)
    }
  }
}

export function createProtectedSecretClient(
  parentPort: ProtectedSecretMessageChannel,
  options: { timeoutMs?: number; createRequestId?: () => string } = {},
): ProtectedSecretClient {
  const pending = new Map<string, PendingRequest>()
  const timeoutMs = boundedTimeout(options.timeoutMs ?? PROTECTED_SECRET_REQUEST_TIMEOUT_MS)
  let closed = false

  const onMessage = (message: unknown) => {
    const response = parseResponse(message)
    if (!response) return
    const request = pending.get(response.requestId)
    if (!request || request.operation !== response.operation) return

    pending.delete(response.requestId)
    clearTimeout(request.timeout)
    if (response.ok) {
      request.resolve(response)
      return
    }
    request.reject(new ProtectedSecretBridgeError(response.error.code))
  }

  parentPort.on("message", onMessage)

  const request = (message: OutgoingRequest): Promise<ProtectedSecretResponse> => {
    if (closed) return Promise.reject(new ProtectedSecretBridgeError("closed"))

    const createRequestId = options.createRequestId ?? (() => `psr_${randomUUID()}`)
    let requestId = createRequestId()
    while (pending.has(requestId)) requestId = `psr_${randomUUID()}`
    const outgoing = { ...message, requestId } as ProtectedSecretRequest

    return new Promise<ProtectedSecretResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId)
        reject(new ProtectedSecretBridgeError("timeout"))
      }, timeoutMs)
      pending.set(requestId, { operation: outgoing.operation, resolve, reject, timeout })
      try {
        parentPort.postMessage(outgoing)
      } catch {
        pending.delete(requestId)
        clearTimeout(timeout)
        reject(new ProtectedSecretBridgeError("closed"))
      }
    })
  }

  const adapter: ProtectedSecret.Adapter = {
    put: (ref, value) =>
      Effect.tryPromise({
        try: () => request({ type: "protected-secret", operation: "put", ref, value }).then(() => undefined),
        catch: bridgeFailure,
      }),
    get: (ref) =>
      Effect.tryPromise({
        try: () =>
          request({ type: "protected-secret", operation: "get", ref }).then((response) =>
            response.ok && response.operation === "get" && response.found ? response.value : undefined,
          ),
        catch: bridgeFailure,
      }),
    remove: (ref) =>
      Effect.tryPromise({
        try: () =>
          request({ type: "protected-secret", operation: "remove", ref }).then((response) =>
            response.ok && response.operation === "remove" ? response.removed : false,
          ),
        catch: bridgeFailure,
      }),
  }

  return {
    adapter,
    close: () => {
      if (closed) return
      closed = true
      parentPort.off("message", onMessage)
      for (const request of pending.values()) {
        clearTimeout(request.timeout)
        request.reject(new ProtectedSecretBridgeError("closed"))
      }
      pending.clear()
    },
  }
}

export function installProtectedSecretAdapter(
  parentPort: ProtectedSecretMessageChannel,
  options?: { timeoutMs?: number; createRequestId?: () => string },
): () => void {
  const client = createProtectedSecretClient(parentPort, options)
  const uninstall = ProtectedSecret.install(client.adapter)
  let active = true
  return () => {
    if (!active) return
    active = false
    uninstall()
    client.close()
  }
}

export class ProtectedSecretBridgeError extends Error {
  constructor(readonly code: "unavailable" | "operation_failed" | "timeout" | "closed") {
    super(
      code === "timeout"
        ? "Protected secret request timed out"
        : code === "closed"
          ? "Protected secret channel closed"
          : code === "unavailable"
            ? "Protected secret storage is unavailable"
            : "Protected secret operation failed",
    )
    this.name = "ProtectedSecretBridgeError"
  }
}

function parseRequest(value: unknown): ProtectedSecretRequest | undefined {
  if (
    !isRecord(value) ||
    value.type !== "protected-secret" ||
    typeof value.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(value.requestId)
  )
    return
  if (value.operation === "put") {
    if (typeof value.value !== "string" || value.value.length === 0 || value.value.length > MAX_SECRET_LENGTH) return
    if (value.ref !== undefined && (typeof value.ref !== "string" || !REF_PATTERN.test(value.ref))) return
    return {
      type: "protected-secret",
      requestId: value.requestId,
      operation: "put",
      value: value.value,
      ...(value.ref === undefined ? {} : { ref: value.ref }),
    }
  }
  if (
    (value.operation === "get" || value.operation === "remove") &&
    typeof value.ref === "string" &&
    REF_PATTERN.test(value.ref)
  ) {
    return { type: "protected-secret", requestId: value.requestId, operation: value.operation, ref: value.ref }
  }
}

function parseResponse(value: unknown): ProtectedSecretResponse | undefined {
  if (
    !isRecord(value) ||
    value.type !== "protected-secret-result" ||
    typeof value.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(value.requestId)
  )
    return
  if (
    value.ok === false &&
    (value.error === undefined ||
      !isRecord(value.error) ||
      !["unavailable", "operation_failed"].includes(value.error.code as string))
  )
    return
  if (value.operation !== "put" && value.operation !== "get" && value.operation !== "remove") return
  if (value.ok === false) {
    const error = value.error as Record<string, unknown>
    return {
      type: "protected-secret-result",
      requestId: value.requestId,
      operation: value.operation,
      ok: false,
      error: { code: error.code as "unavailable" | "operation_failed" },
    }
  }
  if (value.operation === "put" && value.ok === true && typeof value.ref === "string" && REF_PATTERN.test(value.ref))
    return { type: "protected-secret-result", requestId: value.requestId, operation: "put", ok: true, ref: value.ref }
  if (value.operation === "get" && value.ok === true && value.found === false)
    return { type: "protected-secret-result", requestId: value.requestId, operation: "get", ok: true, found: false }
  if (
    value.operation === "get" &&
    value.ok === true &&
    value.found === true &&
    typeof value.value === "string" &&
    value.value.length <= MAX_SECRET_LENGTH
  )
    return {
      type: "protected-secret-result",
      requestId: value.requestId,
      operation: "get",
      ok: true,
      found: true,
      value: value.value,
    }
  if (value.operation === "remove" && value.ok === true && typeof value.removed === "boolean")
    return {
      type: "protected-secret-result",
      requestId: value.requestId,
      operation: "remove",
      ok: true,
      removed: value.removed,
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function boundedTimeout(value: number) {
  if (!Number.isFinite(value)) return PROTECTED_SECRET_REQUEST_TIMEOUT_MS
  return Math.min(Math.max(Math.floor(value), 1), PROTECTED_SECRET_REQUEST_TIMEOUT_MS)
}

function isEncryptionUnavailable(error: unknown) {
  return (
    (error instanceof ProtectedSecretBridgeError && error.code === "unavailable") ||
    (isRecord(error) && error.code === "encryption_unavailable")
  )
}

function bridgeFailure(error: unknown) {
  return error instanceof ProtectedSecretBridgeError ? error : new ProtectedSecretBridgeError("operation_failed")
}
