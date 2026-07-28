/**
 * Local unit checks for wanted-request catalogue selection validation.
 */

import assert from 'node:assert/strict'
import {
  isWantedRequestCatalogueSelectionValid,
  toWantedRequestProductSummary,
  validateWantedRequestForm,
} from '../src/lib/wantedRequestTypes.js'

const catalogProduct = {
  id: '6f8ab2da-ea69-49d2-93b9-83f04a3c4cad',
  brand: 'BH Fitness',
  model: 'Artic',
  equipment_type: 'Exercise Bike',
  canonical_product_name: 'BH Fitness Artic',
  canonical_product_key: 'bh-fitness-exercise-bike-artic-artic',
}

const summary = toWantedRequestProductSummary(catalogProduct, {
  productName: 'BH Fitness Artic',
})

assert.ok(summary)
assert.equal(summary.productId, catalogProduct.id)
assert.equal(summary.canonicalProductKey, catalogProduct.canonical_product_key)
assert.equal(isWantedRequestCatalogueSelectionValid(summary), true)
assert.equal(
  isWantedRequestCatalogueSelectionValid({ productName: 'Typed only' }),
  false,
)

const typedOnly = validateWantedRequestForm(
  {
    entryMode: 'catalogue',
    product: null,
    equipmentQuery: 'BH Fitness Artic',
    manualBrand: '',
    manualModelName: '',
    manualEquipmentType: '',
    location: 'Leeds',
    radius: 'nationwide',
    maximumBudget: '',
    conditionPreference: 'any',
    notes: '',
    email: 'buyer@example.com',
    saveAsAlert: true,
  },
  { requireEmail: true, source: 'homepage' },
)
assert.equal(typedOnly.ok, false)
assert.equal(
  typedOnly.errors.equipment,
  'Select equipment from the catalogue, or enter it manually.',
)

const selected = validateWantedRequestForm(
  {
    entryMode: 'catalogue',
    product: summary,
    equipmentQuery: summary.productName,
    manualBrand: '',
    manualModelName: '',
    manualEquipmentType: '',
    location: 'Leeds',
    radius: '25',
    maximumBudget: '4000',
    conditionPreference: 'used_good',
    notes: '',
    email: 'buyer@example.com',
    saveAsAlert: true,
  },
  { requireEmail: true, source: 'homepage' },
)
assert.equal(selected.ok, true)
assert.equal(selected.payload.productId, catalogProduct.id)
assert.equal(selected.payload.productName, 'BH Fitness Artic')

const manualOnly = validateWantedRequestForm(
  {
    entryMode: 'manual',
    product: null,
    equipmentQuery: '',
    manualBrand: 'TechnoGym',
    manualModelName: 'Run Artis',
    manualEquipmentType: 'Treadmill',
    location: '',
    radius: 'nationwide',
    maximumBudget: '',
    conditionPreference: 'any',
    notes: '',
    email: 'buyer@example.com',
    saveAsAlert: false,
  },
  { requireEmail: true, source: 'homepage' },
)
assert.equal(manualOnly.ok, true)
assert.equal(manualOnly.payload.entryMode, 'manual')

console.log('test-wanted-request-catalogue-selection: ok')
