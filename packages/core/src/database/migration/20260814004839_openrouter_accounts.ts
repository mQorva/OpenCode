import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260814004839_openrouter_accounts",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`openrouter_account\` (
          \`id\` text PRIMARY KEY,
          \`kind\` text NOT NULL,
          \`state\` text NOT NULL,
          \`label\` text NOT NULL,
          \`key_label\` text,
          \`is_free_tier\` integer,
          \`is_management_key\` integer,
          \`is_provisioning_key\` integer,
          \`include_byok_in_limit\` integer,
          \`limit\` real,
          \`limit_remaining\` real,
          \`limit_reset\` text,
          \`usage\` real,
          \`usage_daily\` real,
          \`usage_weekly\` real,
          \`usage_monthly\` real,
          \`byok_usage\` real,
          \`byok_usage_daily\` real,
          \`byok_usage_weekly\` real,
          \`byok_usage_monthly\` real,
          \`expires_at\` integer,
          \`verified_at\` integer,
          \`fetched_at\` integer NOT NULL,
          \`last_error_category\` text,
          \`last_error_status\` integer,
          \`last_error_retry_after\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`openrouter_model_catalog\` (
          \`id\` text PRIMARY KEY,
          \`fetched_at\` integer NOT NULL,
          \`rejected_count\` integer NOT NULL,
          \`last_error_category\` text,
          \`last_error_status\` integer,
          \`last_error_retry_after\` integer
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`openrouter_model\` (
          \`slug\` text PRIMARY KEY,
          \`data\` text NOT NULL
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
