import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260903172836_session_permission_level",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session\` ADD \`permission_level\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
