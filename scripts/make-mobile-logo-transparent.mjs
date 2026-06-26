import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const SOURCE = path.resolve(
  'public/design-reference/Equipd logo mobile header logged in.png',
)
const OUTPUT = path.resolve('public/header-icons/equipd-logo-mobile-header.png')

function isOrangePixel(r, g, b) {
  // Brand orange in the source asset (tolerant of anti-aliased edges).
  return r > 150 && g > 70 && g < 220 && b < 150 && r > g && r > b
}

const input = fs.readFileSync(SOURCE)
const png = PNG.sync.read(input)

for (let i = 0; i < png.data.length; i += 4) {
  const r = png.data[i]
  const g = png.data[i + 1]
  const b = png.data[i + 2]

  png.data[i + 3] = isOrangePixel(r, g, b) ? 255 : 0
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, PNG.sync.write(png))

let opaque = 0
for (let i = 3; i < png.data.length; i += 4) {
  if (png.data[i] > 0) opaque += 1
}

console.log(`Wrote transparent logo to ${OUTPUT} (${opaque} opaque pixels)`)
