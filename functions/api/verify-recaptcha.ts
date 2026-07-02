interface RecaptchaVerificationResponse {
  success: boolean
  'error-codes'?: string[]
}

interface RecaptchaEnv {
  RECAPTCHA_SECRET_KEY?: string
  RECAPTCHA_ENTERPRISE_PROJECT_ID?: string
  RECAPTCHA_ENTERPRISE_API_KEY?: string
  /** Minimum acceptable reCAPTCHA Enterprise risk score (0.0–1.0). Defaults to 0.5. */
  RECAPTCHA_MIN_SCORE?: string
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
  'action-mismatch': 'The reCAPTCHA action does not match the expected action.',
  'score-too-low': 'The reCAPTCHA risk score is too low. This request looks suspicious.',
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
    score: undefined as number | undefined,
  }
}

async function validateRecaptchaWithEnterpriseAssessment(
  token: string,
  siteKey: string,
  projectId: string,
  apiKey: string,
  options?: {
    /** Expected action name set in grecaptcha.enterprise.execute(). When provided, the assessment action must match. */
    expectedAction?: string
    /** Minimum risk score (0.0–1.0) to consider the request valid. Defaults to 0.5. */
    minScore?: number
  },
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
          // Passing expectedAction lets the API include it in tokenProperties for our verification below.
          ...(options?.expectedAction ? { expectedAction: options.expectedAction } : {}),
        },
      }),
    },
  )

  const payload = (await response.json().catch(() => ({}))) as {
    tokenProperties?: { valid?: boolean; invalidReason?: string; action?: string }
    riskAnalysis?: { score?: number; reasons?: string[] }
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'reCAPTCHA Enterprise assessment failed')
  }

  const valid = Boolean(payload.tokenProperties?.valid)
  const invalidReason = payload.tokenProperties?.invalidReason
  const score = payload.riskAnalysis?.score

  // Token is structurally invalid.
  if (!valid) {
    return {
      success: false,
      errorCodes: [invalidReason || 'invalid-input-response'],
      score,
    }
  }

  // Verify that the action matches what the client declared.
  // This prevents token reuse across different form actions.
  if (options?.expectedAction) {
    const assessedAction = payload.tokenProperties?.action
    if (assessedAction !== options.expectedAction) {
      return {
        success: false,
        errorCodes: ['action-mismatch'],
        score,
      }
    }
  }

  // Enforce minimum score threshold (Google recommends 0.5 as a starting point).
  const minScore = options?.minScore ?? 0.5
  if (typeof score === 'number' && score < minScore) {
    return {
      success: false,
      errorCodes: ['score-too-low'],
      score,
    }
  }

  return {
    success: true,
    errorCodes: [],
    score,
  }
}

export async function validateRecaptchaToken(
  token: string,
  secret: string,
  options?: {
    siteKey?: string
    projectId?: string
    enterpriseApiKey?: string
    /** Expected action name. Only validated in Enterprise mode. */
    expectedAction?: string
    /** Minimum risk score 0.0–1.0. Only validated in Enterprise mode. Defaults to 0.5. */
    minScore?: number
  },
) {
  const projectId = options?.projectId?.trim()
  const enterpriseApiKey = options?.enterpriseApiKey?.trim()
  const siteKey = options?.siteKey?.trim()

  if (projectId && enterpriseApiKey && siteKey) {
    return validateRecaptchaWithEnterpriseAssessment(token, siteKey, projectId, enterpriseApiKey, {
      expectedAction: options?.expectedAction,
      minScore: options?.minScore,
    })
  }

  return validateRecaptchaWithSiteVerify(token, secret)
}

export async function onRequestPost({ request, env }: { request: Request; env: RecaptchaEnv }) {
  try {
    assertSameOrigin(request)

    const body = (await request.json().catch(() => ({}))) as {
      token?: string
      siteKey?: string
      /** The action name passed to grecaptcha.enterprise.execute(). */
      action?: string
    }
    const token = body.token?.trim()
    const secret = env.RECAPTCHA_SECRET_KEY?.trim()

    if (!token) {
      return jsonResponse({ success: false, error: 'Missing reCAPTCHA token' }, 400)
    }

    if (!secret && !(env.RECAPTCHA_ENTERPRISE_PROJECT_ID && env.RECAPTCHA_ENTERPRISE_API_KEY)) {
      return jsonResponse({ success: false, error: 'reCAPTCHA secret is not configured' }, 500)
    }

    // Parse the minimum score from env, falling back to 0.5.
    const minScore = env.RECAPTCHA_MIN_SCORE ? Number.parseFloat(env.RECAPTCHA_MIN_SCORE) : 0.5
    const resolvedMinScore = Number.isFinite(minScore) && minScore >= 0 && minScore <= 1 ? minScore : 0.5

    const result = await validateRecaptchaToken(token, secret || '', {
      siteKey: body.siteKey,
      projectId: env.RECAPTCHA_ENTERPRISE_PROJECT_ID,
      enterpriseApiKey: env.RECAPTCHA_ENTERPRISE_API_KEY,
      expectedAction: body.action,
      minScore: resolvedMinScore,
    })

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: resolveRecaptchaErrorMessage(result.errorCodes),
          errorCodes: result.errorCodes,
          score: result.score ?? null,
        },
        400,
      )
    }

    return jsonResponse({ success: true, score: result.score ?? null })
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected reCAPTCHA error' },
      502,
    )
  }
}
