import { beforeEach, describe, expect, it, vi } from 'vitest'

const initializeAppCheckMock = vi.fn()
const reCaptchaEnterpriseProviderMock = vi.fn()
const getTokenMock = vi.fn()

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: initializeAppCheckMock,
  ReCaptchaEnterpriseProvider: reCaptchaEnterpriseProviderMock,
  getToken: getTokenMock,
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}))

vi.mock('firebase/firestore/lite', () => ({
  getFirestore: vi.fn(() => ({})),
}))

describe('firebase app check bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    initializeAppCheckMock.mockReset()
    reCaptchaEnterpriseProviderMock.mockReset()
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue({ token: 'app-check-token' })
    initializeAppCheckMock.mockReturnValue({ name: 'app-check' })
  })

  it('initializes App Check when the site key is configured', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'auth-domain')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project-id')
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id')

    const { initializeAppCheckIfConfigured } = await import('../firebase')
    const app = { name: 'app' }

    initializeAppCheckIfConfigured(app as never)

    expect(reCaptchaEnterpriseProviderMock).toHaveBeenCalledWith('site-key')
    expect(initializeAppCheckMock).toHaveBeenCalledTimes(1)
  })

  it('does not initialize App Check without a site key', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '')

    const { initializeAppCheckIfConfigured } = await import('../firebase')
    const app = { name: 'app' }

    initializeAppCheckIfConfigured(app as never)

    expect(reCaptchaEnterpriseProviderMock).not.toHaveBeenCalled()
    expect(initializeAppCheckMock).not.toHaveBeenCalled()
  })

  it('marks App Check as ready after a successful token fetch', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'auth-domain')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project-id')
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id')

    const { ensureAppCheckReady, getAppCheckState } = await import('../firebase')

    await ensureAppCheckReady({ timeoutMs: 1000, retries: 0 })

    expect(getTokenMock).toHaveBeenCalledTimes(1)
    expect(getAppCheckState().status).toBe('ready')
  })

  it('marks App Check as error after token timeout', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'auth-domain')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project-id')
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id')

    getTokenMock.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to trigger timeout.
        }),
    )

    const { ensureAppCheckReady, getAppCheckState } = await import('../firebase')

    await expect(ensureAppCheckReady({ timeoutMs: 50, retries: 0 })).rejects.toMatchObject({
      code: 'app-check/timeout',
    })
    expect(getAppCheckState().status).toBe('error')
  })
})
