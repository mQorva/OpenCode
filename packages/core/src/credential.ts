export * as Credential from "./credential"

import { asc, eq } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Credential } from "@opencode-ai/schema/credential"
import { Integration } from "@opencode-ai/schema/integration"
import { Database } from "./database/database"
import { makeGlobalNode } from "./effect/app-node"
import { CredentialTable } from "./credential/sql"
import { ProtectedSecret } from "./protected-secret"

export const ID = Credential.ID
export type ID = Credential.ID

export const OAuth = Credential.OAuth
export type OAuth = Credential.OAuth

export const Key = Credential.Key
export type Key = Credential.Key

export const Value = Credential.Value
export type Value = Credential.Value

export class Info extends Schema.Class<Info>("Credential.Info")({
  id: ID,
  integrationID: Integration.ID,
  label: Schema.String,
  value: Schema.optional(Value),
  protected: Schema.Boolean,
}) {}

export class ProtectedValueError extends Schema.TaggedErrorClass<ProtectedValueError>()(
  "Credential.ProtectedValueError",
  {},
) {}

export type ResolveError = ProtectedSecret.Error | ProtectedValueError

export interface Interface {
  /** Returns every stored credential. */
  readonly all: () => Effect.Effect<Info[]>
  /** Returns stored credentials belonging to one integration. */
  readonly list: (integrationID: Integration.ID) => Effect.Effect<Info[]>
  /** Returns one stored credential by ID. */
  readonly get: (id: ID) => Effect.Effect<Info | undefined>
  /** Resolves legacy or protected credential material for provider use. */
  readonly resolve: (id: ID) => Effect.Effect<Value | undefined, ResolveError>
  /** Replaces any credential for an integration and returns the new record. */
  readonly create: (input: {
    readonly integrationID: Integration.ID
    readonly value: Value
    readonly label?: string
  }) => Effect.Effect<Info>
  /** Stores secret material through the protected-secret adapter and persists only its reference. */
  readonly createProtected: (input: {
    readonly integrationID: Integration.ID
    readonly value: Value
    readonly label?: string
  }) => Effect.Effect<Info, ProtectedSecret.Error>
  /** Updates the label or secret value of a stored credential. */
  readonly update: (
    id: ID,
    updates: Partial<Pick<Info, "label" | "value">>,
  ) => Effect.Effect<void, ProtectedSecret.Error>
  /** Removes a stored credential. */
  readonly remove: (id: ID) => Effect.Effect<void, ProtectedSecret.Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Credential") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const secrets = yield* ProtectedSecret.Service
    const decode = Schema.decodeUnknownSync(Value)
    const encode = Schema.encodeSync(Schema.fromJsonString(Value))
    const decodeProtected = Schema.decodeUnknownEffect(Schema.fromJsonString(Value))
    const stored = (row: typeof CredentialTable.$inferSelect) => {
      if (!row.integration_id) return
      return new Info({
        id: row.id,
        integrationID: row.integration_id,
        label: row.label,
        value: row.value === null ? undefined : decode(row.value),
        protected: row.secret_ref !== null,
      })
    }

    const removeSecret = (ref: ProtectedSecret.ID | null) =>
      ref ? secrets.remove(ref).pipe(Effect.catchTag("ProtectedSecret.NotFound", () => Effect.void)) : Effect.void

