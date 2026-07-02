#!/usr/bin/env node
/**
 * Patch active SendGrid dynamic template versions to use {{subject}}.
 *
 * Usage:
 *   node scripts/sendgrid-patch-template-subjects.mjs
 *   node scripts/sendgrid-patch-template-subjects.mjs dispute_opened payout_released
 *   npm run email:patch-sendgrid-subjects
 *   npm run email:patch-sendgrid-subjects -- --phase5
 */

import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { EMAIL_TEMPLATE_KEYS } from '../supabase/functions/_shared/emailTemplateConfig.js'

const TARGET_SUBJECT = '{{subject}}'
const getEnv = (key) => process.env[key] ?? ''

const PHASE5_TEMPLATE_KEYS = [
  'dispute_opened',
  'evidence_requested',
  'return_authorised',
  'collection_arranged',
  'refund_pending',
  'refund_completed_case_closed',
  'case_closed_no_refund',
  'review_available',
  'review_received',
  'payout_released',
  'seller_onboarding_required',
  'welcome',
  'email_changed',
  'password_changed',
]

loadEnvFiles()

function parseTemplateKeys() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--phase5')
  if (process.argv.includes('--phase5') || args.length === 0) {
    return PHASE5_TEMPLATE_KEYS
  }
  return args
}

async function sendGridRequest(apiKey, path, { method = 'GET', body } = {}) {
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
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }

  return { ok: response.ok, status: response.status, json, text }
}

function getActiveVersion(template) {
  return template.versions?.find((version) => version.active === 1) ?? template.versions?.[0] ?? null
}

async function fetchTemplateInfo(apiKey, templateId) {
  const result = await sendGridRequest(apiKey, `/templates/${templateId}`)
  if (!result.ok) {
    return { ok: false, error: `GET template failed (${result.status}): ${result.text || 'unknown'}` }
  }

  const template = result.json
  const activeVersion = getActiveVersion(template)
  if (!activeVersion?.id) {
    return { ok: false, error: 'No active template version found' }
  }

  return {
    ok: true,
    templateName: template.name ?? null,
    templateId: template.id ?? templateId,
    activeVersionId: activeVersion.id,
    activeVersionName: activeVersion.name ?? null,
    templateSubject: activeVersion.subject ?? '',
  }
}

async function patchTemplateSubject(apiKey, templateId, versionId) {
  const result = await sendGridRequest(apiKey, `/templates/${templateId}/versions/${versionId}`, {
    method: 'PATCH',
    body: {
      subject: TARGET_SUBJECT,
      active: 1,
    },
  })

  if (!result.ok) {
    return {
      ok: false,
      error: `PATCH version failed (${result.status}): ${result.text || 'unknown'}`,
    }
  }

  return { ok: true }
}

function subjectIsPatched(subject) {
  return String(subject ?? '').trim() === TARGET_SUBJECT
}

async function patchOneTemplate(apiKey, templateKey) {
  const envVar = EMAIL_TEMPLATE_KEYS[templateKey]
  const templateId = envVar ? getEnv(envVar)?.trim() : ''

  if (!envVar) {
    return { ok: false, templateKey, error: `Unknown template key: ${templateKey}` }
  }
  if (!templateId) {
    return { ok: false, templateKey, envVar, error: `${envVar} is not set` }
  }

  const before = await fetchTemplateInfo(apiKey, templateId)
  if (!before.ok) {
    return { ok: false, templateKey, envVar, templateId, error: before.error }
  }

  if (subjectIsPatched(before.templateSubject)) {
    return {
      ok: true,
      templateKey,
      envVar,
      templateId,
      templateName: before.templateName,
      activeVersionId: before.activeVersionId,
      patched: false,
      alreadyPatched: true,
      templateSubject: before.templateSubject,
    }
  }

  const patchResult = await patchTemplateSubject(apiKey, templateId, before.activeVersionId)
  if (!patchResult.ok) {
    return { ok: false, templateKey, envVar, templateId, error: patchResult.error }
  }

  const after = await fetchTemplateInfo(apiKey, templateId)
  if (!after.ok) {
    return {
      ok: false,
      templateKey,
      envVar,
      templateId,
      error: `Patched but verification failed: ${after.error}`,
    }
  }

  if (!subjectIsPatched(after.templateSubject)) {
    return {
      ok: false,
      templateKey,
      envVar,
      templateId,
      error: `Verification failed: active subject is "${after.templateSubject}" (expected "${TARGET_SUBJECT}")`,
    }
  }

  return {
    ok: true,
    templateKey,
    envVar,
    templateId,
    templateName: after.templateName,
    activeVersionId: after.activeVersionId,
    patched: true,
    alreadyPatched: false,
    previousSubject: before.templateSubject,
    templateSubject: after.templateSubject,
  }
}

const apiKey = getEnv('SENDGRID_API_KEY')?.trim()
if (!apiKey) {
  console.error('SENDGRID_API_KEY is required.')
  process.exit(1)
}

const templateKeys = parseTemplateKeys()
console.log(`Patching ${templateKeys.length} SendGrid template(s) to subject "${TARGET_SUBJECT}"...\n`)

const results = []
let failures = 0

for (const templateKey of templateKeys) {
  const result = await patchOneTemplate(apiKey, templateKey)
  results.push(result)

  if (!result.ok) {
    failures += 1
    console.log(`FAIL  ${templateKey}`)
    console.log(`      ${result.error}`)
    continue
  }

  const status = result.alreadyPatched ? 'OK (already patched)' : 'OK (patched)'
  console.log(`${status.padEnd(22)} ${templateKey}`)
  console.log(`      template: ${result.templateName ?? '(unnamed)'} (${result.templateId})`)
  console.log(`      version:  ${result.activeVersionId}`)
  console.log(`      subject:  ${result.templateSubject}`)
  if (result.patched && result.previousSubject !== undefined) {
    console.log(`      was:      ${result.previousSubject || '(blank)'}`)
  }
}

console.log('\n--- Summary ---')
const patched = results.filter((r) => r.ok && r.patched).length
const already = results.filter((r) => r.ok && r.alreadyPatched).length
console.log(`Total: ${templateKeys.length}`)
console.log(`Patched now: ${patched}`)
console.log(`Already correct: ${already}`)
console.log(`Failed: ${failures}`)

if (failures > 0) {
  process.exit(1)
}

console.log('\nAll templates verified with active subject {{subject}}.')
