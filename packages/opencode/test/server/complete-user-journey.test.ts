import { afterEach, describe, expect, mock } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Auth } from "@/auth"
import { Session } from "@/session/session"
import { Provider } from "@/provider/provider"
import { Agent } from "@/agent/agent"
import { Vcs } from "@/project/vcs"
import { disposeAllInstances, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { httpApiLayer, requestInDirectory } from "../server/httpapi-layer"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import * as fs from "fs/promises"
import * as path from "path"

const it = testEffect(
  Layer.mergeAll(
    LayerNode.compile(Session.node),
    LayerNode.compile(Auth.node),
    LayerNode.compile(Provider.node),
    LayerNode.compile(Agent.node),
    LayerNode.compile(Vcs.node),
    httpApiLayer,
  ),
)

afterEach(async () => {
  mock.restore()
  await disposeAllInstances()
})

describe("Complete End-to-End User Journey", () => {
  it.live(
    "executes the full lifecycle: provider auth -> session creation -> prompt with reasoning & text -> tool call code change -> vcs diff -> cleanup",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const cfg = testProviderConfig(llm.url)
        const directory = yield* tmpdirScoped({ git: true, config: cfg })
        const headers = { "Content-Type": "application/json" }

        // 1. PROVIDER REGISTRATION & AUTH
        const auth = yield* Auth.Service
        yield* auth.set("openrouter", { type: "api", key: "sk-or-v1-test-key" })
        const authInfo = yield* auth.get("openrouter")
        expect(authInfo?.type === "api" ? authInfo.key : undefined).toBe("sk-or-v1-test-key")

        // 2. AGENTS & MODELS RESOLUTION
        const agentListRes = yield* requestInDirectory("/agent", directory)
        expect(agentListRes.status).toBe(200)
        const agents = (yield* agentListRes.json) as Agent.Info[]
        expect(agents.length).toBeGreaterThan(0)
        const buildAgent = agents.find((a) => a.name === "build")
        expect(buildAgent).toBeDefined()

        // 3. SESSION CREATION
        const createRes = yield* requestInDirectory("/session", directory, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "E2E Test Session",
            permission: [{ permission: "edit", action: "allow", pattern: "*" }],
          }),
        })
        expect(createRes.status).toBe(200)
        const session = (yield* createRes.json) as Session.Info
        expect(session.id).toBeDefined()
        expect(session.title).toBe("E2E Test Session")

        // 4. CHAT PROMPT WITH REASONING/THINKING & CODE GENERATION
        yield* llm.tool("write", {
          filePath: path.join(directory, "math.ts"),
          content: "export function add(a: number, b: number): number {\n  return a + b\n}\n",
        })
        yield* llm.text("I have created math.ts with the requested add function.", {
          usage: { input: 20, output: 40 },
        })

        const promptRes = yield* requestInDirectory(`/session/${session.id}/message`, directory, {
          method: "POST",
          headers,
          body: JSON.stringify({
            agent: "build",
            model: { providerID: "test", modelID: "test-model" },
            parts: [{ type: "text", text: "Create math.ts with an add function" }],
          }),
        })
        const errText = promptRes.status !== 200 ? yield* promptRes.text : ""
        if (errText) console.log("PROMPT ERROR BODY:", errText)
        expect(promptRes.status).toBe(200)

        // 5. ASYNC FOLLOW-UP PROMPT (prompt_async) & CODE EDIT
        yield* llm.tool("edit", {
          filePath: path.join(directory, "math.ts"),
          oldString: "return a + b",
          newString: "return (a + b) // updated",
        })
        yield* llm.text("I have updated the math.ts file with a comment.", {
          usage: { input: 15, output: 25 },
        })

        const asyncPromptRes = yield* requestInDirectory(`/session/${session.id}/prompt_async`, directory, {
          method: "POST",
          headers,
          body: JSON.stringify({
            agent: "build",
            model: { providerID: "test", modelID: "test-model" },
            parts: [{ type: "text", text: "Add a comment to the add function" }],
          }),
        })
        expect(asyncPromptRes.status).toBe(204)

        let attempts = 0
        let isIdle = false
        while (attempts < 50 && !isIdle) {
          yield* Effect.sleep("200 millis")
          const statusRes = yield* requestInDirectory("/session/status", directory)
          const statuses = (yield* statusRes.json) as Record<string, { type: string }>
          if (!statuses[session.id] || statuses[session.id]?.type === "idle") {
            isIdle = true
          }
          attempts++
        }
        expect(isIdle).toBe(true)

        // 6. VERIFY CODE MODIFICATION & FILE EDITS
        const updatedFileContent = yield* Effect.tryPromise(() =>
          fs.readFile(path.join(directory, "math.ts"), "utf-8"),
        )
        expect(updatedFileContent).toContain("// updated")

        // 7. VERIFY MESSAGES IN TIMELINE
        const messagesRes = yield* requestInDirectory(`/session/${session.id}/message`, directory)
        expect(messagesRes.status).toBe(200)
        const messages = (yield* messagesRes.json) as any[]
        expect(messages.length).toBeGreaterThanOrEqual(4)

        const userMsgs = messages.filter((m) => m.info.role === "user")
        expect(userMsgs.length).toBe(2)

        const assistantMsgs = messages.filter((m) => m.info.role === "assistant")
        expect(assistantMsgs.length).toBe(4)

        // 7. VERIFY VCS STATUS / DIFF
        const vcsStatusRes = yield* requestInDirectory("/vcs/status", directory)
        expect(vcsStatusRes.status).toBe(200)

        // 8. CLEANUP
        const deleteRes = yield* requestInDirectory(`/session/${session.id}`, directory, {
          method: "DELETE",
        })
        expect(deleteRes.status).toBe(200)
      }).pipe(
        Effect.provide(TestLLMServer.layer),
      ),
    { timeout: 30000 },
  )
})
