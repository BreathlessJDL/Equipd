import sgMail from '@sendgrid/mail'
import { sendTransactionalEmail as sendTransactionalEmailCore } from '../../supabase/functions/_shared/transactionalEmailCore.js'

function getEnv(key) {
  return process.env[key] ?? ''
}

function log(message, detail) {
  if (detail) {
    console.error(message, detail)
    return
  }
  console.error(message)
}

async function sendViaSendGridMail({ apiKey, payload }) {
  sgMail.setApiKey(apiKey)

  try {
    const [response] = await sgMail.send(payload)
    const messageId = response?.headers?.['x-message-id']
    return { ok: true, messageId }
  } catch (error) {
    const responseBody = error?.response?.body
    const detail =
      typeof responseBody === 'string'
        ? responseBody
        : responseBody
          ? JSON.stringify(responseBody)
          : error?.message

    return {
      ok: false,
      error: detail || 'SendGrid send failed',
    }
  }
}

export async function sendTransactionalEmail(params) {
  return sendTransactionalEmailCore(params, {
    getEnv,
    log,
    sendViaApi: sendViaSendGridMail,
  })
}
