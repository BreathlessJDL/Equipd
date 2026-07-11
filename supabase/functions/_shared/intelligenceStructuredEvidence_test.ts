import {
  extractStructuredPriceEvidenceFromText,
  isFinanceOrMonthlyPriceContext,
  isV3MarketplaceDomain,
  isV3TrustedUkDealerDomain,
  scoreStructuredPriceEvidence,
  buildStructuredProductContext,
} from './intelligenceStructuredEvidence.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const lifeFitness95Ti = buildStructuredProductContext({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti',
  equipment_type: 'Treadmill',
})

assert(
  isFinanceOrMonthlyPriceContext('Finance from £159/month on selected models'),
  'should reject £159/month finance prices',
)

const trustedRrpText = `
Life Fitness Integrity 95Ti treadmill.
RRP £11,800 inc VAT.
Official list price for commercial customers.
`
const trustedItems = extractStructuredPriceEvidenceFromText(trustedRrpText, {
  sourceUrl: 'https://www.fitness-superstore.co.uk/life-fitness-95ti',
  sourceDomain: 'fitness-superstore.co.uk',
  sourceType: 'dealer_catalogue',
  brand: 'Life Fitness',
}, lifeFitness95Ti)

const trustedRrp = trustedItems.find((item) => item.label === 'RRP' && item.value === 11800)
assert(trustedRrp, 'should accept £11,800 RRP from trusted dealer')
assert(trustedRrp?.currency === 'GBP', 'GBP RRP should remain GBP')
assert(trustedRrp?.rejectionReason == null, 'eligible RRP should not be rejected')

const ebayText = 'Life Fitness 95Ti RRP £4,500 buy now on eBay'
const ebayItems = extractStructuredPriceEvidenceFromText(ebayText, {
  sourceUrl: 'https://www.ebay.co.uk/itm/123',
  sourceDomain: 'ebay.co.uk',
  sourceType: 'marketplace_resale',
  brand: 'Life Fitness',
}, lifeFitness95Ti)
assert(
  ebayItems.every((item) => item.rejectionReason === 'marketplace_not_rrp'),
  'marketplace prices must not be accepted as RRP',
)
assert(isV3MarketplaceDomain('ebay.co.uk'), 'ebay should be marketplace domain')

const manufacturerSpecText = 'Life Fitness 95Ti specifications and dimensions. No pricing on this page.'
const manufacturerItems = extractStructuredPriceEvidenceFromText(manufacturerSpecText, {
  sourceUrl: 'https://www.lifefitness.com/en-us/products/95ti',
  sourceDomain: 'lifefitness.com',
  sourceType: 'manufacturer_website',
  brand: 'Life Fitness',
}, lifeFitness95Ti)
assert(manufacturerItems.length === 0, 'manufacturer spec page without price should extract nothing')

const dealerRrp = trustedItems[0]
const manufacturerNoPriceScore = scoreStructuredPriceEvidence({
  ...dealerRrp,
  sourceDomain: 'lifefitness.com',
  sourceType: 'manufacturer_website',
  sourceScore: 2,
  label: 'RRP',
  value: 11800,
  isMarketplace: false,
}, lifeFitness95Ti)

const dealerScore = scoreStructuredPriceEvidence(dealerRrp, lifeFitness95Ti)
assert(
  dealerScore.score > manufacturerNoPriceScore.score,
  'trusted dealer explicit RRP should beat manufacturer page with weak source score',
)
assert(isV3TrustedUkDealerDomain('fitness-superstore.co.uk'), 'fitness superstore should be trusted')

const usdText = 'Life Fitness 95Ti MSRP $14,999 for US market'
const usdItems = extractStructuredPriceEvidenceFromText(usdText, {
  sourceUrl: 'https://www.lifefitness.com/us/products/95ti',
  sourceDomain: 'lifefitness.com',
  sourceType: 'manufacturer_website',
  brand: 'Life Fitness',
}, lifeFitness95Ti)
const usdItem = usdItems.find((item) => item.currency === 'USD')
assert(usdItem, 'USD MSRP should be detected as USD')
assert(usdItem?.currency === 'USD', 'USD price must remain USD and not be relabelled GBP')

console.log('structured evidence tests passed')
