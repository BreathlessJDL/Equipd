import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_REQUIRED_FIELDS,
  isEmailTemplateKey,
} from './emailTemplateConfig.js'
import { normalizeEmailSubject } from './emailFormatting.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const DEFAULT_EMAIL_LOGO_URL = 'https://equipd.co.uk/email/equipd-full-logo.png'

function logoUrlForBase(baseUrl) {
  return `${baseUrl.replace(/\/$/, '')}/email/equipd-full-logo.png`
}

export function resolveAppBaseUrl(getEnv) {
  const base =
    getEnv('APP_BASE_URL')?.trim() ||
    getEnv('EQUIPD_APP_URL')?.trim() ||
    'https://equipd.co.uk'

  return base.replace(/\/$/, '')
}

export function resolveLogoUrl(getEnv, dynamicData = {}) {
  const explicit = dynamicData.logo_url?.trim()
  if (explicit) return explicit

  const envOverride = getEnv('EMAIL_LOGO_URL')?.trim()
  if (envOverride) return envOverride

  const baseUrl = resolveAppBaseUrl(getEnv)
  if (baseUrl && !/localhost|127\.0\.0\.1/i.test(baseUrl)) {
    return logoUrlForBase(baseUrl)
  }

  return DEFAULT_EMAIL_LOGO_URL
}

