import { sendTransactionalEmail } from '../emails/node/sendTransactionalEmail.mjs'
import {
  buildSendGridPayload,
  enrichDynamicData,
  isDryRunMode,
  resolveSenderConfig,
  resolveTemplateId,
  summarizeSendGridPayloadSubjects,
} from '../supabase/functions/_shared/transactionalEmailCore.js'
import {
  buildRemainingTestDynamicData,
  isRemainingEmailTemplateKey,
  REMAINING_EMAIL_TEMPLATE_KEYS,
} from './remainingEmailTestData.mjs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertSubjectPopulated(dynamicData, templateKey) {
  const subject = dynamicData?.subject?.trim()
  if (!subject) {
    return {
      ok: false,
      error: `Subject is empty for template "${templateKey}". Test sends require a populated subject.`,
    }
  }
  return { ok: true, subject }
}

async function sendViaFetch({ apiKey, payload }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await response.text().catch(() => '')

  return {
    ok: response.ok,
    status: response.status,
    messageId: response.headers.get('x-message-id'),
    body: body || null,
  }
}

function printSendSummary({ templateKey, templateId, subject, recipient, sendGridResponse, dryRun }) {
  console.log('')
  console.log('--- Transactional email test send ---')
  console.log(`Template key: ${templateKey}`)
  console.log(`Template ID: ${templateId || '(dry-run — not configured)'}`)
  console.log(`Subject: ${subject}`)
  console.log(`Recipient: ${recipient}`)

  if (dryRun) {
    console.log('SendGrid response: dry-run (no API call)')
    return
  }

  console.log(
    'SendGrid response:',
    JSON.stringify(
      {
        ok: sendGridResponse.ok,
        status: sendGridResponse.status,
        messageId: sendGridResponse.messageId,
        errorBody: sendGridResponse.ok ? null : sendGridResponse.body,
      },
      null,
      2,
    ),
  )
}

export async function sendRemainingTestEmail({
  templateKey,
  to,
  getEnv = (key) => process.env[key] ?? '',
  recipientRole = 'buyer',
}) {
  if (!isRemainingEmailTemplateKey(templateKey)) {
    return { ok: false, error: `Unknown remaining template key: ${templateKey}` }
  }

  const recipient = to?.trim()
  if (!recipient || !EMAIL_PATTERN.test(recipient)) {
    return { ok: false, error: `Invalid recipient email: ${to}` }
  }

  const dynamicData = buildRemainingTestDynamicData(templateKey, getEnv, { recipientRole })
  if (!dynamicData) {
    return { ok: false, error: `No mock data for template key: ${templateKey}` }
  }

  const subjectCheck = assertSubjectPopulated(dynamicData, templateKey)
  if (!subjectCheck.ok) {
    return subjectCheck
  }

  const dryRun = isDryRunMode(getEnv)
  const templateResolution = resolveTemplateId(templateKey, getEnv)

  if (!dryRun) {
    if (!getEnv('SENDGRID_API_KEY')?.trim()) {
      return { ok: false, error: 'SENDGRID_API_KEY is required' }
    }
    if (!templateResolution.ok) {
      return templateResolution
    }
    const sender = resolveSenderConfig(getEnv)
    if (!sender.ok) {
      return sender
    }

    const enriched = enrichDynamicData(dynamicData, getEnv)
    const payload = buildSendGridPayload({
      recipients: [recipient],
      templateId: templateResolution.templateId,
      dynamicTemplateData: enriched,
      from: sender.from,
      replyTo: sender.replyTo,
    })

    console.log('Subject fields in payload:', summarizeSendGridPayloadSubjects(payload))

    const sendGridResponse = await sendViaFetch({
      apiKey: getEnv('SENDGRID_API_KEY').trim(),
      payload,
    })

    printSendSummary({
      templateKey,
      templateId: templateResolution.templateId,
      subject: subjectCheck.subject,
      recipient,
      sendGridResponse,
      dryRun: false,
    })

    if (!sendGridResponse.ok) {
      return {
        ok: false,
        error: sendGridResponse.body || `SendGrid returned HTTP ${sendGridResponse.status}`,
      }
    }

    return { ok: true, templateKey, subject: subjectCheck.subject, recipient, messageId: sendGridResponse.messageId }
  }

  const result = await sendTransactionalEmail({ to: recipient, templateKey, dynamicData })

  printSendSummary({
    templateKey,
    templateId: templateResolution.ok ? templateResolution.templateId : '',
    subject: subjectCheck.subject,
    recipient,
    sendGridResponse: null,
    dryRun: true,
  })

  if (!result.ok) {
    return result
  }

  return { ok: true, dryRun: true, templateKey, subject: subjectCheck.subject, recipient }
}

export { REMAINING_EMAIL_TEMPLATE_KEYS }
