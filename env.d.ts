/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string
  readonly VITE_FIREBASE_DATACONNECT_ENDPOINT?: string
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string
  readonly VITE_PLUGGY_CONNECT_TOKEN_URL?: string
  readonly VITE_PLUGGY_INCLUDE_SANDBOX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      render?: (container: string | HTMLElement, params: Record<string, unknown>) => string
      reset?: (widgetId?: string) => void
      enterprise?: {
        ready: (cb: () => void) => void
        render: (container: string | HTMLElement, params: Record<string, unknown>) => string
      }
    }
  }
}

export {}
