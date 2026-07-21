/**
 * Download self-hosted woff2 fonts.
 * Inter + Caveat arrive as variable fonts from Google (one file covers all weights).
 * Libre Baskerville remains static per-weight.
 * Run: node scripts/download-self-hosted-fonts.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const outDir = join(process.cwd(), 'public', 'fonts')
if (existsSync(outDir)) rmSync(outDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-')
}

async function fetchCss(query) {
  const url = `https://fonts.googleapis.com/css2?${query}&display=swap`
  const res = await fetch(url, { headers: { 'User-Agent': ua } })
  if (!res.ok) throw new Error(`Failed CSS ${url}: ${res.status}`)
  return res.text()
}

function parseFaces(css, familyName) {
  const faces = []
  const blocks = css.split(/@font-face\s*\{/).slice(1)
  for (const block of blocks) {
    const body = block.split('}')[0]
    const family = body.match(/font-family:\s*['"]?([^;'"]+)/)?.[1]?.trim()
    if (family !== familyName) continue
    const weightRaw = body.match(/font-weight:\s*([^;]+)/)?.[1]?.trim()
    const style = body.match(/font-style:\s*(\w+)/)?.[1] || 'normal'
    const src = body.match(/url\(([^)]+\.woff2)\)/)?.[1]?.replace(/['"]/g, '')
    const unicodeRange = body.match(/unicode-range:\s*([^;]+)/)?.[1]?.trim()
    if (!src || !weightRaw || !unicodeRange) continue
    const keep =
      unicodeRange.includes('U+0000-00FF') ||
      unicodeRange.includes('U+0100-02BA') ||
      unicodeRange.includes('U+0100-024F')
    if (!keep) continue
    const subset = unicodeRange.includes('U+0000-00FF') ? 'latin' : 'latin-ext'
    faces.push({ family, weight: weightRaw, style, src, unicodeRange, subset })
  }
  return faces
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function hash(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 12)
}

/** Deduplicate by content hash; emit one file per unique bytes. */
async function collectFamily(cssName, query, weightRangeHint) {
  const css = await fetchCss(query)
  const faces = parseFaces(css, cssName)
  console.log(`${cssName}: parsed ${faces.length} latin faces`)

  const byKey = new Map() // subset -> { buf, unicodeRange, weights: Set }
  for (const face of faces) {
    const buf = await download(face.src)
    const key = `${face.subset}:${hash(buf)}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        subset: face.subset,
        buf,
        unicodeRange: face.unicodeRange,
        weights: new Set([face.weight]),
        style: face.style,
      })
    } else {
      byKey.get(key).weights.add(face.weight)
    }
  }

  const results = []
  for (const entry of byKey.values()) {
    const file = `${slugify(cssName)}-${entry.subset}.woff2`
    const dest = join(outDir, file)
    writeFileSync(dest, entry.buf)
    console.log(`  ${file} (${entry.buf.length} bytes) weights=[${[...entry.weights].join(',')}]`)
    // Variable font: use continuous range. Static: declare exact weight(s).
    const isVariable = entry.weights.size > 1 || [...entry.weights][0].includes(' ')
    let weightDecl = weightRangeHint
    if (!isVariable) {
      weightDecl = [...entry.weights][0]
    }
    results.push({
      family: cssName,
      weight: weightDecl,
      style: entry.style,
      unicodeRange: entry.unicodeRange,
      file: `/fonts/${file}`,
      subset: entry.subset,
    })
  }
  return results
}

const allFaces = [
  ...(await collectFamily('Inter', 'family=Inter:wght@400;500;600;700;800', '400 800')),
  ...(await collectFamily('Caveat', 'family=Caveat:wght@500;600;700', '500 700')),
  ...(await collectFamily('Libre Baskerville', 'family=Libre+Baskerville:wght@700', '700')),
]

const cssOut = [
  '/* Self-hosted marketplace fonts — font-display: swap, latin + latin-ext subsets */',
  '/* Inter and Caveat are variable fonts (one file covers the declared weight range). */',
  '',
]

for (const face of allFaces) {
  cssOut.push(`@font-face {
  font-family: '${face.family}';
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url('${face.file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}
`)
}

writeFileSync(join(process.cwd(), 'src', 'styles', 'fonts.css'), cssOut.join('\n'))
console.log(`Wrote src/styles/fonts.css with ${allFaces.length} @font-face rules`)
console.log(JSON.stringify(allFaces, null, 2))
