#!/usr/bin/env node
/**
 * Confirm SENDGRID_TEMPLATE_EQUIPMENT_ITEM_SAVED resolves {{subject}}
 * and that a real SendGrid send stores the expected subject.
 * Does not print template IDs or API keys.
 */
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { composeEquipmentItemSavedDynamicData } from '../supabase/functions/_shared/marketplaceEmailCore.js'
import {
  buildSendGridPayload,
  resolveSenderConfig,
  resolveTemplateId,
  summarizeSendGridPayloadSubjects,
} from '../supabase/functions/_shared/transactionalEmailCore.js'

loadEnvFiles()

const getEnv = (key) => process.env[key] ?? ''
const EXPECTED_TITLE = 'Life Fitness E5 Cross-Trainer'
const EXPECTED_SUBJECT = `Someone saved your ${EXPECTED_TITLE}`
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const recipient =
  process.argv[2]?.trim() ||
  getEnv('EMAIL_TEST_TO')?.trim() ||
  getEnv('SENDGRID_TEST_TO')?.trim() ||
  getEnv('ADMIN_TEST_EMAIL')?.trim()
if (!recipient || !EMAIL_PATTERN.test(recipient)) {
  console.error('Provide a recipient: node scripts/validate-equipment-item-saved-subject.mjs you@example.com')
  process.exit(1)
}

const apiKey = getEnv('SENDGRID_API_KEY')?.trim()
if (!apiKey) {
  console.error('SENDGRID_API_KEY is required')
  process.exit(1)
}

const templateResolution = resolveTemplateId('equipment_item_saved', getEnv)
if (!templateResolution.ok) {
  console.error(templateResolution.error)
  process.exit(1)
}

const sender = resolveSenderConfig(getEnv)
if (!sender.ok) {
  console.error(sender.error)
  process.exit(1)
}

async function sendGridRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.sendgrid.com/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text().catch(() => '')
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { ok: response.ok, status: response.status, json, text }
}

const templateId = templateResolution.templateId
const templateInfo = await sendGridRequest(`/templates/${templateId}`)
if (!templateInfo.ok) {
  console.error(`Failed to fetch SendGrid template (${templateInfo.status})`)
  process.exit(1)
}

const activeVersion =
  templateInfo.json.versions?.find((version) => version.active === 1) ??
  templateInfo.json.versions?.[0]
const templateSubject = activeVersion?.subject ?? ''
console.log(
  JSON.stringify({
    step: 'template_subject',
    templateName: templateInfo.json.name ?? null,
    envVar: templateResolution.envVarName,
    templateConfigured: true,
    activeVersionName: activeVersion?.name ?? null,
    templateSubject,
    usesSubjectVar: templateSubject.includes('{{subject}}'),
  }),
)

if (!templateSubject.includes('{{subject}}')) {
  console.log(JSON.stringify({ step: 'patching_template_subject_to_handlebars' }))
  const patch = await sendGridRequest(`/templates/${templateId}/versions/${activeVersion.id}`, {
    method: 'PATCH',
    body: { subject: '{{subject}}', active: 1 },
  })
  if (!patch.ok) {
    console.error(`Failed to patch template subject (${patch.status})`)
    process.exit(1)
  }
  const verify = await sendGridRequest(`/templates/${templateId}`)
  const verified =
    verify.json.versions?.find((version) => version.active === 1)?.subject ?? ''
  console.log(
    JSON.stringify({
      step: 'template_subject_after_patch',
      templateSubject: verified,
      usesSubjectVar: verified.includes('{{subject}}'),
    }),
  )
  if (!verified.includes('{{subject}}')) {
    console.error('Template subject is still not {{subject}}; refusing to send.')
    process.exit(1)
  }
}

const dynamicData = composeEquipmentItemSavedDynamicData({
  baseUrl: 'https://equipd.co.uk',
  listing: {
    id: 'list-subject-test',
    slug: 'life-fitness-e5-cross-trainer',
    title: EXPECTED_TITLE,
  },
  sellerProfile: { username: 'sarahlifts', display_name: 'Sarah Mitchell' },
  saveCount: 2,
})

const payload = buildSendGridPayload({
  recipients: [recipient],
  templateId,
  dynamicTemplateData: dynamicData,
  from: sender.from,
  replyTo: sender.replyTo,
})

console.log(
  JSON.stringify({
    step: 'payload_subjects',
    expectedSubject: EXPECTED_SUBJECT,
    ...summarizeSendGridPayloadSubjects(payload),
    ctaUrl: dynamicData.cta_url,
    saveCountText: dynamicData.save_count_text,
    firstName: dynamicData.first_name,
    privacyLeak: /sarahlifts|jamesgym|saver/i.test(JSON.stringify(dynamicData))
      ? 'seller_username_ok_if_first_name'
      : 'no_saver_identity',
  }),
)

const sendResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})
const sendBody = await sendResponse.text().catch(() => '')
const messageId = sendResponse.headers.get('x-message-id')
console.log(
  JSON.stringify({
    step: 'send_result',
    ok: sendResponse.ok,
    status: sendResponse.status,
    hasMessageId: Boolean(messageId),
    error: sendResponse.ok ? null : sendBody.slice(0, 300),
  }),
)
if (!sendResponse.ok) process.exit(1)

let activity = null
for (let attempt = 0; attempt < 12; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const query = encodeURIComponent(`msg_id="${messageId}"`)
  const activityResponse = await sendGridRequest(`/messages?limit=1&query=${query}`)
  if (activityResponse.status === 403 || activityResponse.status === 404) {
    activity = {
      ok: false,
      reason: `messages_api_${activityResponse.status}`,
    }
    break
  }
  const row = activityResponse.json?.messages?.[0]
  if (row) {
    activity = {
      ok: true,
      status: row.status ?? null,
      subject: row.subject ?? null,
      matchesExpected: row.subject === EXPECTED_SUBJECT,
      subjectBlank: !String(row.subject ?? '').trim(),
    }
    if (row.subject) break
  }
}

console.log(JSON.stringify({ step: 'sendgrid_activity', activity, expectedSubject: EXPECTED_SUBJECT }))

if (activity?.subjectBlank) {
  console.error('BLOCKER: SendGrid activity shows a blank subject.')
  process.exit(1)
}
if (activity?.ok && activity.subject && activity.subject !== EXPECTED_SUBJECT) {
  console.error(`BLOCKER: Received subject "${activity.subject}"`)
  process.exit(1)
}
if (!activity?.ok) {
  console.log(
    JSON.stringify({
      step: 'inbox_check_required',
      note: 'Messages API unavailable or still pending. Check the test inbox subject before deploying.',
      expectedSubject: EXPECTED_SUBJECT,
    }),
  )
}
