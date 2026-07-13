/**
 * Focused tests for equipment-guide FAQPage JSON-LD.
 */

import {
  FAQ_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  absoluteFaqCanonicalUrl,
  buildFaqPageSchema,
  buildFaqPageSchemaNode,
  excludeFaqPageSchemas,
  findFaqPageSchemas,
  normalizeFaqItems,
  renderFaqPageScriptTag,
  syncFaqPageSchemaInDocument,
} from '../src/lib/faqPageStructuredData.js'
import { normalizeEquipmentProductFaqEntries } from '../src/lib/equipmentProductContentPage.js'
import { buildEquipmentPageSeoDocument } from '../src/lib/seoCataloguePrerender.js'
import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertWwwOnly(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  assert(text.includes('https://www.equipd.co.uk'), `${label}: missing www`)
  assert(!/https:\/\/equipd\.co\.uk\//.test(text.replaceAll('https://www.equipd.co.uk', '')), `${label}: non-www`)
  assert(!text.includes('localhost'), `${label}: localhost`)
  assert(!text.includes('.vercel.app'), `${label}: preview`)
}

const visibleFaqs = [
  {
    question: 'When was the Life Fitness Integrity Series Treadmill manufactured from?',
    answer: 'Equipd records a manufacture start year of 2017.',
  },
  {
    question: 'What affects the used value of this treadmill?',
    answer: "Model, year, condition and console configuration are the main factors.",
  },
]

// A. Schema shape
const built = buildFaqPageSchema(visibleFaqs, {
  canonicalUrl: 'https://www.equipd.co.uk/equipment/life-fitness-integrity-series-treadmill',
})
assert(built.schema['@type'] === 'FAQPage', 'type')
assert(
  built.schema['@id'] === 'https://www.equipd.co.uk/equipment/life-fitness-integrity-series-treadmill#faq',
  '@id',
)
assert(Array.isArray(built.schema.mainEntity) && built.schema.mainEntity.length === 2, 'mainEntity')
built.schema.mainEntity.forEach((question, index) => {
  assert(question['@type'] === 'Question', `question type ${index}`)
  assert(Boolean(question.name), `question name ${index}`)
  assert(question.acceptedAnswer?.['@type'] === 'Answer', `answer type ${index}`)
  assert(Boolean(question.acceptedAnswer?.text), `answer text ${index}`)
})
assertWwwOnly(built.schema, 'cardio schema')

// B. Content consistency with visible FAQ source
const visibleNormalized = normalizeEquipmentProductFaqEntries(visibleFaqs)
assert(built.items.length === visibleNormalized.length, 'same count as visible')
built.items.forEach((item, index) => {
  assert(item.question === visibleNormalized[index].question, `Q match ${index}`)
  assert(item.answer === visibleNormalized[index].answer, `A match ${index}`)
})
assert(built.schema.mainEntity[0].name === visibleFaqs[0].question, 'order preserved')
assert(built.schema.mainEntity[1].name === visibleFaqs[1].question, 'order preserved 2')

// C. Normalisation / quality guards
const messy = normalizeFaqItems([
  { question: '  Hello & welcome?  ', answer: '  Apostrophe\'s & Unicode — 中文  ' },
  { question: '', answer: 'empty q' },
  { question: 'empty a', answer: '' },
  { question: 'Same', answer: 'same' },
  { question: 'Only link?', answer: 'https://example.com/path' },
  { question: 'Placeholder?', answer: 'TBD' },
  { question: 'Dup question?', answer: 'First answer' },
  { question: 'dup question?', answer: 'Second answer' },
  { question: 'Safe HTML?', answer: '<p>Visible text</p><script>alert(1)</script>' },
])
assert(messy.items.some((i) => i.question === 'Hello & welcome?' && i.answer.includes('中文')), 'unicode/amp')
assert(messy.items.some((i) => i.question === 'Safe HTML?' && i.answer === 'Visible text'), 'strips unsafe html')
assert(!messy.items.some((i) => i.question === 'Dup question?' && i.answer === 'Second answer'), 'dedupes')
assert(messy.excluded.some((e) => e.reason === 'duplicate question'), 'reports duplicate')
assert(messy.excluded.some((e) => e.reason === 'question equals answer'), 'reports q=a')
assert(messy.excluded.some((e) => e.reason === 'url-only answer'), 'reports url-only')
assert(messy.excluded.some((e) => e.reason === 'placeholder answer'), 'reports placeholder')
assert(!buildFaqPageSchemaNode([]), 'empty -> null')
assert(!buildFaqPageSchemaNode([{ question: 'x', answer: 'x' }]), 'all invalid -> null')

assert(
  absoluteFaqCanonicalUrl('https://equipd.co.uk/equipment/foo?utm=1')
    === 'https://www.equipd.co.uk/equipment/foo',
  'force www strip query',
)

// Strength example
const strength = buildFaqPageSchemaNode([
  {
    question: 'Is the Technogym Pure Strength Chest Press plate loaded?',
    answer: 'Yes. Equipd classifies this as a plate-loaded strength machine.',
  },
], { canonicalUrl: `${EQUIPD_SITE_ORIGIN}/equipment/technogym-pure-strength-chest-press` })
assert(strength.mainEntity[0].name.includes('Chest Press'), 'strength question')
assertWwwOnly(strength, 'strength schema')

// D. Eligibility via prerender document builder
const approvedProduct = {
  id: 'p1',
  brand: 'Life Fitness',
  status: 'approved',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Treadmill',
  canonical_product_key: 'life-fitness-integrity-treadmill',
  original_base_price: 9000,
  original_base_price_currency: 'GBP',
  production_start_year: 2015,
  production_end_year: 2020,
}

const withFaqs = buildEquipmentPageSeoDocument({
  product: approvedProduct,
  content: {
    overview_text: 'A commercial treadmill overview.',
    seo_title: 'Integrity Treadmill SEO Title',
    seo_meta_description: 'Integrity meta description.',
    faq_json: visibleFaqs,
    generation_status: 'approved',
  },
  hasConsoleOptions: true,
})
assert(findFaqPageSchemas(withFaqs.jsonLd).length === 1, 'eligible page has one FAQPage')
assert(withFaqs.bodyHtml.includes('Common questions'), 'prerender body includes FAQ section')
assert(withFaqs.bodyHtml.includes(visibleFaqs[0].question), 'prerender body includes question')
assert(withFaqs.bodyHtml.includes(visibleFaqs[0].answer), 'prerender body includes answer')

const noFaqs = buildEquipmentPageSeoDocument({
  product: approvedProduct,
  content: {
    overview_text: 'Overview only.',
    faq_json: [],
    generation_status: 'approved',
  },
})
assert(findFaqPageSchemas(noFaqs.jsonLd).length === 0, 'no FAQ page without faqs')
assert(!noFaqs.bodyHtml.includes('Common questions'), 'no FAQ section without faqs')

const draftProduct = {
  ...approvedProduct,
  status: 'draft',
  canonical_product_key: 'life-fitness-draft-treadmill',
}
const draftDoc = buildEquipmentPageSeoDocument({
  product: draftProduct,
  content: {
    overview_text: 'Draft overview',
    faq_json: visibleFaqs,
    generation_status: 'approved',
  },
})
assert(findFaqPageSchemas(draftDoc.jsonLd).length === 0, 'non-indexable product has no FAQPage')

// Marker / duplication helpers
const tag = renderFaqPageScriptTag(built.schema)
assert(tag.includes(`${SITE_SCHEMA_ATTR}="${FAQ_SCHEMA_KEY}"`), 'marker')
assert(excludeFaqPageSchemas([built.schema, { '@type': 'Product' }]).length === 1, 'exclude')

class FakeScript {
  constructor(head) {
    this.head = head
    this.type = ''
    this.attrs = {}
    this.text = ''
    this.textContent = ''
  }
  setAttribute(key, value) { this.attrs[key] = value }
  remove() { this.head.nodes = this.head.nodes.filter((node) => node !== this) }
}

class FakeHead {
  constructor() { this.nodes = [] }
  querySelectorAll(selector) {
    if (selector === 'script') return [...this.nodes]
    if (!selector.includes(FAQ_SCHEMA_KEY)) return []
    return this.nodes.filter((node) => node.attrs[SITE_SCHEMA_ATTR] === FAQ_SCHEMA_KEY)
  }
  appendChild(node) { this.nodes.push(node); return node }
}

class FakeDoc {
  constructor() { this.head = new FakeHead() }
  createElement() { return new FakeScript(this.head) }
}

const doc = new FakeDoc()
syncFaqPageSchemaInDocument(doc, built.schema)
syncFaqPageSchemaInDocument(doc, built.schema)
assert(doc.head.querySelectorAll('script').length === 1, 'idempotent')
syncFaqPageSchemaInDocument(doc, strength)
assert(JSON.parse(doc.head.nodes[0].text)['@id'] === strength['@id'], 'replaces on navigation')
syncFaqPageSchemaInDocument(doc, null)
assert(doc.head.querySelectorAll('script').length === 0, 'clears on ineligible page')

console.log('faq page structured data tests passed', {
  excludedSampleCount: messy.excluded.length,
})
