interface RecaptchaVerificationResponse {
  success: boolean
  'error-codes'?: string[]
}

interface RecaptchaEnv {
  RECAPTCHA_SECRET_KEY?: string
  RECAPTCHA_ENTERPRISE_PROJECT_ID?: string
  RECAPTCHA_ENTERPRISE_API_KEY?: string
}

const RECAPTCHA_ERROR_MESSAGES: Record<string, string> = {
  'missing-input-secret': 'The reCAPTCHA secret key is missing on the server.',
  'invalid-input-secret':
    'The reCAPTCHA secret key is invalid. Configure RECAPTCHA_SECRET_KEY as a Cloudflare Pages secret.',
  'missing-input-response': 'The reCAPTCHA token is missing.',
  'invalid-input-response':
    'The reCAPTCHA token is invalid or expired. Confirm the site key domain includes ifinanca.pages.dev.',
  'bad-request': 'The reCAPTCHA verification request was malformed.',
  'timeout-or-duplicate': 'The reCAPTCHA token expired or was already used.',
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')

  if (!origin) {
    return
  }

  if (origin !== new URL(request.url).origin) {
    throw new Error('Cross-origin requests are not allowed')
  }
}

export function resolveRecaptchaErrorMessage(errorCodes: string[]) {
  const primary = errorCodes[0]
  return (primary && RECAPTCHA_ERROR_MESSAGES[primary]) || 'reCAPTCHA verification failed'
}

async function validateRecaptchaWithSiteVerify(token: string, secret: string) {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ secret, response: token }).toString(),
  })

  const payload = (await response.json().catch(() => ({}))) as Partial<RecaptchaVerificationResponse>

  if (!response.ok) {
    throw new Error('reCAPTCHA verification service unavailable')
  }

  return {
    success: Boolean(payload.success),
    errorCodes: payload['error-codes'] ?? [],
  }
}

async function validateRecaptchaWithEnterpriseAssessment(
  token: string,
  siteKey: string,
  projectId: string,
  apiKey: string,
) {
  const response = await fetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event: {
          token,
          siteKey,
        },
      }),
    },
  )

  const payload = (await response.json().catch(() => ({}))) as {
    tokenProperties?: { valid?: boolean; invalidReason?: string }
    riskAnalysis?: { score?: number }
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'reCAPTCHA Enterprise assessment failed')
  }

  const valid = Boolean(payload.tokenProperties?.valid)
  const invalidReason = payload.tokenProperties?.invalidReason

  return {
    success: valid,
    errorCodes: valid ? [] : [invalidReason || 'invalid-input-response'],
    score: payload.riskAnalysis?.score,
  }
}

export async function validateRecaptchaToken(
  token: string,
  secret: string,
  options?: {
    siteKey?: string
    projectId?: string
    enterpriseApiKey?: string
  },
) {
  const projectId = options?.projectId?.trim()
  const enterpriseApiKey = options?.enterpriseApiKey?.trim()
  const siteKey = options?.siteKey?.trim()

  if (projectId && enterpriseApiKey && siteKey) {
    return validateRecaptchaWithEnterpriseAssessment(token, siteKey, projectId, enterpriseApiKey)
  }

  return validateRecaptchaWithSiteVerify(token, secret)
}

export async function onRequestPost({ request, env }: { request: Request; env: RecaptchaEnv }) {
  try {
    assertSameOrigin(request)

    const body = (await request.json().catch(() => ({}))) as { token?: string; siteKey?: string }
    const token = body.token?.trim()
    const secret = env.RECAPTCHA_SECRET_KEY?.trim()

    if (!token) {
      return jsonResponse({ success: false, error: 'Missing reCAPTCHA token' }, 400)
    }

    if (!secret && !(env.RECAPTCHA_ENTERPRISE_PROJECT_ID && env.RECAPTCHA_ENTERPRISE_API_KEY)) {
      return jsonResponse({ success: false, error: 'reCAPTCHA secret is not configured' }, 500)
    }

    const result = await validateRecaptchaToken(token, secret || '', {
      siteKey: body.siteKey,
      projectId: env.RECAPTCHA_ENTERPRISE_PROJECT_ID,
      enterpriseApiKey: env.RECAPTCHA_ENTERPRISE_API_KEY,
    })

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: resolveRecaptchaErrorMessage(result.errorCodes),
          errorCodes: result.errorCodes,
        },
        400,
      )
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected reCAPTCHA error' },
      502,
    )
  }
}
