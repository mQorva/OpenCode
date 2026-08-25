import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { app } from "electron"
import { getLogger } from "./logging"
import { getUserShell, loadShellEnv } from "./shell-env"
import { getStore } from "./store"
import { DEFAULT_SERVER_URL_KEY } from "./store-keys"

export type HealthCheck = { wait: Promise<void> }

export type SidecarListener = { stop: () => Promise<void> }

const SIDECAR_START_STALL_TIMEOUT = 60_000
const SIDECAR_STOP_TIMEOUT = 6_000

type SpawnLocalServerOptions = {
  userDataPath: string
  onStdout?: (message: string) => void
  onStderr?: (message: string) => void
  onExit?: (code: number) => void
}

export function getDefaultServerUrl(): string | null {
  const value = getStore().get(DEFAULT_SERVER_URL_KEY)
  return typeof value === "string" ? value : null
}

export function setDefaultServerUrl(url: string | null) {
  if (url) {
    getStore().set(DEFAULT_SERVER_URL_KEY, url)
    return
  }

  getStore().delete(DEFAULT_SERVER_URL_KEY)
}

export function preferAppEnv(userDataPath: string) {
  const shell = process.platform === "win32" ? null : getUserShell()
  const shellEnv = shell ? loadShellEnv(shell, getLogger()) : null
  Object.assign(process.env, {
    ...shellEnv,
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
    OPENCODE_CLIENT: "desktop",
    XDG_DATA_HOME: process.env.XDG_DATA_HOME ?? join(userDataPath, "data"),
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? join(userDataPath, "config"),
    XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? join(userDataPath, "cache"),
    XDG_STATE_HOME: process.env.XDG_STATE_HOME ?? join(userDataPath, "state"),
  })
  return shellEnv
}

export async function spawnLocalServer(
  hostname: string,
  port: number,
  password: string,
  options: SpawnLocalServerOptions,
) {
  const executable = app.isPackaged
    ? join(process.resourcesPath, executableName())
    : join(dirname(fileURLToPath(import.meta.url)), "../../resources", executableName())
  const child = spawn(executable, ["serve", "--hostname", hostname, "--port", String(port)], {
    cwd: process.cwd(),
    env: createSidecarEnv(options.userDataPath, password),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  let exited = false
  const exit = defer<number>()

  child.once("exit", (code) => {
    exited = true
    process.off("exit", killOnParentExit)
    options.onExit?.(code ?? 1)
    exit.resolve(code ?? 1)
  })
  const killOnParentExit = () => {
    if (!exited) child.kill("SIGKILL")
  }
  process.once("exit", killOnParentExit)
  child.on("error", (error) => options.onStderr?.(`sidecar process error: ${serializeError(error).message}`))

  child.stdout?.on("data", (chunk: Buffer) => options.onStdout?.(chunk.toString("utf8").trimEnd()))
  child.stderr?.on("data", (chunk: Buffer) => options.onStderr?.(chunk.toString("utf8").trimEnd()))

  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve)
    child.once("error", reject)
  }).catch((error) => {
    if (!exited) child.kill("SIGKILL")
    throw error
  })

  const wait = (async () => {
    const url = `http://${hostname}:${port}`
    let healthy = false
    const gone = exit.promise.then((code) => {
      if (healthy) return
      throw new Error(`Sidecar exited before health check passed with code ${code}`)
    })

    const ready = async () => {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (await checkHealth(url, password)) {
          healthy = true
          return
        }
      }
    }

    await Promise.race([
      ready(),
      gone,
      delay(SIDECAR_START_STALL_TIMEOUT).then(() => {
        throw new Error(`Sidecar did not become healthy within ${SIDECAR_START_STALL_TIMEOUT}ms: ${executable}`)
      }),
    ])
  })()

  let stopping: Promise<void> | undefined

  return {
    listener: {
      stop: () => {
        if (stopping) return stopping
        if (exited) return Promise.resolve()
        child.kill()
        stopping = Promise.race([
          exit.promise.then(() => undefined),
          delay(SIDECAR_STOP_TIMEOUT)
            .then(() => {
              if (!exited) child.kill("SIGKILL")
            })
            .then(() => Promise.race([exit.promise.then(() => undefined), delay(1000)])),
        ])
        return stopping
      },
    },
    health: { wait },
  }
}

export async function checkHealth(url: string, password?: string | null): Promise<boolean> {
  let healthUrls: URL[]
  try {
    healthUrls = [new URL("/api/health", url), new URL("/global/health", url)]
  } catch {
    return false
  }

  const headers = new Headers()
  if (password) {
    const auth = Buffer.from(`opencode:${password}`).toString("base64")
    headers.set("authorization", `Basic ${auth}`)
  }

  for (const healthUrl of healthUrls) {
    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return true
    } catch {}
  }
  return false
}

function createSidecarEnv(userDataPath: string, password: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])),
  )
  Object.assign(env, {
    OPENCODE_SERVER_USERNAME: "opencode",
    OPENCODE_SERVER_PASSWORD: password,
    XDG_DATA_HOME: env.XDG_DATA_HOME ?? join(userDataPath, "data"),
    XDG_CONFIG_HOME: env.XDG_CONFIG_HOME ?? join(userDataPath, "config"),
    XDG_CACHE_HOME: env.XDG_CACHE_HOME ?? join(userDataPath, "cache"),
    XDG_STATE_HOME: env.XDG_STATE_HOME ?? join(userDataPath, "state"),
  })
  delete env.DEBUG
  if (process.platform === "linux") delete env.LD_PRELOAD
  return env
}

function executableName() {
  return process.platform === "win32" ? "opencode-cli.exe" : "opencode-cli"
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack }
  return { message: String(error) }
}

function defer<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
