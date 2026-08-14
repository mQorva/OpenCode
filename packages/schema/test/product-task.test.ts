import { describe, expect, test } from "bun:test"
import { ProductRun, ProductTask } from "@opencode-ai/schema"
import { Schema } from "effect"

describe("product task contracts", () => {
  test("creates IDs with the declared prefixes", () => {
    expect(ProductTask.ID.create()).toStartWith("ptask_")
    expect(ProductRun.ID.create()).toStartWith("prun_")
  })

  test("rejects IDs and lifecycle values outside the contract", () => {
    expect(() => Schema.decodeUnknownSync(ProductTask.ID)("task_legacy")).toThrow()
    expect(() => Schema.decodeUnknownSync(ProductRun.ID)("run_legacy")).toThrow()
    expect(() => Schema.decodeUnknownSync(ProductTask.Status)("done")).toThrow()
    expect(() => Schema.decodeUnknownSync(ProductRun.Status)("idle")).toThrow()
    expect(() => Schema.decodeUnknownSync(ProductRun.Trigger)("automatic")).toThrow()
  })

  test("requires positive run sequence numbers", () => {
    const decode = Schema.decodeUnknownSync(ProductRun.Info)
    const base = {
      id: ProductRun.ID.create(),
      taskID: ProductTask.ID.create(),
      status: "queued",
      trigger: "new",
    }

    expect(() => decode({ ...base, sequence: 0 })).toThrow()
    expect(decode({ ...base, sequence: 1 }).sequence).toBe(1)
  })
})
