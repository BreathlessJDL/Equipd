#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const page = readFileSync(join(root, 'src/pages/BrandPage.jsx'), 'utf8')
const css = readFileSync(join(root, 'src/pages/BrandPage.css'), 'utf8')
const modelCard = readFileSync(join(root, 'src/components/BrandModelCard.jsx'), 'utf8')
const valueCard = readFileSync(join(root, 'src/components/BrandValueResearchCard.jsx'), 'utf8')

assert.match(page, /brand-page__rail--models/)
assert.match(page, /brand-page__rail--values/)
assert.match(page, /filteredValueResearchProducts/)
assert.match(page, /valuesSearch/)
assert.match(page, /No matching \$\{brand\.displayName\} models found/)
assert.match(page, /variant="rail"/)
assert.match(page, /Search \$\{brand\.displayName\} models/)

assert.match(css, /\.brand-page__rail\s*\{/)
assert.match(css, /overflow-x:\s*auto/)
assert.match(css, /scroll-snap-type:\s*x mandatory/)
assert.match(css, /brand-page__values-search/)

assert.match(modelCard, /variant === 'rail'|variant = 'rail'|isRail/)
assert.match(valueCard, /brand-value-research-card--rail|isRail/)

console.log('test-brand-page-explore-values-rails: ok')
