import { describe, expect, test } from "bun:test"
import { ProtectedSecretStore, ProtectedSecretStoreError } from "./protected-secret-store"

function createFixture(options?: {
  available?: boolean
  encrypt?: (value: string) => Uint8Array
  decrypt?: (value: Uint8Array) => string
}) {
  const values = new Map<string, string>()
  const crypto = {
    isEncryptionAvailable: () => options?.available ?? true,
    encryptString: options?.encrypt ?? ((value: string) => new TextEncoder().encode(`encrypted:${value}`)),
    decryptString:
      options?.decrypt ?? ((value: Uint8Array) => new TextDecoder().decode(value).replace(/^encrypted:/, "")),
  }
  const store = {
    get: (key: string) => values.get(key),
    set: (key: string, value: string) => void values.set(key, value),
    delete: (key: string) => void values.delete(key),
  }
  return { store: new ProtectedSecretStore(crypto, store), values }
}

describe("ProtectedSecretStore", () => {
  test("roundtrips a secret", () => {
    const fixture = createFixture()
    const ref = fixture.store.put("openrouter-key")

    expect(ref.startsWith("sec_")).toBe(true)
    expect(fixture.store.get(ref)).toBe("openrouter-key")
    expect(fixture.store.has(ref)).toBe(true)
  })

  test("stores ciphertext rather than plaintext", () => {
    const fixture = createFixture()
    const ref = fixture.store.put("do-not-store-plaintext")

    expect(fixture.values.get(ref)).toBeDefined()
    expect(fixture.values.get(ref)).not.toContain("do-not-store-plaintext")
    expect(fixture.values.get(ref)).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
  })

  test("returns undefined and false for a missing secret", () => {
    const fixture = createFixture()

    expect(fixture.store.get("sec_missing")).toBeUndefined()
    expect(fixture.store.has("sec_missing")).toBe(false)
    expect(fixture.store.delete("sec_missing")).toBe(false)
  })

  test("deletes a stored secret", () => {
    const fixture = createFixture()
    const ref = fixture.store.put("temporary")

    expect(fixture.store.delete(ref)).toBe(true)
    expect(fixture.store.has(ref)).toBe(false)
    expect(fixture.store.get(ref)).toBeUndefined()
  })

  test("replaces in place only after encryption succeeds", () => {
    let fail = false
    const fixture = createFixture({
      encrypt: (value) => {
        if (fail) throw new Error("encryption failed")
        return new TextEncoder().encode(`encrypted:${value}`)
      },
    })
    const ref = fixture.store.put("first")

    expect(fixture.store.put("second", ref)).toBe(ref)
    expect(fixture.store.get(ref)).toBe("second")

    fail = true
    expect(() => fixture.store.put("third", ref)).toThrowError(ProtectedSecretStoreError)
    expect(fixture.store.get(ref)).toBe("second")
  })

  test("reports unavailable encryption", () => {
    const fixture = createFixture({ available: false })

    expect(() => fixture.store.put("secret")).toThrowError(expect.objectContaining({ code: "encryption_unavailable" }))
  })

  test("classifies encryption and decryption failures", () => {
    const encryptionFailure = createFixture({
      encrypt: () => {
        throw new Error("failed")
      },
    })
    expect(() => encryptionFailure.store.put("secret")).toThrowError(
      expect.objectContaining({ code: "encryption_failed" }),
    )

    const decryptionFailure = createFixture({
      decrypt: () => {
        throw new Error("failed")
      },
    })
    const ref = decryptionFailure.store.put("secret")
    expect(() => decryptionFailure.store.get(ref)).toThrowError(expect.objectContaining({ code: "decryption_failed" }))
  })

  test("rejects invalid references", () => {
    const fixture = createFixture()

    expect(() => fixture.store.get("settings.apiKey")).toThrowError(expect.objectContaining({ code: "invalid_ref" }))
    expect(() => fixture.store.delete("secret")).toThrowError(expect.objectContaining({ code: "invalid_ref" }))
    expect(() => fixture.store.put("secret", "sec_/../secret")).toThrowError(
      expect.objectContaining({ code: "invalid_ref" }),
    )
  })

  test("rejects empty secrets", () => {
    const fixture = createFixture()

    expect(() => fixture.store.put("")).toThrowError(expect.objectContaining({ code: "empty_secret" }))
  })
})
