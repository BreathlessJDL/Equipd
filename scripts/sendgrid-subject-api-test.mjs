#!/usr/bin/env node
/**
 * Direct SendGrid Mail Send API test for dynamic template subject behaviour.
 *
 * Sends offer_received template with hardcoded subject "TEST SUBJECT FROM API"
 * at both top-level and personalization, bypassing marketplace compose logic.
 *
 * Usage:
 *   npm run email:test-sendgrid-subject -- you@example.com
 *   node scripts/sendgrid-subject-api-test.mjs you@example.com
 */

import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { getPreviewMockData } from '../emails/preview/mockData.js'
import {
  buildSendGridPayload,
  resolveSenderConfig,
  summarizeSendGridPayloadSubjects,
} from '../supabase/functions/_shared/transactionalEmailCore.js'

const TEST_SUBJECT = 'TEST SUBJECT FROM API'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const getEnv = (key) => process.env[key] ?? ''

loadEnvFiles()

function parseRecipient() {
  const arg = process.argv[2]?.trim()
  const to = arg || getEnv('EMAIL_TEST_TO')?.trim() || getEnv('SENDGRID_TEST_TO')?.trim()
  if (!to) {
    console.error(
      'Usage: npm run email:test-sendgrid-subject -- you@example.com\n' +
        'Or set EMAIL_TEST_TO in .env.local',
    )
    process.exit(1)
  }
  if (!EMAIL_PATTERN.test(to)) {
    console.error(`Invalid recipient email: ${to}`)
    process.exit(1)
  }
  return to
}

async function fetchTemplateSubjectInfo(apiKey, templateId) {
  const response = await fetch(`https://api.sendgrid.com/v3/templates/${templateId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    return {
      ok: false,
      error: `Template API ${response.status}: ${body || response.statusText}`,
    }
  }

  const template = await response.json()
  const activeVersion =
    template.versions?.find((version) => version.active === 1) ?? template.versions?.[0]

  return {
    ok: true,
    templateName: template.name ?? null,
    templateId: template.id ?? templateId,
    activeVersionId: activeVersion?.id ?? null,
    activeVersionName: activeVersion?.name ?? null,
    templateSubject: activeVersion?.subject ?? null,
    templateSubjectIsBlank: !activeVersion?.subject?.trim(),
    templateSubjectUsesSubjectVar: activeVersion?.subject?.includes('{{subject}}') ?? false,
  }
}

async function sendMail(apiKey, payload) {
  const body = JSON.stringify(payload)
  console.log('\n--- SendGrid request body (no API key) ---')
  console.log(body)
  console.log('--- end request body ---\n')

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  const responseText = await response.text().catch(() => '')
  return {
    ok: response.ok,
    status: response.status,
    messageId: response.headers.get('x-message-id'),
    body: responseText,
  }
}

const recipient = parseRecipient()
const apiKey = getEnv('SENDGRID_API_KEY')?.trim()
const templateId = getEnv('SENDGRID_TEMPLATE_OFFER_RECEIVED')?.trim()

if (!apiKey) {
  console.error('SENDGRID_API_KEY is required for this test.')
  process.exit(1)
}
if (!templateId) {
  console.error('SENDGRID_TEMPLATE_OFFER_RECEIVED is required for this test.')
  process.exit(1)
}

const sender = resolveSenderConfig(getEnv)
if (!sender.ok) {
  console.error(sender.error)
  process.exit(1)
}

const mockData = getPreviewMockData('offer_received', getEnv)
if (!mockData) {
  console.error('No mock data for offer_received')
  process.exit(1)
}

const dynamicTemplateData = {
  ...mockData,
  subject: TEST_SUBJECT,
}

const payload = buildSendGridPayload({
  recipients: [recipient],
  templateId,
  dynamicTemplateData,
  from: sender.from,
  replyTo: sender.replyTo,
})

console.log('SendGrid subject API test (offer_received)')
console.log(`Recipient: ${recipient}`)
console.log(`Template ID: ${templateId}`)
console.log(`Hardcoded subject: ${TEST_SUBJECT}`)
console.log('Subject fields in built payload:', summarizeSendGridPayloadSubjects(payload))

const templateInfo = await fetchTemplateSubjectInfo(apiKey, templateId)
console.log('\n--- SendGrid template active version subject ---')
if (templateInfo.ok) {
  console.log(JSON.stringify(templateInfo, null, 2))
  if (templateInfo.templateSubjectIsBlank) {
    console.warn(
      '\nWARNING: Active template version has a blank subject. SendGrid may ignore API subjects until the template subject is set to {{subject}}.',
    )
  } else if (!templateInfo.templateSubjectUsesSubjectVar) {
    console.warn(
      `\nWARNING: Active template subject is "${templateInfo.templateSubject}" (not {{subject}}). A locked static subject may override API values.`,
    )
  }
} else {
  console.warn(templateInfo.error)
}

const sendResult = await sendMail(apiKey, payload)

console.log('--- SendGrid send result ---')
console.log(
  JSON.stringify(
    {
      ok: sendResult.ok,
      status: sendResult.status,
      messageId: sendResult.messageId,
      errorBody: sendResult.ok ? null : sendResult.body || null,
    },
    null,
    2,
  ),
)

if (!sendResult.ok) {
  console.error('\nSend failed.')
  process.exit(1)
}

console.log(
  `\nEmail accepted by SendGrid (message ID: ${sendResult.messageId}). ` +
    `Check inbox for subject "${TEST_SUBJECT}". ` +
    'If the received email still has a blank subject, set the SendGrid template subject to {{subject}} and activate a new version.',
)
