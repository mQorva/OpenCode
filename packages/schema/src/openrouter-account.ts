export * as OpenRouterAccount from "./openrouter-account"

import { Schema } from "effect"
import { DateTimeUtcFromMillis, NonNegativeInt, PositiveInt, optional } from "./schema"

const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))
const NonNegativePrice = Schema.NumberFromString.check(Schema.isGreaterThanOrEqualTo(0))

export const ID = Schema.String.pipe(Schema.check(Schema.isNonEmpty()), Schema.brand("OpenRouterAccount.ID"))
export type ID = typeof ID.Type

export const ConnectionState = Schema.Literals([
  "unconfigured",
  "verifying",
  "connected",
  "attention",
  "disconnected",
]).annotate({ identifier: "OpenRouterAccount.ConnectionState" })
export type ConnectionState = typeof ConnectionState.Type

export const CredentialKind = Schema.Literals([
  "openrouter_api_key",
  "openrouter_pkce_key",
  "openrouter_management_key",
]).annotate({ identifier: "OpenRouterAccount.CredentialKind" })
export type CredentialKind = typeof CredentialKind.Type

export const LimitReset = Schema.Literals(["daily", "weekly", "monthly"]).annotate({
  identifier: "OpenRouterAccount.LimitReset",
})
export type LimitReset = typeof LimitReset.Type

export const KeyMetadata = Schema.Struct({
  label: Schema.String.pipe(Schema.check(Schema.isNonEmpty())),
  creatorUserId: Schema.String.pipe(optional),
  isFreeTier: Schema.Boolean,
  isManagementKey: Schema.Boolean,
  isProvisioningKey: Schema.Boolean,
  includeByokInLimit: Schema.Boolean.pipe(optional),
  limit: Schema.NullOr(NonNegativeFinite).pipe(optional),
  limitRemaining: Schema.NullOr(NonNegativeFinite).pipe(optional),
  limitReset: Schema.NullOr(LimitReset).pipe(optional),
  usage: NonNegativeFinite,
  usageDaily: NonNegativeFinite,
  usageWeekly: NonNegativeFinite,
  usageMonthly: NonNegativeFinite,
  byokUsage: NonNegativeFinite.pipe(optional),
  byokUsageDaily: NonNegativeFinite.pipe(optional),
  byokUsageWeekly: NonNegativeFinite.pipe(optional),
  byokUsageMonthly: NonNegativeFinite.pipe(optional),
  expiresAt: Schema.NullOr(DateTimeUtcFromMillis).pipe(optional),
}).annotate({ identifier: "OpenRouterAccount.KeyMetadata" })
export interface KeyMetadata extends Schema.Schema.Type<typeof KeyMetadata> {}

export const Account = Schema.Struct({
  id: ID,
  provider: Schema.Literal("openrouter"),
  kind: CredentialKind,
  state: ConnectionState,
  label: Schema.String.pipe(Schema.check(Schema.isNonEmpty())),
  keyMetadata: KeyMetadata.pipe(optional),
  verifiedAt: DateTimeUtcFromMillis.pipe(optional),
  fetchedAt: DateTimeUtcFromMillis,
}).annotate({ identifier: "OpenRouterAccount.Account" })
export interface Account extends Schema.Schema.Type<typeof Account> {}

export const Modality = Schema.Literals(["text", "image", "audio", "file", "embeddings"]).annotate({
  identifier: "OpenRouterAccount.Modality",
})
export type Modality = typeof Modality.Type

export const Modalities = Schema.Struct({
  input: Schema.Array(Modality),
  output: Schema.Array(Modality),
}).annotate({ identifier: "OpenRouterAccount.Modalities" })
export interface Modalities extends Schema.Schema.Type<typeof Modalities> {}

export const Pricing = Schema.Struct({
  prompt: NonNegativePrice,
  completion: NonNegativePrice,
  request: NonNegativePrice.pipe(optional),
  image: NonNegativePrice.pipe(optional),
}).annotate({ identifier: "OpenRouterAccount.Pricing" })
export interface Pricing extends Schema.Schema.Type<typeof Pricing> {}

export const Capabilities = Schema.Struct({
  tools: Schema.Boolean,
  reasoning: Schema.Boolean,
  structuredOutputs: Schema.Boolean,
}).annotate({ identifier: "OpenRouterAccount.Capabilities" })
export interface Capabilities extends Schema.Schema.Type<typeof Capabilities> {}

export const Model = Schema.Struct({
  slug: Schema.String.pipe(Schema.check(Schema.isNonEmpty())),
  name: Schema.String.pipe(Schema.check(Schema.isNonEmpty())),
  contextLength: PositiveInt,
  modalities: Modalities,
  supportedParameters: Schema.Array(Schema.String),
  capabilities: Capabilities,
  pricing: Pricing,
}).annotate({ identifier: "OpenRouterAccount.Model" })
export interface Model extends Schema.Schema.Type<typeof Model> {}

export const ModelCatalog = Schema.Struct({
  fetchedAt: DateTimeUtcFromMillis,
  models: Schema.Array(Model),
}).annotate({ identifier: "OpenRouterAccount.ModelCatalog" })
export interface ModelCatalog extends Schema.Schema.Type<typeof ModelCatalog> {}

export const ProviderErrorCategory = Schema.Literals([
  "validation",
  "secret_storage",
  "auth_cancelled",
  "auth_callback",
  "provider_auth",
  "provider_payment",
  "provider_permission",
  "provider_rate_limit",
  "provider_timeout",
  "provider_unavailable",
  "provider_protocol",
  "persistence",
  "engine_configuration",
]).annotate({ identifier: "OpenRouterAccount.ProviderErrorCategory" })
export type ProviderErrorCategory = typeof ProviderErrorCategory.Type

export const ProviderError = Schema.Struct({
  category: ProviderErrorCategory,
  message: Schema.String.pipe(Schema.check(Schema.isNonEmpty())),
  httpStatus: Schema.Int.pipe(optional),
  retryAfter: NonNegativeInt.pipe(optional),
}).annotate({ identifier: "OpenRouterAccount.ProviderError" })
export interface ProviderError extends Schema.Schema.Type<typeof ProviderError> {}
