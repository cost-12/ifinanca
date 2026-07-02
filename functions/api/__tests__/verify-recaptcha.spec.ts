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

  it('fails when the Enterprise action does not match the expected action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: true, action: 'login' },
        riskAnalysis: { score: 0.9 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
        expectedAction: 'register',
      }),
    ).resolves.toEqual({
      success: false,
      errorCodes: ['action-mismatch'],
      score: 0.9,
    })
  })

  it('succeeds when the Enterprise action matches the expected action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: true, action: 'register' },
        riskAnalysis: { score: 0.9 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
        expectedAction: 'register',
      }),
    ).resolves.toEqual({
      success: true,
      errorCodes: [],
      score: 0.9,
    })
  })

  it('fails when the Enterprise score is below the minimum threshold', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: true },
        riskAnalysis: { score: 0.2 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
        minScore: 0.5,
      }),
    ).resolves.toEqual({
      success: false,
      errorCodes: ['score-too-low'],
      score: 0.2,
    })
  })

  it('succeeds when the Enterprise score meets the minimum threshold', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: true },
        riskAnalysis: { score: 0.5 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
        minScore: 0.5,
      }),
    ).resolves.toEqual({
      success: true,
      errorCodes: [],
      score: 0.5,
    })
  })

  it('fails when the token is structurally invalid in Enterprise mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tokenProperties: { valid: false, invalidReason: 'EXPIRED' },
        riskAnalysis: { score: 0 },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      validateRecaptchaToken('token', 'secret', {
        siteKey: 'site-key',
        projectId: 'pluggy-firebase',
        enterpriseApiKey: 'enterprise-api-key',
      }),
    ).resolves.toMatchObject({
      success: false,
      errorCodes: ['EXPIRED'],
    })
  })
})

describe('resolveRecaptchaErrorMessage', () => {
  it('returns a human-readable message for known error codes', () => {
    expect(resolveRecaptchaErrorMessage(['action-mismatch'])).toContain('action')
    expect(resolveRecaptchaErrorMessage(['score-too-low'])).toContain('suspicious')
    expect(resolveRecaptchaErrorMessage(['timeout-or-duplicate'])).toContain('expired')
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(resolveRecaptchaErrorMessage(['unknown-code'])).toBe('reCAPTCHA verification failed')
  })

  it('falls back to a generic message for an empty array', () => {
    expect(resolveRecaptchaErrorMessage([])).toBe('reCAPTCHA verification failed')
  })
})
