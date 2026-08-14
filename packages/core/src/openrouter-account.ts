export * as OpenRouterAccountService from "./openrouter-account"

import { OpenRouterAccount } from "@opencode-ai/schema/openrouter-account"
import { Integration } from "@opencode-ai/schema/integration"
import { asc, eq } from "drizzle-orm"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { Credential } from "./credential"
import { Database } from "./database/database"
import { makeGlobalNode } from "./effect/app-node"
import { OpenRouterClient } from "./openrouter-client"
import { OpenRouterAccountTable, OpenRouterModelCatalogTable, OpenRouterModelTable } from "./openrouter-account/sql"

const accountID = OpenRouterAccount.ID.make("openrouter_default")
const catalogID = "openrouter_default"
const integrationID = Integration.ID.make("openrouter")

export class Error extends Schema.TaggedErrorClass<Error>()("OpenRouterAccountService.Error", {
  category: OpenRouterAccount.ProviderErrorCategory,
  message: Schema.String,
  httpStatus: Schema.optional(Schema.Number),
  retryAfter: Schema.optional(Schema.Number),
}) {}

export type ConnectInput = {
  readonly key: string
  readonly label?: string
  readonly kind?: OpenRouterAccount.CredentialKind
}

export interface Interface {
  readonly get: () => Effect.Effect<OpenRouterAccount.Account | undefined, Error>
  readonly connectKey: (input: ConnectInput) => Effect.Effect<OpenRouterAccount.Account, Error>
  readonly verify: () => Effect.Effect<OpenRouterAccount.Account, Error>
  readonly models: () => Effect.Effect<OpenRouterAccount.ModelCatalog | undefined, Error>
  readonly refreshModels: () => Effect.Effect<OpenRouterAccount.ModelCatalog, Error>
  readonly remove: () => Effect.Effect<void, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenRouterAccount") {}

const message = (category: OpenRouterAccount.ProviderErrorCategory) => {
  if (category === "validation") return "Die OpenRouter-Zugangsdaten sind unvollständig."
  if (category === "secret_storage") return "Der geschützte Zugang konnte nicht verarbeitet werden."
  if (category === "provider_auth") return "OpenRouter hat den Zugang nicht akzeptiert."
  if (category === "provider_payment") return "OpenRouter meldet ein Guthaben- oder Zahlungsthema."
  if (category === "provider_permission") return "Der Zugang hat für diese OpenRouter-Aktion keine Berechtigung."
  if (category === "provider_rate_limit") return "OpenRouter begrenzt die Anfrage vorübergehend."
  if (category === "provider_timeout") return "OpenRouter hat nicht rechtzeitig geantwortet."
  if (category === "provider_unavailable") return "OpenRouter ist vorübergehend nicht erreichbar."
  if (category === "provider_protocol") return "Die OpenRouter-Antwort konnte nicht verarbeitet werden."
  if (category === "persistence") return "Die OpenRouter-Verbindung konnte nicht gespeichert werden."
  return "Die OpenRouter-Verbindung konnte nicht verarbeitet werden."
}

const failure = (
  category: OpenRouterAccount.ProviderErrorCategory,
  context?: { readonly status?: number; readonly retryAfter?: number },
) =>
  new Error({
    category,
    message: message(category),
    httpStatus: context?.status,
    retryAfter: context?.retryAfter,
  })

const clientFailure = (error: OpenRouterClient.ProviderError) =>
  failure(error.category, { status: error.status, retryAfter: error.retryAfterSeconds })

const persistence = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError(() => failure("persistence")))

const secret = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError(() => failure("secret_storage")))

