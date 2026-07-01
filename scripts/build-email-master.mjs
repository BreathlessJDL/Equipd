#!/usr/bin/env node
/**
 * Compose Equipd master email layout from partial components.
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
  readMasterTemplate,
  renderMasterEmail,
} from '../emails/renderMasterEmail.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PREVIEW_SAMPLE = {
  base_url: 'https://equipd.co.uk',
  logo_url: 'https://equipd.co.uk/email/equipd-full-logo.png',
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

async function main() {
  const previewMode = process.argv.includes('--preview')
  const { distDir, masterPath, previewPath } = getDistPaths()

  await mkdir(distDir, { recursive: true })

  const masterRaw = await readMasterTemplate()
  await writeFile(masterPath, masterRaw, 'utf8')

  const previewHtml = renderMasterEmail(masterRaw, PREVIEW_SAMPLE, { forLocalPreview: true })
  await writeFile(previewPath, previewHtml, 'utf8')

  console.log(`Wrote ${path.relative(ROOT, masterPath)}`)
  console.log(`Wrote ${path.relative(ROOT, previewPath)}`)

  if (previewMode) {
    console.log('\nOpen emails/dist/master-preview.html in a browser to review.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