    return Service.of({
      all: Effect.fn("Credential.all")(function* () {
        return (yield* db
          .select()
          .from(CredentialTable)
          .orderBy(asc(CredentialTable.time_created))
          .all()
          .pipe(Effect.orDie)).flatMap((row) => {
          const credential = stored(row)
          return credential ? [credential] : []
        })
      }),
      list: Effect.fn("Credential.list")(function* (integrationID) {
        return (yield* db
          .select()
          .from(CredentialTable)
          .where(eq(CredentialTable.integration_id, integrationID))
          .orderBy(asc(CredentialTable.time_created))
          .all()
          .pipe(Effect.orDie)).flatMap((row) => {
          const credential = stored(row)
          return credential ? [credential] : []
        })
      }),
      get: Effect.fn("Credential.get")(function* (id) {
        const row = yield* db.select().from(CredentialTable).where(eq(CredentialTable.id, id)).get().pipe(Effect.orDie)
        return row ? stored(row) : undefined
      }),
      resolve: Effect.fn("Credential.resolve")(function* (id) {
        const row = yield* db.select().from(CredentialTable).where(eq(CredentialTable.id, id)).get().pipe(Effect.orDie)
        if (!row) return undefined
        if (row.value !== null) return decode(row.value)
        if (!row.secret_ref) return yield* new ProtectedValueError()
        const serialized = yield* secrets.get(row.secret_ref)
        return yield* decodeProtected(serialized).pipe(Effect.mapError(() => new ProtectedValueError()))
      }),
      create: Effect.fn("Credential.create")(function* (input) {
        const credential = new Info({
          id: ID.create(),
          integrationID: input.integrationID,
          label: input.label ?? "default",
          value: input.value,
          protected: false,
        })
        const previous = yield* db
          .select({ secretRef: CredentialTable.secret_ref })
          .from(CredentialTable)
          .where(eq(CredentialTable.integration_id, credential.integrationID))
          .all()
          .pipe(Effect.orDie)
        yield* db
          .transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .delete(CredentialTable)
                .where(eq(CredentialTable.integration_id, credential.integrationID))
                .run()
              yield* tx
                .insert(CredentialTable)
                .values({
                  id: credential.id,
                  integration_id: credential.integrationID,
                  label: credential.label,
                  value: credential.value,
                  secret_ref: null,
                })
                .run()
            }),
          )
          .pipe(Effect.orDie)
        yield* Effect.forEach(previous, (item) => removeSecret(item.secretRef), { discard: true }).pipe(
          Effect.catch(() => Effect.void),
        )
        return credential
      }),
      createProtected: Effect.fn("Credential.createProtected")(function* (input) {
        const previous = yield* db
          .select({ secretRef: CredentialTable.secret_ref })
          .from(CredentialTable)
          .where(eq(CredentialTable.integration_id, input.integrationID))
          .all()
          .pipe(Effect.orDie)
        const secretRef = yield* secrets.put(encode(input.value))
        const credential = new Info({
          id: ID.create(),
          integrationID: input.integrationID,
          label: input.label ?? "default",
          protected: true,
        })
        yield* db
          .transaction((tx) =>
            Effect.gen(function* () {
              yield* tx.delete(CredentialTable).where(eq(CredentialTable.integration_id, input.integrationID)).run()
              yield* tx
                .insert(CredentialTable)
                .values({
                  id: credential.id,
                  integration_id: credential.integrationID,
                  label: credential.label,
                  value: null,
                  secret_ref: secretRef,
                })
                .run()
            }),
          )
          .pipe(
            Effect.onExit((exit) =>
              exit._tag === "Failure" ? removeSecret(secretRef).pipe(Effect.catch(() => Effect.void)) : Effect.void,
            ),
            Effect.orDie,
          )
        yield* Effect.forEach(
          previous,
          (item) => (item.secretRef && item.secretRef !== secretRef ? removeSecret(item.secretRef) : Effect.void),
          { discard: true },
        ).pipe(Effect.catch(() => Effect.void))
        return credential
      }),
      update: Effect.fn("Credential.update")(function* (id, updates) {
        if (!updates.label && !updates.value) return
        const row = yield* db.select().from(CredentialTable).where(eq(CredentialTable.id, id)).get().pipe(Effect.orDie)
        if (!row) return
        if (updates.value && row.secret_ref) {
          yield* secrets.put(encode(updates.value), row.secret_ref)
          if (updates.label) {
            yield* db
              .update(CredentialTable)
              .set({ label: updates.label })
              .where(eq(CredentialTable.id, id))
              .run()
              .pipe(Effect.orDie)
          }
          return
        }
        yield* db
          .update(CredentialTable)
          .set({ label: updates.label, value: updates.value })
          .where(eq(CredentialTable.id, id))
          .run()
          .pipe(Effect.orDie)
      }),
      remove: Effect.fn("Credential.remove")(function* (id) {
        const row = yield* db.select().from(CredentialTable).where(eq(CredentialTable.id, id)).get().pipe(Effect.orDie)
        if (!row) return
        yield* removeSecret(row.secret_ref)
        yield* db.delete(CredentialTable).where(eq(CredentialTable.id, id)).run().pipe(Effect.orDie)
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, ProtectedSecret.node] })