const isKnownModality = (value: string): value is OpenRouterAccount.Modality =>
  value === "text" || value === "image" || value === "audio" || value === "file" || value === "embeddings"

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const credentials = yield* Credential.Service
    const client = yield* OpenRouterClient.Service

    const accountFromRow = (row: typeof OpenRouterAccountTable.$inferSelect) => {
      const hasMetadata = row.key_label !== null
      return OpenRouterAccount.Account.make({
        id: row.id,
        provider: "openrouter",
        kind: row.kind,
        state: row.state,
        label: row.label,
        keyMetadata: hasMetadata
          ? OpenRouterAccount.KeyMetadata.make({
              label: row.key_label!,
              isFreeTier: row.is_free_tier ?? false,
              isManagementKey: row.is_management_key ?? false,
              isProvisioningKey: row.is_provisioning_key ?? false,
              includeByokInLimit: row.include_byok_in_limit ?? undefined,
              limit: row.limit,
              limitRemaining: row.limit_remaining,
              limitReset: row.limit_reset,
              usage: row.usage ?? 0,
              usageDaily: row.usage_daily ?? 0,
              usageWeekly: row.usage_weekly ?? 0,
              usageMonthly: row.usage_monthly ?? 0,
              byokUsage: row.byok_usage ?? undefined,
              byokUsageDaily: row.byok_usage_daily ?? undefined,
              byokUsageWeekly: row.byok_usage_weekly ?? undefined,
              byokUsageMonthly: row.byok_usage_monthly ?? undefined,
              expiresAt: row.expires_at === null ? undefined : DateTime.makeUnsafe(row.expires_at),
            })
          : undefined,
        verifiedAt: row.verified_at === null ? undefined : DateTime.makeUnsafe(row.verified_at),
        fetchedAt: DateTime.makeUnsafe(row.fetched_at),
      })
    }

    const getRow = () =>
      persistence(db.select().from(OpenRouterAccountTable).where(eq(OpenRouterAccountTable.id, accountID)).get())

    const getAccount = Effect.fn("OpenRouterAccount.get")(function* () {
      const row = yield* getRow()
      return row ? accountFromRow(row) : undefined
    })

    const metadataValues = (metadata: OpenRouterClient.KeyMetadata, now: number) => ({
      state:
        (metadata.limit_remaining !== null && metadata.limit_remaining <= 0) ||
        (metadata.expires_at !== null && Date.parse(metadata.expires_at) <= now)
          ? ("attention" as const)
          : ("connected" as const),
      key_label: metadata.label,
      is_free_tier: metadata.is_free_tier,
      is_management_key: metadata.is_management_key,
      is_provisioning_key: metadata.is_provisioning_key,
      include_byok_in_limit: metadata.include_byok_in_limit,
      limit: metadata.limit,
      limit_remaining: metadata.limit_remaining,
      limit_reset: metadata.limit_reset,
      usage: metadata.usage,
      usage_daily: metadata.usage_daily,
      usage_weekly: metadata.usage_weekly,
      usage_monthly: metadata.usage_monthly,
      byok_usage: metadata.byok_usage,
      byok_usage_daily: metadata.byok_usage_daily,
      byok_usage_weekly: metadata.byok_usage_weekly,
      byok_usage_monthly: metadata.byok_usage_monthly,
      expires_at: metadata.expires_at === null ? null : Date.parse(metadata.expires_at),
      verified_at: now,
      fetched_at: now,
      last_error_category: null,
      last_error_status: null,
      last_error_retry_after: null,
      time_updated: now,
    })

    const recordVerificationFailure = Effect.fn("OpenRouterAccount.recordVerificationFailure")(function* (
      error: OpenRouterClient.ProviderError,
    ) {
      if (error.category !== "provider_auth" && error.category !== "provider_payment") return
      yield* persistence(
        db
          .update(OpenRouterAccountTable)
          .set({
            state: "attention",
            last_error_category: error.category,
            last_error_status: error.status,
            last_error_retry_after: error.retryAfterSeconds,
            time_updated: Date.now(),
          })
          .where(eq(OpenRouterAccountTable.id, accountID))
          .run(),
      ).pipe(Effect.catch(() => Effect.void))
    })

    const verifyKey = Effect.fn("OpenRouterAccount.verifyKey")(function* (key: string) {
      return yield* client.currentKey(key).pipe(Effect.mapError(clientFailure))
    })

    const resolvedKey = Effect.fn("OpenRouterAccount.resolvedKey")(function* () {
      const active = (yield* credentials.list(integrationID))[0]
      if (!active) return yield* failure("validation")
      const value = yield* secret(credentials.resolve(active.id))
      if (!value || value.type !== "key") return yield* failure("secret_storage")
      return { active, key: value.key }
    })

    const saveVerified = Effect.fn("OpenRouterAccount.saveVerified")(function* (
      metadata: OpenRouterClient.KeyMetadata,
      kind: OpenRouterAccount.CredentialKind,
      label: string,
    ) {
      const now = Date.now()
      yield* persistence(
        db
          .insert(OpenRouterAccountTable)
          .values({
            id: accountID,
            kind,
            label,
            time_created: now,
            ...metadataValues(metadata, now),
          })
          .onConflictDoUpdate({
            target: OpenRouterAccountTable.id,
            set: { kind, label, ...metadataValues(metadata, now) },
          })
          .run(),
      )
      return yield* getAccount().pipe(
        Effect.flatMap((account) => (account ? Effect.succeed(account) : Effect.fail(failure("persistence")))),
      )
    })

    const modelProjection = (model: OpenRouterClient.Model): OpenRouterAccount.Model | undefined => {
      const input = model.architecture.input_modalities.filter(isKnownModality)
      const output = model.architecture.output_modalities.filter(isKnownModality)
      const parsePrice = (value: string | undefined) => {
        if (value === undefined) return undefined
        const parsed = Number(value)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
      }
      const prompt = parsePrice(model.pricing.prompt)
      const completion = parsePrice(model.pricing.completion)
      if (
        !Number.isInteger(model.context_length) ||
        model.context_length <= 0 ||
        prompt === undefined ||
        completion === undefined
      )
        return undefined
      const parameters = [...model.supported_parameters]
      return OpenRouterAccount.Model.make({
        slug: model.id,
        name: model.name,
        contextLength: model.context_length,
        modalities: { input, output },
        supportedParameters: parameters,
        capabilities: {
          tools: parameters.includes("tools") || parameters.includes("tool_choice"),
          reasoning: parameters.includes("reasoning"),
          structuredOutputs:
            parameters.includes("response_format") ||
            parameters.includes("structured_outputs") ||
            parameters.includes("json_schema"),
        },
        pricing: {
          prompt,
          completion,
          request: parsePrice(model.pricing.request),
          image: parsePrice(model.pricing.image),
        },
      })
    }

    const getModels = Effect.fn("OpenRouterAccount.models")(function* () {
      const catalog = yield* persistence(
        db.select().from(OpenRouterModelCatalogTable).where(eq(OpenRouterModelCatalogTable.id, catalogID)).get(),
      )
      if (!catalog) return undefined
      const rows = yield* persistence(
        db.select().from(OpenRouterModelTable).orderBy(asc(OpenRouterModelTable.slug)).all(),
      )
      return OpenRouterAccount.ModelCatalog.make({
        fetchedAt: DateTime.makeUnsafe(catalog.fetched_at),
        models: rows.map((row) => row.data),
      })
    })

    const recordCatalogFailure = Effect.fn("OpenRouterAccount.recordCatalogFailure")(function* (
      error: OpenRouterClient.ProviderError,
    ) {
      yield* persistence(
        db
          .update(OpenRouterModelCatalogTable)
          .set({
            last_error_category: error.category,
            last_error_status: error.status,
            last_error_retry_after: error.retryAfterSeconds,
          })
          .where(eq(OpenRouterModelCatalogTable.id, catalogID))
          .run(),
      ).pipe(Effect.catch(() => Effect.void))
    })

    return Service.of({
      get: getAccount,
      connectKey: Effect.fn("OpenRouterAccount.connectKey")(function* (input) {
        const key = input.key.trim()
        const label = input.label?.trim()
        if (!key || (input.label !== undefined && !label)) return yield* failure("validation")
        const kind = input.kind ?? "openrouter_api_key"
        if (kind === "openrouter_management_key") return yield* failure("validation")

        const staged = yield* secret(
          credentials.stageProtected(Credential.Key.make({ type: "key", key, metadata: { origin: kind } })),
        )
        const metadata = yield* verifyKey(key).pipe(
          Effect.onExit((exit) =>
            exit._tag === "Failure"
              ? credentials.discardProtected(staged).pipe(Effect.catch(() => Effect.void))
              : Effect.void,
          ),
        )
        const existing = (yield* credentials.list(integrationID))[0]
        if (existing?.protected) {
          yield* secret(
            credentials.update(existing.id, {
              label: label ?? metadata.label,
              value: Credential.Key.make({ type: "key", key, metadata: { origin: kind } }),
            }),
          )
          yield* secret(credentials.discardProtected(staged))
        } else {
          yield* secret(
            credentials.commitProtected({
              integrationID,
              label: label ?? metadata.label,
              secretRef: staged,
            }),
          )
        }
        return yield* saveVerified(metadata, kind, label ?? metadata.label)
      }),
      verify: Effect.fn("OpenRouterAccount.verify")(function* () {
        const { key } = yield* resolvedKey()
        const current = yield* getAccount()
        const metadata = yield* client
          .currentKey(key)
          .pipe(Effect.tapError(recordVerificationFailure), Effect.mapError(clientFailure))
        return yield* saveVerified(metadata, current?.kind ?? "openrouter_api_key", current?.label ?? metadata.label)
      }),
      models: getModels,
      refreshModels: Effect.fn("OpenRouterAccount.refreshModels")(function* () {
        const { key } = yield* resolvedKey()
        const remote = yield* client
          .models(key)
          .pipe(Effect.tapError(recordCatalogFailure), Effect.mapError(clientFailure))
        const projected = remote.models.flatMap((model) => {
          try {
            const value = modelProjection(model)
            return value ? [value] : []
          } catch {
            return []
          }
        })
        const rejected = remote.rejected + remote.models.length - projected.length
        if (remote.models.length > 0 && projected.length === 0) return yield* failure("provider_protocol")
        const fetchedAt = Date.now()
        yield* persistence(
          db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx.delete(OpenRouterModelTable).run()
              if (projected.length > 0) {
                yield* tx
                  .insert(OpenRouterModelTable)
                  .values(projected.map((model) => ({ slug: model.slug, data: model })))
                  .run()
              }
              yield* tx
                .insert(OpenRouterModelCatalogTable)
                .values({ id: catalogID, fetched_at: fetchedAt, rejected_count: rejected })
                .onConflictDoUpdate({
                  target: OpenRouterModelCatalogTable.id,
                  set: {
                    fetched_at: fetchedAt,
                    rejected_count: rejected,
                    last_error_category: null,
                    last_error_status: null,
                    last_error_retry_after: null,
                  },
                })
                .run()
            }),
          ),
        )
        return OpenRouterAccount.ModelCatalog.make({ fetchedAt: DateTime.makeUnsafe(fetchedAt), models: projected })
      }),
      remove: Effect.fn("OpenRouterAccount.remove")(function* () {
        for (const credential of yield* credentials.list(integrationID)) {
          yield* secret(credentials.remove(credential.id))
        }
        yield* persistence(
          db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx.delete(OpenRouterAccountTable).run()
              yield* tx.delete(OpenRouterModelTable).run()
              yield* tx.delete(OpenRouterModelCatalogTable).run()
            }),
          ),
        )
      }),
    })
  }),
)

export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [Database.node, Credential.node, OpenRouterClient.node],
})
