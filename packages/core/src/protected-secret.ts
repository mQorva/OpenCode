import { Context, Effect, Layer, Schema } from "effect"
import { Identifier } from "./util/identifier"
import { statics } from "./schema"
import { makeGlobalNode } from "./effect/app-node"

export const ID = Schema.String.check(Schema.isStartsWith("sec_")).pipe(
  Schema.brand("ProtectedSecret.ID"),
  statics((schema) => ({ create: () => schema.make("sec_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export class Unavailable extends Schema.TaggedErrorClass<Unavailable>()("ProtectedSecret.Unavailable", {}) {}

export class NotFound extends Schema.TaggedErrorClass<NotFound>()("ProtectedSecret.NotFound", {
  ref: ID,
}) {}

export class Operation extends Schema.TaggedErrorClass<Operation>()("ProtectedSecret.Operation", {
  operation: Schema.Literals(["put", "get", "remove"]),
}) {
  override get message() {
    return "Protected secret operation failed."
  }
}

export type Error = Unavailable | NotFound | Operation

export interface Adapter {
  readonly put: (ref: ID, value: string) => Effect.Effect<void, unknown>
  readonly get: (ref: ID) => Effect.Effect<string | undefined, unknown>
  readonly remove: (ref: ID) => Effect.Effect<boolean | void, unknown>
}

export interface Interface {
  readonly available: () => Effect.Effect<boolean>
  readonly put: (value: string, existingRef?: ID) => Effect.Effect<ID, Error>
  readonly get: (ref: ID) => Effect.Effect<string, Error>
  readonly remove: (ref: ID) => Effect.Effect<void, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ProtectedSecret") {}

let adapter: Adapter | undefined

export function install(next: Adapter): () => void {
  adapter = next
  return () => {
    if (adapter === next) adapter = undefined
  }
}

export function reset() {
  adapter = undefined
}

function unavailable<A>(): Effect.Effect<A, Unavailable> {
  return Effect.fail(new Unavailable())
}

function operation<A>(name: Operation["operation"], action: () => Effect.Effect<A, unknown>) {
  return Effect.suspend(action).pipe(Effect.catchCause(() => Effect.fail(new Operation({ operation: name }))))
}

const layer = Layer.succeed(
  Service,
  Service.of({
    available: Effect.fn("ProtectedSecret.available")(function* () {
      return adapter !== undefined
    }),
    put: Effect.fn("ProtectedSecret.put")(function* (value: string, existingRef?: ID) {
      const current = adapter
      if (!current) return yield* unavailable<ID>()
      const ref = existingRef ?? ID.create()
      yield* operation("put", () => current.put(ref, value))
      return ref
    }),
    get: Effect.fn("ProtectedSecret.get")(function* (ref: ID) {
      const current = adapter
      if (!current) return yield* unavailable<string>()
      const value = yield* operation("get", () => current.get(ref))
      if (value === undefined) return yield* new NotFound({ ref })
      return value
    }),
    remove: Effect.fn("ProtectedSecret.remove")(function* (ref: ID) {
      const current = adapter
      if (!current) return yield* unavailable<void>()
      const removed = yield* operation("remove", () => current.remove(ref))
      if (removed === false) return yield* new NotFound({ ref })
    }),
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })

export * as ProtectedSecret from "./protected-secret"
