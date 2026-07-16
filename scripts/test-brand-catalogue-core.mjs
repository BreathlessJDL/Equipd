/**
 * Brand catalogue core unit checks.
 */
import {
  buildBrandDirectoryFromProducts,
  formatPublicCanonicalProductDisplayName,
  getBrandLogoMeta,
  getBrandPagePath,
  getBrandSlug,
  isPublicBrandCatalogueProduct,
  listBrandLogoAssetPaths,
  normalizePublicSeriesDisplayLabel,
  resolveBrandRegistryEntry,
  slugifyBrandName,
} from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(slugifyBrandName('Life Fitness') === 'life-fitness', 'Life Fitness slug')
assert(slugifyBrandName('Matrix Fitness') === 'matrix-fitness', 'Matrix Fitness slug')
assert(slugifyBrandName('Concept2') === 'concept2', 'Concept2 slug')
assert(getBrandSlug('Matrix') === 'matrix-fitness', 'Matrix alias slug')
assert(getBrandPagePath('Life Fitness') === '/brands/life-fitness', 'Life Fitness path')
assert(resolveBrandRegistryEntry('matrix')?.displayName === 'Matrix Fitness', 'Matrix registry')
assert(resolveBrandRegistryEntry('life-fitness')?.logoPath === '/brand-logos/life-fitness.png', 'LF logo path')
assert(resolveBrandRegistryEntry('life-fitness')?.logoScale === 1.47, 'LF logo scale')
assert(resolveBrandRegistryEntry('wattbike')?.logoScale > 1.5, 'Wattbike enlarged')
assert(getBrandLogoMeta('Life Fitness')?.logoAlt === 'Life Fitness logo', 'LF logo alt')
assert(getBrandLogoMeta('Life Fitness')?.logoBackground == null, 'LF logo has no plate background')
assert(listBrandLogoAssetPaths().length === 25, 'featured logo asset list')
assert(listBrandLogoAssetPaths().every((entry) => entry.logoPath.startsWith('/brand-logos/') && entry.logoPath.endsWith('.png')), 'logo paths are transparent PNGs under brand-logos')
assert(resolveBrandRegistryEntry('Peloton')?.logoPath === '/brand-logos/peloton.png', 'Peloton logo path')
assert(resolveBrandRegistryEntry('NordicTrack')?.logoPath === '/brand-logos/nordictrack.png', 'NordicTrack logo path')
assert(resolveBrandRegistryEntry('Bowflex')?.logoPath === '/brand-logos/bowflex.png', 'BowFlex logo path')
assert(resolveBrandRegistryEntry('Horizon Fitness')?.logoPath === '/brand-logos/horizon-fitness.png', 'Horizon Fitness logo path')
assert(resolveBrandRegistryEntry('Sole Fitness')?.logoPath === '/brand-logos/sole-fitness.png', 'Sole Fitness logo path')
assert(resolveBrandRegistryEntry('Spirit')?.slug === 'spirit-fitness', 'Spirit alias slug')
assert(getBrandLogoMeta('Peloton')?.logoBackground == null, 'Peloton logo has no plate background')
assert(getBrandLogoMeta('NordicTrack')?.logoBackground == null, 'NordicTrack logo has no plate background')
assert(getBrandLogoMeta('BowFlex')?.logoBackground == null, 'BowFlex logo has no plate background')
assert(getBrandSlug('Nordic Track') === 'nordictrack', 'NordicTrack alias slug')
assert(getBrandSlug('Bow Flex') === 'bowflex', 'BowFlex alias slug')
assert(getBrandSlug('Water Rower') === 'waterrower', 'WaterRower alias slug')
assert(getBrandSlug('Stair Master') === 'stairmaster', 'StairMaster alias slug')
assert(normalizePublicSeriesDisplayLabel('Precor', 'Discovery Series') === 'Discovery', 'Precor Discovery Series display')
assert(normalizePublicSeriesDisplayLabel('Precor', 'Discovery - Dbr') === 'Discovery', 'Precor Discovery - Dbr series chip')
assert(
  formatPublicCanonicalProductDisplayName({
    brand: 'Precor',
    canonical_product_name: 'Precor Discovery Series Chest Press',
  }) === 'Precor Discovery Chest Press',
  'Precor Discovery display title',
)
assert(
  formatPublicCanonicalProductDisplayName({
    brand: 'Precor',
    canonical_product_name: 'Precor Discovery - Dbr Chest Press',
  }) === 'Precor Discovery Dbr Chest Press',
  'Precor Discovery hyphen display',
)

const products = [
  { brand: 'Life Fitness', status: 'approved', equipment_type: 'Treadmill', canonical_product_name: 'LF Treadmill', canonical_product_key: 'lf-1' },
  { brand: 'Life Fitness', status: 'approved', equipment_type: 'Console', canonical_product_name: 'LF Console', canonical_product_key: 'lf-console' },
  { brand: 'Matrix', status: 'approved', equipment_type: 'Elliptical', canonical_product_name: 'Matrix Elliptical', canonical_product_key: 'mx-1' },
  { brand: 'Other', status: 'approved', equipment_type: 'Bench', canonical_product_name: 'Other Bench', canonical_product_key: 'other-1' },
  { brand: 'Life Fitness', status: 'pending', equipment_type: 'Bike', canonical_product_name: 'LF Bike', canonical_product_key: 'lf-pending' },
]

assert(isPublicBrandCatalogueProduct(products[0]), 'approved treadmill public')
assert(!isPublicBrandCatalogueProduct(products[1]), 'console excluded')
assert(!isPublicBrandCatalogueProduct(products[3]), 'Other brand excluded')
assert(!isPublicBrandCatalogueProduct(products[4]), 'pending excluded')

const directory = buildBrandDirectoryFromProducts(products)
assert(directory.brands.length === 2, 'two public brands')
assert(directory.brands.find((brand) => brand.slug === 'life-fitness')?.productCount === 1, 'LF count excludes console')
assert(directory.brands.find((brand) => brand.slug === 'matrix-fitness')?.productCount === 1, 'Matrix merged')
assert(directory.brands.find((brand) => brand.slug === 'life-fitness')?.logoPath === '/brand-logos/life-fitness.png', 'directory logo')

console.log('brand-catalogue-core tests passed')
