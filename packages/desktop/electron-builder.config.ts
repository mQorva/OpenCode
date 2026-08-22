import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

import { MQORVA, mqorvaBuildCommit } from "../../script/mqorva"
import { MQORVA_APP_IDS, MQORVA_APP_NAMES, MQORVA_PROTOCOL } from "./identity"
import pkg from "./package.json"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const mqorvaCommit = mqorvaBuildCommit(rootDir)
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

if (pkg.version !== MQORVA.upstream.version) {
  throw new Error(
    `mqorva-version.json nennt OpenCode ${MQORVA.upstream.version}, Desktop verwendet aber ${pkg.version}.`,
  )
}

const getBase = (appId: string, productName: string): Configuration => ({
  artifactName: `opencode-mqorva-\${version}-r${MQORVA.revision}-${mqorvaCommit}-\${os}-\${arch}.\${ext}`,
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id.
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
    author: { name: "mQorva" },
  },
  files: ["out/**/*", "resources/**/*", "!resources/opencode-cli*"],
  extraResources: [
    ...(channel === "dev"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["opencode-cli*"],
          },
        ]
      : []),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: productName,
    schemes: [MQORVA_PROTOCOL],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
    shortcutName: productName,
    uninstallDisplayName: productName,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = MQORVA_APP_IDS[channel]
  const productName = MQORVA_APP_NAMES[channel]
  const base = getBase(appId, productName)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName,
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "opencode-mqorva-dev", fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName,
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "opencode-mqorva-beta", fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName,
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "opencode-mqorva", fpm: [metainfoFpm(appId)] },
      }
    }
  }
}

export default getConfig()
