import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRecaptchaErrorMessage, validateRecaptchaToken } from '../verify-recaptcha'

describe('validateRecaptchaToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success when Google confirms the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(validateRecaptchaToken('token', 'secret')).resolves.toEqual({ success: true, errorCodes: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns mapped error codes when siteverify rejects the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false, 'error-codes': ['invalid-input-secret'] }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(validateRecaptchaToken('token', 'secret')).resolves.toEqual({
      success: false,
      errorCodes: ['invalid-input-secret'],
    })
    expect(resolveRecaptchaErrorMessage(['invalid-input-secret'])).toContain('secret key is invalid')
  })

  it('uses the Enterprise assessment API when project credentials are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: true },
        riskAnalysis: { score: 0.9 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
      }),
    ).resolves.toEqual({
      success: true,
      errorCodes: [],
      score: 0.9,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('recaptchaenterprise.googleapis.com/v1/projects/pluggy-firebase/assessments'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
