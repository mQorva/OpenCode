import { describe, expect, test } from "bun:test"
import { OpenApi } from "effect/unstable/httpapi"
import { PublicApi } from "../../src/server/routes/instance/httpapi/public"

type Operation = {
  readonly parameters?: ReadonlyArray<{ readonly name?: string; readonly in?: string; readonly schema?: unknown }>
  readonly requestBody?: unknown
  readonly responses?: Record<string, unknown>
}

type Spec = {
  readonly paths: Record<string, Partial<Record<"get" | "post" | "patch", Operation>>>
}

const productTaskRoutes = [
  ["get", "/product/project/{projectID}/task"],
  ["post", "/product/project/{projectID}/task"],
  ["get", "/product/task/{taskID}"],
  ["patch", "/product/task/{taskID}"],
  ["post", "/product/task/{taskID}/archive"],
  ["post", "/product/task/{taskID}/restore"],
  ["post", "/product/task/{taskID}/run"],
  ["get", "/product/task/{taskID}/run"],
  ["post", "/product/task/{taskID}/accept"],
  ["post", "/product/task/{taskID}/reopen"],
  ["get", "/product/run/{runID}"],
  ["post", "/product/run/{runID}/session"],
  ["post", "/product/run/{runID}/transition"],
] as const

describe("ProductTask HttpApi", () => {
  test("documents the product task and run adapter surface with public errors", () => {
    const spec = OpenApi.fromApi(PublicApi) as Spec

    for (const [method, path] of productTaskRoutes) {
      const operation = spec.paths[path]?.[method]
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined()
      expect(operation?.responses?.["400"], `${method.toUpperCase()} ${path}`).toBeDefined()
      expect(operation?.responses?.["404"], `${method.toUpperCase()} ${path}`).toBeDefined()
      expect(operation?.responses?.["409"], `${method.toUpperCase()} ${path}`).toBeDefined()
      expect(operation?.responses?.["500"], `${method.toUpperCase()} ${path}`).toBeDefined()
    }

    const list = spec.paths["/product/project/{projectID}/task"]?.get
    const includeArchived = list?.parameters?.find((parameter) => parameter.name === "includeArchived")
    expect(includeArchived?.in).toBe("query")
    expect(includeArchived?.schema).toEqual({ anyOf: [{ type: "boolean" }, { type: "string", enum: ["true", "false"] }] })
  })
})
