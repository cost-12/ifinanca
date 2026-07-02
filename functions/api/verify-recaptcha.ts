interface RecaptchaVerificationResponse {
  success: boolean
  'error-codes'?: string[]
}

interface RecaptchaEnv {
  RECAPTCHA_SECRET_KEY?: string
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

export async function validateRecaptchaToken(token: string, secret: string) {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ secret, response: token }).toString(),
  })

  const payload = (await response.json().catch(() => ({}))) as Partial<RecaptchaVerificationResponse>
  return {
    success: Boolean(payload.success),
    errorCodes: payload['error-codes'] ?? [],
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: RecaptchaEnv }) {
  try {
    assertSameOrigin(request)

    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = body.token?.trim()
    const secret = env.RECAPTCHA_SECRET_KEY?.trim()

    if (!token) {
      return jsonResponse({ success: false, error: 'Missing reCAPTCHA token' }, 400)
    }

    if (!secret) {
      return jsonResponse({ success: false, error: 'reCAPTCHA secret is not configured' }, 500)
    }

    const result = await validateRecaptchaToken(token, secret)

    if (!result.success) {
      return jsonResponse({ success: false, error: 'reCAPTCHA verification failed', errorCodes: result.errorCodes }, 400)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unexpected reCAPTCHA error' }, 502)
  }
}
