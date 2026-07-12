import {
  extractEmbeddedStatePriceText,
  extractPageContent,
  fetchCandidatePage,
  isFinancePriceContext,
  isNavigationBoilerplateDominated,
  PAGE_FETCH_BOT_USER_AGENT,
  PAGE_FETCH_BROWSER_USER_AGENT,
  preparePageContentForAi,
} from './intelligencePageExtract.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const navigationBoilerplate = [
  'Fitness Superstore - UK SCORE LIMITED-TIME DISCOUNTS ON CARDIO AND STRENGTH EQUIPMENT',
  'Skip to Content',
  'Menu Menu Fitness Equipment Treadmills Folding Treadmills Non-Folding Treadmills',
  'Commercial Treadmills Exercise Bikes Upright Exercise Bikes Recumbent Exercise Bikes',
  'Cross Trainers Elliptical Cross Trainers Max Trainers Commercial Elliptical Trainers',
  'Ex-Display Clearance Treadmills & Running Machines (Unboxed)',
  'Shop By Brand Ex-Display Clearance',
].join(' ').repeat(22)

const fitnessSuperstoreHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Life Fitness 95TI Commercial Treadmill</title>
  <meta name="description" content="Life Fitness 95TI" />
</head>
<body>
  <nav>${navigationBoilerplate}</nav>
  <main>
    <h1>Life Fitness 95TI Commercial Treadmill</h1>
    <p>Code: LFTR95TI 1 / FREE Delivery FREE Installation List Price £7,544 Our Price £6,550.01 Spread the cost of your new equipment.</p>
    <p>Manufactured from 2004 and discontinued in 2012.</p>
  </main>
</body>
</html>`

const extracted = extractPageContent(fitnessSuperstoreHtml)
assert(extracted.combinedText.includes('7,544'), 'full extracted page should contain £7,544')
assert(extracted.combinedText.includes('List Price'), 'full extracted page should contain List Price')

const prepared = preparePageContentForAi(extracted)
assert(prepared.includes('7,544'), 'prepared OpenAI page content should contain £7,544')
assert(prepared.includes('List Price'), 'prepared OpenAI page content should contain List Price')
assert(!isNavigationBoilerplateDominated(prepared), 'prepared content should not be dominated by navigation boilerplate')

const hugeNavPrefix = navigationBoilerplate.repeat(3)
const naiveTruncation = `${hugeNavPrefix} ${'padding '.repeat(500)}`
assert(!naiveTruncation.slice(0, 4000).includes('7,544'), 'fixture should place price beyond naive 4000-char truncation')
assert(extracted.bodyText.length < 2_000, 'keyword body extraction should stay compact')

const technogymHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Technogym Skillmill: Curved treadmill for hiit training</title>
  <meta name="description" content="Boost your speed, power and endurance with Technogym Skillmill." />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Skillmill",
    "offers": {
      "@type": "Offer",
      "price": 11800,
      "priceCurrency": "GBP"
    }
  }
  </script>
  <script>
    window.__PRELOADED_STATE__ = {"product":{"price":11800,"finance":{"monthlyPrice":159.38,"label":"per month"}}};
  </script>
</head>
<body>
  <main>
    <h1>Technogym Skillmill</h1>
    <p>View delivery details £11,800 / £159.38 per month Inclusive of delivery and installation.</p>
    <p>Financing spread the cost of your purchase over time.</p>
  </main>
</body>
</html>`

const technogymExtracted = extractPageContent(technogymHtml)
assert(technogymExtracted.jsonLdText.includes('11800'), 'Technogym JSON-LD should include 11800')
assert(technogymExtracted.jsonLdText.includes('GBP'), 'Technogym JSON-LD should include GBP')
assert(extractEmbeddedStatePriceText(technogymHtml).includes('11800'), 'embedded state should include list price 11800')

const technogymPrepared = preparePageContentForAi(technogymExtracted)
assert(
  technogymPrepared.includes('11,800') || technogymPrepared.includes('11800'),
  'Technogym prepared content should include £11,800 / 11800 GBP',
)
assert(
  !/Price evidence:[^\\n]*159\\.38/i.test(technogymPrepared),
  'Technogym prepared content should not treat £159.38/month as price evidence',
)

const financeSample = 'Select Version £11,800 / £159.38 per month financing available'
const financeIndex = financeSample.indexOf('£159.38')
assert(
  isFinancePriceContext(financeSample, financeIndex, '£159.38'.length),
  'finance monthly price should be detected as finance context',
)
const listIndex = financeSample.indexOf('£11,800')
assert(
  !isFinancePriceContext(financeSample, listIndex, '£11,800'.length),
  'list cash price should not be treated as finance context',
)

if (Deno.env.get('RUN_LIVE_PAGE_FETCH_TESTS') === '1') {
  const technogymUrl = 'https://www.technogym.com/en-GB/product/skillmill_DJK0.html'

  const botResponse = await fetch(technogymUrl, {
    headers: { 'User-Agent': PAGE_FETCH_BOT_USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  })
  assert(botResponse.status === 403, 'Technogym bot UA should return 403')

  const browserResponse = await fetch(technogymUrl, {
    headers: { 'User-Agent': PAGE_FETCH_BROWSER_USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  })
  assert(browserResponse.status === 200, 'Technogym browser UA should return 200')

  const fetched = await fetchCandidatePage(technogymUrl)
  assert(fetched.ok, `fetchCandidatePage should succeed after 403 retry: ${fetched.error ?? ''}`)
  assert(fetched.content != null, 'fetchCandidatePage should return extracted content')

  const livePrepared = preparePageContentForAi(fetched.content!)
  assert(
    livePrepared.includes('11,800') || livePrepared.includes('11800'),
    'live Technogym prepared content should include £11,800 / 11800 GBP',
  )
  assert(
    !/Price evidence:[^\\n]*159\\.38/i.test(livePrepared),
    'live Technogym prepared content should not choose £159.38/month as price evidence',
  )
}

console.log('intelligencePageExtract tests passed')
