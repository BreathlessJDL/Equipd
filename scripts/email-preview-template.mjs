#!/usr/bin/env node
/**
 * Preview a future transactional email locally using mock dynamic data.
 *
 * Usage:
 *   node scripts/email-preview-template.mjs master_test
 *   npm run email:preview:template -- offer_received
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listEmailTemplateKeys } from '../emails/templateConfig.js'
import { getPreviewMockData } from '../emails/preview/mockData.js'
import { writeTemplatePreview } from '../emails/renderMasterEmail.js'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

loadEnvFiles()

const templateKey = process.argv[2]

if (!templateKey) {
  console.error('Usage: node scripts/email-preview-template.mjs <templateKey>')
  console.error(`Available keys: ${listEmailTemplateKeys().join(', ')}`)
  process.exit(1)
}

const mockData = getPreviewMockData(templateKey)
if (!mockData) {
  console.error(`Unknown template key: ${templateKey}`)
  console.error(`Available keys: ${listEmailTemplateKeys().join(', ')}`)
  process.exit(1)
}

const outputPath = await writeTemplatePreview(templateKey, mockData)
console.log(`Wrote ${path.relative(ROOT, outputPath)}`)
console.log('Open the file in a browser to preview the approved master layout.')
