interface PluggyWebhookEnv {
  PLUGGY_WEBHOOK_SECRET?: string
}

interface PluggyWebhookEvent {
  event?: string
  eventId?: string
  itemId?: string
  clientUserId?: string
  triggeredBy?: string
  error?: {
    code?: string
    message?: string
    parameter?: string
  }
  [key: string]: unknown
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

async function readWebhookEvent(request: Request) {
  try {
    return (await request.json()) as PluggyWebhookEvent
  } catch {
    return {} as PluggyWebhookEvent
  }
}

function assertWebhookSecret(request: Request, env: PluggyWebhookEnv) {
  if (!env.PLUGGY_WEBHOOK_SECRET) {
    return
  }

  const url = new URL(request.url)
  const token = request.headers.get('x-ifinanca-webhook-secret') ?? url.searchParams.get('token')

  if (token !== env.PLUGGY_WEBHOOK_SECRET) {
    throw new Error('Invalid webhook secret')
  }
}

async function handleItemCreated(event: PluggyWebhookEvent) {
  console.log('Pluggy item created', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    triggeredBy: event.triggeredBy,
  })
}

async function handleItemUpdated(event: PluggyWebhookEvent) {
  console.log('Pluggy item updated', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    triggeredBy: event.triggeredBy,
  })
}

async function handleItemError(event: PluggyWebhookEvent) {
  console.error('Pluggy item error', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    error: event.error,
  })
}

async function handleWebhookEvent(event: PluggyWebhookEvent) {
  console.log('Received Pluggy webhook', {
    event: event.event,
    eventId: event.eventId,
    itemId: event.itemId,
  })

  switch (event.event) {
    case 'item/created':
      await handleItemCreated(event)
      break
    case 'item/updated':
      await handleItemUpdated(event)
      break
    case 'item/error':
      await handleItemError(event)
      break
    default:
      console.log('Unhandled Pluggy webhook event', {
        event: event.event,
        eventId: event.eventId,
      })
  }
}

export async function onRequestPost({
  request,
  env,
  waitUntil,
}: {
  request: Request
  env: PluggyWebhookEnv
  waitUntil: (promise: Promise<unknown>) => void
}) {
  try {
    assertWebhookSecret(request, env)
    const event = await readWebhookEvent(request)

    waitUntil(
      handleWebhookEvent(event).catch((error) => {
        console.error('Pluggy webhook background processing failed', error)
      }),
    )

    return jsonResponse({
      received: true,
      event: event.event ?? null,
      eventId: event.eventId ?? null,
    })
  } catch (error) {
    return jsonResponse(
      { received: false, error: error instanceof Error ? error.message : 'Invalid webhook' },
      401,
    )
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
    },
  })
}
