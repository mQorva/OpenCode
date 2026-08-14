import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { OpenRouterClient } from "@opencode-ai/core/openrouter-client"
import { testEffect } from "./lib/effect"

const response = (request: HttpClientRequest.HttpClientRequest, body: unknown, status = 200, headers?: Headers) =>
  HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body), { status, headers }))

const mock = (handler: (request: HttpClientRequest.HttpClientRequest) => HttpClientResponse.HttpClientResponse) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => Effect.succeed(handler(request))),
  )

const keyMetadata = {
  label: "sk-or-v1-abc...xyz",
  is_free_tier: false,
  is_management_key: false,
  is_provisioning_key: false,
  limit: 100,
  limit_remaining: 74.5,
  limit_reset: "monthly",
  usage: 25.5,
  usage_daily: 1,
  usage_weekly: 5,
  usage_monthly: 25.5,
  byok_usage: 0,
  byok_usage_daily: 0,
  byok_usage_weekly: 0,
  byok_usage_monthly: 0,
  expires_at: "2027-12-31T23:59:59Z",
}

const layer = (client: Layer.Layer<HttpClient.HttpClient>) =>
  LayerNode.compile(OpenRouterClient.node, [[httpClient, client]] as const)

describe("OpenRouterClient", () => {
  testEffect(
    layer(
      mock((request) => {
        expect(request.url).toBe("https://openrouter.ai/api/v1/key")
        expect(request.headers.authorization).toBe("Bearer test-key")
        return response(request, { data: keyMetadata })
      }),
    ),
  ).effect("decodes current key metadata without returning the key", () =>
    Effect.gen(function* () {
      const client = yield* OpenRouterClient.Service
      const result = yield* client.currentKey("test-key")
      expect(result.label).toBe(keyMetadata.label)
      expect(JSON.stringify(result)).not.toContain("test-key")
    }),
  )

  testEffect(
    layer(
      mock((request) =>
        response(request, {
          data: [
            {
              id: "openai/gpt-4",
              name: "GPT-4",
              context_length: 8192,
              architecture: { input_modalities: ["text"], output_modalities: ["text"] },
              supported_parameters: ["temperature"],
              pricing: { prompt: "0.00003", completion: "0.00006" },
            },
            { id: "broken" },
          ],
        }),
      ),
    ),
  ).effect("keeps valid models and counts malformed entries", () =>
    Effect.gen(function* () {
      const client = yield* OpenRouterClient.Service
      const result = yield* client.models("test-key")
      expect(result.models.map((model) => model.id)).toEqual(["openai/gpt-4"])
      expect(result.rejected).toBe(1)
    }),
  )

  testEffect(
    layer(
      mock((request) =>
        response(request, { error: { message: "rate limited" } }, 429, new Headers({ "retry-after": "7" })),
      ),
    ),
  ).effect("classifies status errors without exposing response bodies", () =>
    Effect.gen(function* () {
      const client = yield* OpenRouterClient.Service
      const error = yield* client.currentKey("secret-key").pipe(Effect.flip)
      expect(error.category).toBe("provider_rate_limit")
      expect(error.status).toBe(429)
      expect(error.retryAfterSeconds).toBe(7)
      expect(error.message).not.toContain("secret-key")
      expect(error.message).not.toContain("rate limited")
    }),
  )

  testEffect(
    layer(
      mock((request) => {
        expect(request.url).toBe("https://openrouter.ai/api/v1/auth/keys")
        expect(request.method).toBe("POST")
        expect(request.headers.authorization).toBeUndefined()
        return response(request, { key: "issued-key", user_id: "user_123" })
      }),
    ),
  ).effect("exchanges a PKCE code without requiring an existing bearer key", () =>
    Effect.gen(function* () {
      const client = yield* OpenRouterClient.Service
      expect(yield* client.exchange("authorization-code", "code-verifier")).toEqual({
        key: "issued-key",
        user_id: "user_123",
      })
    }),
  )

  testEffect(layer(mock((request) => response(request, { error: "invalid code" }, 403)))).effect(
    "classifies rejected PKCE exchanges separately",
    () =>
      Effect.gen(function* () {
        const client = yield* OpenRouterClient.Service
        const error = yield* client.exchange("bad-code", "code-verifier").pipe(Effect.flip)
        expect(error.category).toBe("auth_callback")
        expect(error.status).toBe(403)
        expect(error.message).not.toContain("bad-code")
      }),
  )
})
