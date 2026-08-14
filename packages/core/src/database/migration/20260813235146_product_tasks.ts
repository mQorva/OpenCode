import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260813235146_product_tasks",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`product_run\` (
          \`id\` text PRIMARY KEY,
          \`task_id\` text NOT NULL,
          \`sequence\` integer NOT NULL,
          \`session_id\` text,
          \`status\` text NOT NULL,
          \`trigger\` text NOT NULL,
          \`time_started\` integer,
          \`time_finished\` integer,
          \`failure_code\` text,
          \`failure_message\` text,
          \`completion_summary\` text,
          CONSTRAINT \`fk_product_run_task_id_product_task_id_fk\` FOREIGN KEY (\`task_id\`) REFERENCES \`product_task\`(\`id\`),
          CONSTRAINT \`fk_product_run_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`)
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`product_task\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`title\` text NOT NULL,
          \`description\` text NOT NULL,
          \`status\` text NOT NULL,
          \`position\` integer NOT NULL,
          \`version\` integer NOT NULL,
          \`active_run_id\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_completed\` integer,
          \`time_cancelled\` integer,
          \`time_archived\` integer,
          CONSTRAINT \`fk_product_task_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`),
          CONSTRAINT \`fk_product_task_active_run_id_product_run_id_fk\` FOREIGN KEY (\`active_run_id\`) REFERENCES \`product_run\`(\`id\`)
        );
      `)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`product_run_task_sequence_idx\` ON \`product_run\` (\`task_id\`,\`sequence\`);`,
      )
      yield* tx.run(`CREATE UNIQUE INDEX \`product_run_session_idx\` ON \`product_run\` (\`session_id\`);`)
      yield* tx.run(`CREATE INDEX \`product_run_task_status_idx\` ON \`product_run\` (\`task_id\`,\`status\`);`)
      yield* tx.run(
        `CREATE INDEX \`product_task_project_status_position_idx\` ON \`product_task\` (\`project_id\`,\`status\`,\`position\`);`,
      )
      yield* tx.run(`CREATE INDEX \`product_task_project_idx\` ON \`product_task\` (\`project_id\`);`)
      yield* tx.run(`CREATE INDEX \`product_task_status_idx\` ON \`product_task\` (\`status\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
