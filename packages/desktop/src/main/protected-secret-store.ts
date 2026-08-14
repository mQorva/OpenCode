import { randomBytes } from "node:crypto"

export interface CryptoAdapter {
  readonly isEncryptionAvailable: () => boolean
  readonly encryptString: (value: string) => Uint8Array
  readonly decryptString: (value: Uint8Array) => string
}

export interface KeyValueStore {
  readonly get: (key: string) => string | undefined
  readonly set: (key: string, value: string) => void
  readonly delete: (key: string) => void
}

export type ProtectedSecretStoreErrorCode =
  | "encryption_unavailable"
  | "invalid_ref"
  | "empty_secret"
  | "encryption_failed"
  | "decryption_failed"
  | "storage_failed"

export class ProtectedSecretStoreError extends Error {
  readonly code: ProtectedSecretStoreErrorCode

  constructor(code: ProtectedSecretStoreErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "ProtectedSecretStoreError"
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}

export class ProtectedSecretStore {
  constructor(
    private readonly crypto: CryptoAdapter,
    private readonly store: KeyValueStore,
  ) {}

  put(value: string, existingRef?: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new ProtectedSecretStoreError("empty_secret", "Secret must not be empty")
    }
    if (existingRef !== undefined) validateRef(existingRef)
    this.requireEncryption()

    const ref = existingRef ?? createRef()
    const ciphertext = this.encrypt(value)
    try {
      this.store.set(ref, ciphertext)
    } catch (cause) {
      throw new ProtectedSecretStoreError("storage_failed", "Secret could not be stored", cause)
    }
    return ref
  }

  get(ref: string): string | undefined {
    validateRef(ref)
    this.requireEncryption()

    let encoded: string | undefined
    try {
      encoded = this.store.get(ref)
    } catch (cause) {
      throw new ProtectedSecretStoreError("storage_failed", "Secret could not be read", cause)
    }
    if (encoded === undefined) return undefined

    let ciphertext: Uint8Array
    try {
      ciphertext = decodeBase64(encoded)
    } catch (cause) {
      throw new ProtectedSecretStoreError("decryption_failed", "Secret could not be decrypted", cause)
    }
    try {
      return this.crypto.decryptString(ciphertext)
    } catch (cause) {
      throw new ProtectedSecretStoreError("decryption_failed", "Secret could not be decrypted", cause)
    }
  }

  delete(ref: string): boolean {
    validateRef(ref)
    let existing: string | undefined
    try {
      existing = this.store.get(ref)
    } catch (cause) {
      throw new ProtectedSecretStoreError("storage_failed", "Secret could not be checked", cause)
    }
    if (existing === undefined) return false

    try {
      this.store.delete(ref)
    } catch (cause) {
      throw new ProtectedSecretStoreError("storage_failed", "Secret could not be deleted", cause)
    }
    return true
  }

  has(ref: string): boolean {
    validateRef(ref)
    try {
      return this.store.get(ref) !== undefined
    } catch (cause) {
      throw new ProtectedSecretStoreError("storage_failed", "Secret could not be checked", cause)
    }
  }

  private requireEncryption() {
    let available: boolean
    try {
      available = this.crypto.isEncryptionAvailable()
    } catch (cause) {
      throw new ProtectedSecretStoreError("encryption_unavailable", "Protected encryption is unavailable", cause)
    }
    if (!available) throw new ProtectedSecretStoreError("encryption_unavailable", "Protected encryption is unavailable")
  }

  private encrypt(value: string): string {
    let ciphertext: Uint8Array
    try {
      ciphertext = this.crypto.encryptString(value)
    } catch (cause) {
      throw new ProtectedSecretStoreError("encryption_failed", "Secret could not be encrypted", cause)
    }
    if (ciphertext.length === 0) {
      throw new ProtectedSecretStoreError("encryption_failed", "Secret could not be encrypted")
    }
    return Buffer.from(ciphertext).toString("base64")
  }
}

function createRef() {
  return `sec_${randomBytes(24).toString("base64url")}`
}

function validateRef(ref: string) {
  if (!/^sec_[A-Za-z0-9_-]{1,128}$/.test(ref)) {
    throw new ProtectedSecretStoreError("invalid_ref", "Invalid protected secret reference")
  }
}

function decodeBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error("Invalid ciphertext encoding")
  }
  const decoded = Buffer.from(value, "base64")
  if (decoded.toString("base64") !== value) throw new Error("Invalid ciphertext encoding")
  return decoded
}
