interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_OPENCODE_CHANNEL?: "dev" | "beta" | "prod"
  readonly VITE_MQORVA_EDITION?: string
  readonly VITE_MQORVA_REVISION?: string
  readonly VITE_MQORVA_UPSTREAM_VERSION?: string
  readonly VITE_MQORVA_UPSTREAM_COMMIT?: string
  readonly VITE_MQORVA_BUILD_COMMIT?: string
  readonly VITE_MQORVA_DISPLAY_VERSION?: string

  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.mp4" {
  const src: string
  export default src
}

export declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
