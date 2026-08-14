import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { OpenRouterAccount } from "@opencode-ai/schema/openrouter-account"

export const OpenRouterAccountTable = sqliteTable("openrouter_account", {
  id: text().$type<OpenRouterAccount.ID>().primaryKey(),
  kind: text().$type<OpenRouterAccount.CredentialKind>().notNull(),
  state: text().$type<OpenRouterAccount.ConnectionState>().notNull(),
  label: text().notNull(),
  key_label: text(),
  is_free_tier: integer({ mode: "boolean" }),
  is_management_key: integer({ mode: "boolean" }),
  is_provisioning_key: integer({ mode: "boolean" }),
  include_byok_in_limit: integer({ mode: "boolean" }),
  limit: real(),
  limit_remaining: real(),
  limit_reset: text().$type<OpenRouterAccount.LimitReset>(),
  usage: real(),
  usage_daily: real(),
  usage_weekly: real(),
  usage_monthly: real(),
  byok_usage: real(),
  byok_usage_daily: real(),
  byok_usage_weekly: real(),
  byok_usage_monthly: real(),
  expires_at: integer(),
  verified_at: integer(),
  fetched_at: integer().notNull(),
  last_error_category: text().$type<OpenRouterAccount.ProviderErrorCategory>(),
  last_error_status: integer(),
  last_error_retry_after: integer(),
  time_created: integer().notNull(),
  time_updated: integer().notNull(),
})

export const OpenRouterModelTable = sqliteTable("openrouter_model", {
  slug: text().primaryKey(),
  data: text({ mode: "json" }).$type<OpenRouterAccount.Model>().notNull(),
})

export const OpenRouterModelCatalogTable = sqliteTable("openrouter_model_catalog", {
  id: text().primaryKey(),
  fetched_at: integer().notNull(),
  rejected_count: integer().notNull(),
  last_error_category: text().$type<OpenRouterAccount.ProviderErrorCategory>(),
  last_error_status: integer(),
  last_error_retry_after: integer(),
})
