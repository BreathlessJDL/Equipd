#!/usr/bin/env node
/**
 * Homepage social preview is buyer-focused and does not replace other OG cards.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { buildHomePageOpenGraph, HOME_SOCIAL_DESCRIPTION, HOME_SOCIAL_IMAGE, HOME_SOCIAL_TITLE } from '../src/lib/homePageSeo.js'
import { buildBuyUsedGymEquipmentSeoDocument } from '../src/lib/buyUsedGymEquipmentPage.js'
import { buildBrowsePageOpenGraph } from '../src/lib/browsePageSeo.js'
import { buildSellGymEquipmentSeoDocument } from '../src/lib/sellGymEquipmentPage.js'
import { buildValuationSeoDocument } from '../src/lib/valuationPageSeo.js'
import { buildSellerShopPageSeo } from '../src/lib/sellerShopSeo.js'
import { buildBrandsIndexSeoDocument } from '../src/lib/seoCataloguePrerender.js'
import { EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH } from '../src/lib/socialPreview.js'
import { DEFAULT_PAGE_TITLE } from '../src/lib/pageTitles.js'

const homeOg = buildHomePageOpenGraph()
assert.equal(homeOg['og:title'], HOME_SOCIAL_TITLE)
assert.equal(homeOg['og:description'], HOME_SOCIAL_DESCRIPTION)
assert.equal(homeOg['og:url'], 'https://www.equipd.co.uk/')
assert.equal(homeOg['og:image'], `https://www.equipd.co.uk${HOME_SOCIAL_IMAGE.src}`)
assert.equal(homeOg['og:image:width'], '1200')
assert.equal(homeOg['og:image:height'], '630')
assert.equal(homeOg['twitter:card'], 'summary_large_image')
assert.equal(homeOg['twitter:title'], HOME_SOCIAL_TITLE)
assert.equal(homeOg['twitter:description'], HOME_SOCIAL_DESCRIPTION)
assert.equal(homeOg['twitter:image'], homeOg['og:image'])
assert.notEqual(homeOg['og:title'], DEFAULT_PAGE_TITLE, 'social title is shorter than the HTML title')
assert.ok(!homeOg['og:image'].includes('sell-gym-equipment-og.png'))

const imagePath = join(process.cwd(), 'public', HOME_SOCIAL_IMAGE.src.replace(/^\//, ''))
assert.equal(existsSync(imagePath), true, 'homepage OG image exists in public/')
const metadata = await sharp(imagePath).metadata()
assert.equal(metadata.width, 1200)
assert.equal(metadata.height, 630)

const indexHtml = readFileSync('index.html', 'utf8')
assert.match(indexHtml, /property="og:title" content="Buy &amp; Sell Used Gym Equipment"/)
assert.match(indexHtml, /property="og:description"[\s\S]*content="Home &amp; Commercial Equipment Across the UK"/)
assert.match(indexHtml, /homepage\/equipd-homepage-og\.png/)
assert.match(indexHtml, /property="og:image:width" content="1200"/)
assert.match(indexHtml, /property="og:image:height" content="630"/)
assert.doesNotMatch(indexHtml, /sell-gym-equipment\/sell-gym-equipment-og\.png/)

const buyDoc = buildBuyUsedGymEquipmentSeoDocument({ listings: [] })
assert.ok(buyDoc.openGraph['og:image'].includes('buy-used-gym-equipment-og.png'))
assert.notEqual(buyDoc.openGraph['og:image'], homeOg['og:image'])

const browseOg = buildBrowsePageOpenGraph()
assert.ok(browseOg['og:image'].includes('buy-used-gym-equipment-og.png'))

const sellDoc = buildSellGymEquipmentSeoDocument()
assert.ok(sellDoc.openGraph['og:image'].includes('sell-gym-equipment-og.png'))
assert.equal(EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH, '/homepage/equipd-homepage-og.png')
assert.notEqual(sellDoc.openGraph['og:image'], homeOg['og:image'])

const valuationDoc = buildValuationSeoDocument()
assert.ok(valuationDoc.openGraph['og:image'].includes('homepage/equipd-homepage-og.png'))

const brandsDoc = buildBrandsIndexSeoDocument({ brands: [] })
assert.ok(brandsDoc.openGraph['og:image'].includes('homepage/equipd-homepage-og.png'))

const shopSeo = buildSellerShopPageSeo({ username: 'fitclearance' }, { listingCount: 0 })
assert.ok(shopSeo.openGraph['og:image'].includes('homepage/equipd-homepage-og.png'))

const homePageSource = readFileSync('src/pages/HomePage.jsx', 'utf8')
assert.match(homePageSource, /buildHomePageOpenGraph\(\)/)

console.log('PASS: homepage social preview metadata')
