import { beforeEach, describe, expect, it, vi } from 'vitest'

const initializeAppCheckMock = vi.fn()
const reCaptchaEnterpriseProviderMock = vi.fn()

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: initializeAppCheckMock,
  ReCaptchaEnterpriseProvider: reCaptchaEnterpriseProviderMock,
}))

describe('firebase app check bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    initializeAppCheckMock.mockReset()
    reCaptchaEnterpriseProviderMock.mockReset()
  })

  it('initializes App Check when the site key is configured', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key')

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
})
