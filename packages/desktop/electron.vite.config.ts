import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "electron-vite"
import appPlugin from "@opencode-ai/app/vite"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { MQORVA, mqorvaBuildCommit, mqorvaDisplayVersion } from "../../script/mqorva"
import pkg from "./package.json"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const mqorvaCommit = mqorvaBuildCommit(rootDir)

if (pkg.version !== MQORVA.upstream.version) {
  throw new Error(
    `mqorva-version.json nennt OpenCode ${MQORVA.upstream.version}, Desktop verwendet aber ${pkg.version}.`,
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./out/renderer/**",
          filesToDeleteAfterUpload: "./out/renderer/**/*.map",
        },
      })
    : false

export default defineConfig({
  main: {
    define: {
      "import.meta.env.OPENCODE_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts" },
        // Keep this identical to electron-vite's Node 20.11+ shim. Its regex insertion can
        // corrupt bundled TypeScript, while a Rollup banner places the shim safely.
        output: {
          banner: `
// -- CommonJS Shims --
import __cjs_mod__ from 'node:module';
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require = __cjs_mod__.createRequire(import.meta.url);
`,
        },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: "opencode:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    define: {
      "import.meta.env.VITE_MQORVA_EDITION": JSON.stringify(MQORVA.edition),
      "import.meta.env.VITE_MQORVA_REVISION": JSON.stringify(String(MQORVA.revision)),
      "import.meta.env.VITE_MQORVA_UPSTREAM_VERSION": JSON.stringify(MQORVA.upstream.version),
      "import.meta.env.VITE_MQORVA_UPSTREAM_COMMIT": JSON.stringify(MQORVA.upstream.commit),
      "import.meta.env.VITE_MQORVA_BUILD_COMMIT": JSON.stringify(mqorvaCommit),
      "import.meta.env.VITE_MQORVA_DISPLAY_VERSION": JSON.stringify(mqorvaDisplayVersion(mqorvaCommit)),
    },
    plugins: [appPlugin, sentry],
    publicDir: "../../../app/public",
    root: "src/renderer",
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          main: "src/renderer/index.html",
        },
      },
    },
  },
})
