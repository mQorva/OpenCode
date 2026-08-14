import { describe, expect, test } from "bun:test"
import { DateTime, Schema } from "effect"
import { OpenRouterAccount } from "@opencode-ai/schema/openrouter-account"

const decodeAccount = Schema.decodeUnknownSync(OpenRouterAccount.Account)

const account = {
  id: "oracct_test",
  provider: "openrouter",
  kind: "openrouter_api_key",
  state: "connected",
  label: "Development",
  keyMetadata: {
    label: "sk-or-v1-abc...xyz",
    isFreeTier: false,
    isManagementKey: false,
    isProvisioningKey: false,
    usage: 1.5,
    usageDaily: 1.5,
    usageWeekly: 1.5,
    usageMonthly: 1.5,
    expiresAt: 1_754_064_000_000,
  },
  verifiedAt: 1_754_064_000_000,
  fetchedAt: 1_754_064_000_000,
} as const

describe("OpenRouter account schemas", () => {
  test("accepts all contract connection states and credential kinds", () => {
    for (const value of ["unconfigured", "verifying", "connected", "attention", "disconnected"] as const) {
      expect(Schema.decodeUnknownSync(OpenRouterAccount.ConnectionState)(value)).toBe(value)
    }

    for (const value of ["openrouter_api_key", "openrouter_pkce_key", "openrouter_management_key"] as const) {
      expect(Schema.decodeUnknownSync(OpenRouterAccount.CredentialKind)(value)).toBe(value)
    }
  })

  test("projects safe key metadata without accepting or returning secret fields", () => {
    const metadata = Schema.decodeUnknownSync(OpenRouterAccount.KeyMetadata)({
      ...account.keyMetadata,
      key: "sk-or-v1-secret-value",
    })
    expect(metadata).not.toHaveProperty("key")

    const projected = decodeAccount({ ...account, apiKey: "sk-or-v1-secret-value", secretRef: "sec_private" })
    expect(projected).not.toHaveProperty("apiKey")
    expect(projected).not.toHaveProperty("secretRef")
    expect(projected.keyMetadata).not.toHaveProperty("key")
  })

  test("decodes DateTime fields using the shared UTC millisecond convention", () => {
    const projected = decodeAccount(account)
    expect(DateTime.toEpochMillis(projected.fetchedAt)).toBe(1_754_064_000_000)
    expect(DateTime.toEpochMillis(projected.verifiedAt!)).toBe(1_754_064_000_000)
    expect(DateTime.toEpochMillis(projected.keyMetadata!.expiresAt!)).toBe(1_754_064_000_000)
  })

  test("requires valid account, key, model, pricing, and error fields", () => {
    expect(() => decodeAccount({ ...account, label: "" })).toThrow()
    expect(() => decodeAccount({ ...account, keyMetadata: { ...account.keyMetadata, usage: -1 } })).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(OpenRouterAccount.Model)({
        slug: "",
        name: "GPT",
        contextLength: 128_000,
        modalities: { input: ["text"], output: ["text"] },
        supportedParameters: ["temperature"],
        capabilities: { tools: true, reasoning: true, structuredOutputs: true },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      }),
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(OpenRouterAccount.Model)({
        slug: "openai/gpt-4",
        name: "GPT-4",
        contextLength: 0,
        modalities: { input: ["text"], output: ["text"] },
        supportedParameters: ["temperature"],
        capabilities: { tools: true, reasoning: true, structuredOutputs: true },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      }),
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(OpenRouterAccount.ProviderError)({
        category: "provider_rate_limit",
        message: "Too many requests",
        httpStatus: 429,
        retryAfter: -1,
      }),
    ).toThrow()
  })

  test("projects model identity, capabilities, modalities, and pricing", () => {
    const model = Schema.decodeUnknownSync(OpenRouterAccount.Model)({
      slug: "openai/gpt-4",
      name: "GPT-4",
      contextLength: 8192,
      modalities: { input: ["text", "image"], output: ["text"] },
      supportedParameters: ["temperature", "top_p", "max_tokens"],
      capabilities: { tools: true, reasoning: false, structuredOutputs: true },
      pricing: { prompt: "0.00003", completion: "0.00006", request: "0", image: "0" },
    })
    expect(model.slug).toBe("openai/gpt-4")
    expect(model.contextLength).toBe(8192)
    expect(model.pricing.prompt).toBe(0.00003)
    expect(model.supportedParameters).toContain("max_tokens")
  })

  test("keeps optional provider error context typed", () => {
    const error = Schema.decodeUnknownSync(OpenRouterAccount.ProviderError)({
      category: "provider_unavailable",
      message: "OpenRouter is unavailable",
    })
    expect(error.httpStatus).toBeUndefined()
    expect(error.retryAfter).toBeUndefined()
  })
})
