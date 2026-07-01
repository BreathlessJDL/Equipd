import { sendTransactionalEmail as sendTransactionalEmailCore } from './transactionalEmailCore.js'

export type SendTransactionalEmailParams = {
  to: string | string[]
  templateKey: string
  dynamicData: Record<string, unknown>
  replyTo?: string
}

export type SendTransactionalEmailResult = {
  ok: boolean
  dryRun?: boolean
  payload?: Record<string, unknown>
  messageId?: string
  error?: string
}

function getEnv(key: string): string {
  return Deno.env.get(key) ?? ''
}

function log(message: string, detail?: string) {
  if (detail) {
    console.error(message, detail)
    return
  }
  console.error(message)
}

async function sendViaSendGridFetch({
  apiKey,
  payload,
}: {
  apiKey: string
  payload: Record<string, unknown>
  templateKey: string
}): Promise<SendTransactionalEmailResult> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (response.ok) {
    const messageId = response.headers.get('x-message-id') ?? undefined
    return { ok: true, messageId }
  }

  let errorBody = ''
  try {
    errorBody = await response.text()
  } catch {
    errorBody = ''
  }

  return {
    ok: false,
    error: `SendGrid API ${response.status}: ${errorBody || response.statusText}`,
  }
}

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<SendTransactionalEmailResult> {
  return sendTransactionalEmailCore(params, {
    getEnv,
    log,
    sendViaApi: sendViaSendGridFetch,
  })
}
