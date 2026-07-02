#!/usr/bin/env node
/**
 * Compose Equipd master email layout and Phase 2 transactional template outputs.
 *
 * Usage:
 *   node scripts/build-email-master.mjs
 *   node scripts/build-email-master.mjs --preview
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDistPaths,
  getSendGridOutputPaths,
  readMasterTemplate,
  renderMasterEmail,
} from '../emails/renderMasterEmail.js'
import {
  ALL_EMAIL_TEMPLATES,
} from '../emails/templates/index.js'
import {
  DEFAULT_EMAIL_LOGO_URL,
  resolveAppBaseUrl,
} from '../supabase/functions/_shared/transactionalEmailCore.js'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

loadEnvFiles()

const PREVIEW_SAMPLE = {
  base_url: 'https://equipd.co.uk',
  logo_url: DEFAULT_EMAIL_LOGO_URL,
  tagline: 'The UK marketplace for used gym equipment.',
  preheader: 'Preview of the Equipd transactional email master layout.',
  title: 'Your master email layout',
  subtitle: 'Clean, premium, and reusable across every Equipd notification.',
  body: `
    <p>This is where dynamic email content will appear. Keep copy concise, helpful, and action-oriented.</p>
    <p>Use short paragraphs, plain language, and only the details the recipient needs right now.</p>
    <p><strong>Design goals:</strong> modern, trustworthy, and consistent with the Equipd website.</p>
  `.trim(),
  cta_text: 'View example action',
  cta_url: 'https://equipd.co.uk/help',
  secondary_text: 'Need help? Visit the Help Centre',
  secondary_url: 'https://equipd.co.uk/help',
  year: String(new Date().getFullYear()),
}

function enrichPreviewData(data) {
  return {
    ...data,
    logo_url: DEFAULT_EMAIL_LOGO_URL,
    year: String(new Date().getFullYear()),
  }
}

function withSendGridHeader(templateKey, html) {
  return `<!-- Equipd SendGrid template: ${templateKey} -->\n${html}`
}

async function main() {
  const previewMode = process.argv.includes('--preview')
  const { distDir, sendgridDir, masterPath, previewPath } = getDistPaths()

  await mkdir(distDir, { recursive: true })
  await mkdir(sendgridDir, { recursive: true })

  const masterRaw = await readMasterTemplate()
  await writeFile(masterPath, masterRaw, 'utf8')

  const previewHtml = renderMasterEmail(masterRaw, PREVIEW_SAMPLE, { forLocalPreview: true })
  await writeFile(previewPath, previewHtml, 'utf8')

  console.log(`Wrote ${path.relative(ROOT, masterPath)}`)
  console.log(`Wrote ${path.relative(ROOT, previewPath)}`)

  const baseUrl = resolveAppBaseUrl((key) => process.env[key] ?? '')

  for (const template of ALL_EMAIL_TEMPLATES) {
    const mockData = enrichPreviewData(template.buildPreviewData(baseUrl))
    const { htmlPath, plainPath } = getSendGridOutputPaths(template.key)
    const filledPreviewPath = path.join(distDir, `preview-${template.key}.html`)

    await writeFile(htmlPath, withSendGridHeader(template.key, masterRaw), 'utf8')
    await writeFile(
      filledPreviewPath,
      renderMasterEmail(masterRaw, mockData, { forLocalPreview: true }),
      'utf8',
    )
    await writeFile(plainPath, template.buildSendGridPlainText(), 'utf8')

    console.log(`Wrote ${path.relative(ROOT, htmlPath)}`)
    console.log(`Wrote ${path.relative(ROOT, filledPreviewPath)}`)
    console.log(`Wrote ${path.relative(ROOT, plainPath)}`)
  }

  console.log('\nSendGrid HTML import files:')
  for (const template of ALL_EMAIL_TEMPLATES) {
    const { htmlPath, plainPath } = getSendGridOutputPaths(template.key)
    console.log(`  ${path.relative(ROOT, htmlPath)}`)
    console.log(`  ${path.relative(ROOT, plainPath)}`)
  }

  if (previewMode) {
    console.log('\nOpen emails/dist/preview-<templateKey>.html in a browser.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
