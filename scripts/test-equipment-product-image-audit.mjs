/**
 * Equipment product image audit workflow tests.
 */

import {
  assessEquipmentProductImageRisk,
  buildEquipmentProductImageAuditReport,
  IMAGE_AUDIT_RISK,
  listProductsForImageCleanup,
  serializeEquipmentProductImageAuditCsv,
} from '../src/lib/equipmentProductImageAudit.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const products = [
  {
    id: '1',
    brand: 'Technogym',
    canonical_product_name: 'Technogym Artis Bike',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: 'https://www.technogym.com/images/artis.jpg',
    image_source_url: 'https://www.technogym.com/product/artis',
    image_source_domain: 'technogym.com',
    image_confidence: 90,
  },
  {
    id: '2',
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Treadmill',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    image_url: 'https://www.equip4gyms.com/media/treadmill.jpg',
    image_source_url: 'https://www.equip4gyms.com/product/treadmill/',
    image_source_domain: 'equip4gyms.com',
    image_confidence: 70,
  },
  {
    id: '3',
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Bike',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    image_url: 'https://www.fitshop.co.uk/images/bike.jpg',
    image_source_url: 'https://www.fitshop.co.uk/bike',
    image_source_domain: 'fitshop.co.uk',
    image_confidence: 65,
  },
]

const report = buildEquipmentProductImageAuditReport(products)
assert(report.summary.blocked === 1, 'audit report counts blocked image')
assert(report.summary.review >= 1, 'audit report counts review images')
assert(report.summary.safe === 1, 'audit report counts safe manufacturer image')
assert(report.byDomain.some((row) => row.domain === 'equip4gyms.com' && row.blocked === 1), 'domain summary includes blocked domain')

const blockedOnly = buildEquipmentProductImageAuditReport(products, { risk: IMAGE_AUDIT_RISK.BLOCKED })
assert(blockedOnly.rows.length === 1, 'risk filter returns blocked rows only')
assert(blockedOnly.rows[0].productId === '2', 'blocked row matches Equip4Gyms product')

const cleanupTargets = listProductsForImageCleanup(products, { risk: IMAGE_AUDIT_RISK.BLOCKED })
assert(cleanupTargets.length === 1, 'cleanup targets blocked products with images')

const csv = serializeEquipmentProductImageAuditCsv(report.rows)
assert(csv.includes('productId,canonicalProductName,brand'), 'csv header exported')
assert(csv.includes('equip4gyms.com'), 'csv includes blocked domain row')

console.log('equipment product image audit tests passed')