export function isDryRunMode(getEnv) {
  if (!getEnv('SENDGRID_API_KEY')?.trim()) {
    return true
  }

  const flag = getEnv('EMAIL_DRY_RUN')?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

export function normalizeRecipients(to) {
  if (typeof to === 'string') {
    return [to.trim()].filter(Boolean)
  }

  if (Array.isArray(to)) {
    return to.map((entry) => String(entry ?? '').trim()).filter(Boolean)
  }

  return []
}

export function resolveTemplateId(templateKey, getEnv) {
  const envVarName = EMAIL_TEMPLATE_KEYS[templateKey]
  if (!envVarName) {
    return { ok: false, error: `Unknown email template key: ${templateKey}` }
  }

  const templateId = getEnv(envVarName)?.trim()
  if (!templateId) {
    return {
      ok: false,
      error: `SendGrid template ID not configured (${envVarName})`,
    }
  }

  return { ok: true, templateId, envVarName }
}

export function validateTransactionalEmail({ to, templateKey, dynamicData }) {
  if (!isEmailTemplateKey(templateKey)) {
    return { ok: false, error: `Unknown email template key: ${templateKey}` }
  }

  const recipients = normalizeRecipients(to)
  if (recipients.length === 0) {
    return { ok: false, error: 'At least one recipient email is required' }
  }

  for (const email of recipients) {
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: `Invalid recipient email: ${email}` }
    }
  }

  if (!dynamicData || typeof dynamicData !== 'object' || Array.isArray(dynamicData)) {
    return { ok: false, error: 'dynamicData must be a plain object' }
  }

  const requiredFields = EMAIL_TEMPLATE_REQUIRED_FIELDS[templateKey] ?? []
  const missing = requiredFields.filter((field) => {
    const value = dynamicData[field]
    return value === undefined || value === null || String(value).trim() === ''
  })

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required dynamicData fields for ${templateKey}: ${missing.join(', ')}`,
    }
  }

  return { ok: true, recipients }
}

export function enrichDynamicData(dynamicData, getEnv) {
  const baseUrl = resolveAppBaseUrl(getEnv)

  return {
    ...dynamicData,
    base_url: baseUrl,
    year: String(new Date().getFullYear()),
    tagline:
      dynamicData.tagline?.trim() ||
      'The UK marketplace for used gym equipment.',
    logo_url: resolveLogoUrl(getEnv, dynamicData),
  }
}

export function resolveSenderConfig(getEnv, replyTo) {
  const fromEmail = getEnv('SENDGRID_FROM_EMAIL')?.trim()
  const fromName = getEnv('SENDGRID_FROM_NAME')?.trim() || 'Equipd'
  const defaultReplyTo = getEnv('SENDGRID_REPLY_TO_EMAIL')?.trim() || fromEmail
  const replyToEmail = replyTo?.trim() || defaultReplyTo

  if (!fromEmail) {
    return { ok: false, error: 'SENDGRID_FROM_EMAIL is not configured' }
  }

  if (!EMAIL_PATTERN.test(fromEmail)) {
    return { ok: false, error: 'SENDGRID_FROM_EMAIL is invalid' }
  }

  if (replyToEmail && !EMAIL_PATTERN.test(replyToEmail)) {
    return { ok: false, error: 'Reply-to email is invalid' }
  }

  return {
    ok: true,
    from: { email: fromEmail, name: fromName },
    replyTo: replyToEmail ? { email: replyToEmail } : undefined,
  }
}

export function buildSendGridPayload({
  recipients,
  templateId,
  dynamicTemplateData,
  from,
  replyTo,
}) {
  const subject = normalizeEmailSubject(dynamicTemplateData.subject)
  const personalization = {
    to: recipients.map((email) => ({ email })),
    dynamic_template_data: dynamicTemplateData,
  }

  if (subject) {
    personalization.subject = subject
  }

  const payload = {
    personalizations: [personalization],
    from,
    reply_to: replyTo,
    template_id: templateId,
  }

  if (subject) {
    payload.subject = subject
  }

  return payload
}

export function summarizeSendGridPayloadSubjects(payload) {
  return {
    topLevelSubject: payload.subject ?? null,
    personalizationSubject: payload.personalizations?.[0]?.subject ?? null,
    dynamicTemplateDataSubject:
      payload.personalizations?.[0]?.dynamic_template_data?.subject ?? null,
  }
}

/** Log exact JSON body sent to SendGrid (no API key in payload). */
export function logSendGridMailPayload(log, payload, context = {}) {
  const subjectFields = summarizeSendGridPayloadSubjects(payload)
  log(
    'sendTransactionalEmail SendGrid request body',
    JSON.stringify(
      {
        ...context,
        subjectFields,
        payload,
      },
      null,
      2,
    ),
  )
}

/**
 * @param {object} params
 * @param {string|string[]} params.to
 * @param {string} params.templateKey
 * @param {Record<string, unknown>} params.dynamicData
 * @param {string} [params.replyTo]
 * @param {{ getEnv: (key: string) => string | undefined, sendViaApi: Function, log: Function }} deps
 */
export async function sendTransactionalEmail(
  { to, templateKey, dynamicData, replyTo },
  { getEnv, sendViaApi, log },
) {
  try {
    const validation = validateTransactionalEmail({ to, templateKey, dynamicData })
    if (!validation.ok) {
      log('sendTransactionalEmail validation failed', validation.error)
      return validation
    }

    const enrichedData = enrichDynamicData(dynamicData, getEnv)
    const dryRun = isDryRunMode(getEnv)

    if (dryRun) {
      const templateResolution = resolveTemplateId(templateKey, getEnv)
      const senderPreview = resolveSenderConfig(getEnv, replyTo)
      const dryRunPayload =
        templateResolution.ok && senderPreview.ok
          ? buildSendGridPayload({
              recipients: validation.recipients,
              templateId: templateResolution.templateId,
              dynamicTemplateData: enrichedData,
              from: senderPreview.from,
              replyTo: senderPreview.replyTo,
            })
          : null

      if (dryRunPayload) {
        logSendGridMailPayload(log, dryRunPayload, {
          templateKey,
          dryRun: true,
          reason: !getEnv('SENDGRID_API_KEY')?.trim()
            ? 'SENDGRID_API_KEY is not set'
            : 'EMAIL_DRY_RUN is enabled',
        })
      } else {
        log('sendTransactionalEmail dry-run', JSON.stringify({
          to: validation.recipients,
          templateKey,
          templateId: templateResolution.ok ? templateResolution.templateId : null,
          dynamicTemplateData: enrichedData,
          dryRun: true,
        }, null, 2))
      }

      return { ok: true, dryRun: true, payload: dryRunPayload }
    }

    const sender = resolveSenderConfig(getEnv, replyTo)
    if (!sender.ok) {
      log('sendTransactionalEmail sender config failed', sender.error)
      return sender
    }

    const templateResolution = resolveTemplateId(templateKey, getEnv)
    if (!templateResolution.ok) {
      log('sendTransactionalEmail template resolution failed', templateResolution.error)
      return templateResolution
    }

    const mailPayload = buildSendGridPayload({
      recipients: validation.recipients,
      templateId: templateResolution.templateId,
      dynamicTemplateData: enrichedData,
      from: sender.from,
      replyTo: sender.replyTo,
    })

    logSendGridMailPayload(log, mailPayload, { templateKey })

    const sendResult = await sendViaApi({
      apiKey: getEnv('SENDGRID_API_KEY').trim(),
      payload: mailPayload,
      templateKey,
    })

    if (!sendResult.ok) {
      log(
        `sendTransactionalEmail send failed (${templateKey})`,
        sendResult.error ?? 'Unknown SendGrid error',
      )
    }

    return sendResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('sendTransactionalEmail unexpected error', message)
    return { ok: false, error: message }
  }
}
