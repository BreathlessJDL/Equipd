/**
 * Cardio equipment detection tests.
 */

import { isCardioEquipmentProduct, isStrengthEquipmentProduct } from '../src/lib/equipmentCardio.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const treadmill = {
  brand: 'Life Fitness',
  equipment_type: 'Treadmill',
  model: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
}

const chestPress = {
  brand: 'Life Fitness',
  equipment_type: 'Chest Press',
  model: 'Chest Press',
  canonical_product_name: 'Life Fitness Insignia Chest Press',
}

const powermill = {
  brand: 'Life Fitness',
  equipment_type: null,
  model: 'PowerMill',
  canonical_product_name: 'Life Fitness Elevation Series PowerMill',
}

const technogymRun = {
  brand: 'Technogym',
  equipment_type: 'Treadmill',
  model: 'Run',
  canonical_product_name: 'Technogym Excite Run',
}

const matrixRower = {
  brand: 'Matrix Fitness',
  equipment_type: 'Rower',
  model: 'Rower',
  canonical_product_name: 'Matrix Fitness Rower',
}

assert(isCardioEquipmentProduct(treadmill), 'treadmill is cardio')
assert(isCardioEquipmentProduct(powermill), 'PowerMill without type is cardio')
assert(isCardioEquipmentProduct(technogymRun), 'Technogym treadmill is cardio')
assert(isCardioEquipmentProduct(matrixRower), 'rower is cardio')
assert(!isCardioEquipmentProduct(chestPress), 'chest press is not cardio')
assert(isStrengthEquipmentProduct(chestPress), 'chest press is strength')

console.log('equipment-cardio: all tests passed')
