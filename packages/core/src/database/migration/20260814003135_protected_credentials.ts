import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260814003135_protected_credentials",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`credential\` ADD \`secret_ref\` text;`)
      yield* tx.run(`PRAGMA foreign_keys=OFF;`)
      yield* tx.run(`
        CREATE TABLE \`__new_credential\` (
          \`id\` text PRIMARY KEY,
          \`integration_id\` text,
          \`label\` text NOT NULL,
          \`value\` text,
          \`secret_ref\` text,
          \`connector_id\` text,
          \`method_id\` text,
          \`active\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(
        `INSERT INTO \`__new_credential\`(\`id\`, \`integration_id\`, \`label\`, \`value\`, \`connector_id\`, \`method_id\`, \`active\`, \`time_created\`, \`time_updated\`) SELECT \`id\`, \`integration_id\`, \`label\`, \`value\`, \`connector_id\`, \`method_id\`, \`active\`, \`time_created\`, \`time_updated\` FROM \`credential\`;`,
      )
      yield* tx.run(`DROP TABLE \`credential\`;`)
      yield* tx.run(`ALTER TABLE \`__new_credential\` RENAME TO \`credential\`;`)
      yield* tx.run(`PRAGMA foreign_keys=ON;`)
    })
  },
} satisfies DatabaseMigration.Migration
