import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateRecaptchaToken } from '../verify-recaptcha'

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
})
