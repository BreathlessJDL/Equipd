import {
  auditEquipmentProductType,
  auditEquipmentProductTypes,
  equipmentTypesEquivalent,
  inferEquipmentTypeFromProduct,
} from '../src/lib/equipmentTypeAudit.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const chestPress = {
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Pro 1 Chest Press',
  product_family: 'Pro 1',
  model: 'Chest Press',
  equipment_type: 'Chest Press',
}

const chestInference = inferEquipmentTypeFromProduct(chestPress)
assert(chestInference?.equipmentType === 'Strength', 'chest press suggests Strength')
assert(auditEquipmentProductType(chestPress).hasDifference, 'granular chest press type is flagged')

const treadmill = {
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness 95T Treadmill',
  product_family: '95T',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
}
assert(!auditEquipmentProductType(treadmill).hasDifference, 'matching treadmill is not flagged')

const recumbent = {
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Recumbent Bike',
  product_family: null,
  model: 'Recumbent Bike',
  equipment_type: 'Recumbent Bike',
}
assert(inferEquipmentTypeFromProduct(recumbent)?.equipmentType === 'Recumbent Bike', 'recumbent suggests recumbent bike')
assert(!auditEquipmentProductType(recumbent).hasDifference, 'matching recumbent bike is not flagged')

const bike = {
  brand: 'Technogym',
  canonical_product_name: 'Technogym Bike Excite',
  product_family: 'Excite',
  model: 'Bike',
  equipment_type: 'Exercise Bike',
}
const bikeAudit = auditEquipmentProductType(bike)
assert(bikeAudit.suggestedType === 'Upright Bike', 'bike keyword suggests upright bike')
assert(!bikeAudit.hasDifference, 'exercise bike alias matches upright bike')

const crossTrainer = {
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Cross Trainer',
  product_family: null,
  model: 'Cross Trainer',
  equipment_type: 'Crosstrainers',
}
assert(!auditEquipmentProductType(crossTrainer).hasDifference, 'crosstrainers alias matches cross trainer')

const report = auditEquipmentProductTypes([chestPress, treadmill, recumbent, bike, crossTrainer])
assert(report.summary.productsChecked === 5, 'report checks all products')
assert(report.summary.differences === 1, 'report counts differences only')

assert(equipmentTypesEquivalent('Selectorised Strength', 'Strength'), 'selectorised strength aliases to strength')

console.log('equipment type audit tests passed')
