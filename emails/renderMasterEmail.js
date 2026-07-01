import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EMAILS_DIR = __dirname
const DIST_DIR = path.join(EMAILS_DIR, 'dist')
const SENDGRID_DIR = path.join(EMAILS_DIR, 'sendgrid')

const COMPONENT_ORDER = ['header', 'hero', 'content', 'cta', 'footer']

export async function readMasterTemplate() {
  const [layoutHtml, ...componentFiles] = await Promise.all([
    readFile(path.join(EMAILS_DIR, 'layouts', 'master.html'), 'utf8'),
    ...COMPONENT_ORDER.map((name) =>
      readFile(path.join(EMAILS_DIR, 'components', `${name}.html`), 'utf8'),
    ),
  ])

  let html = layoutHtml
  COMPONENT_ORDER.forEach((name, index) => {
    html = html.replace(`<!-- COMPONENT:${name} -->`, componentFiles[index].trim())
  })

  return html
}

export function renderMasterEmail(html, data, { forLocalPreview = false } = {}) {
  let output = html

  output = output.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    const value = data[key]
    return value ? block : ''
  })

  for (const [key, value] of Object.entries(data)) {
    output = output.replaceAll(`{{{${key}}}}`, String(value))
    output = output.replaceAll(`{{${key}}}`, String(value))
  }

  return output
}

export function getDistPaths() {
  return {
    distDir: DIST_DIR,
    sendgridDir: SENDGRID_DIR,
    masterPath: path.join(DIST_DIR, 'master.html'),
    previewPath: path.join(DIST_DIR, 'master-preview.html'),
  }
}

export function getSendGridOutputPaths(templateKey) {
  return {
    htmlPath: path.join(SENDGRID_DIR, `${templateKey}.html`),
    plainPath: path.join(SENDGRID_DIR, `${templateKey}.txt`),
  }
}

export async function writeTemplatePreview(templateKey, data) {
  const html = await readMasterTemplate()
  const rendered = renderMasterEmail(html, data, { forLocalPreview: true })
  const outputPath = path.join(DIST_DIR, `preview-${templateKey}.html`)
  await import('node:fs/promises').then(({ mkdir, writeFile }) =>
    mkdir(DIST_DIR, { recursive: true }).then(() => writeFile(outputPath, rendered, 'utf8')),
  )
  return outputPath
}
