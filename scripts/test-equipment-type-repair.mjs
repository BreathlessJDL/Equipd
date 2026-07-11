import {
  proposeEquipmentTypeRepair,
  auditEquipmentTypeRepairs,
} from '../src/lib/equipmentTypeRepair.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const precorAbdominal = {
  brand: 'Precor',
  canonical_product_name: 'Precor Icarian Abdominal Crunch',
  model: 'Abdominal Crunch',
  equipment_type: 'Treadmill',
}

const matrixAbdominal = {
  brand: 'Matrix Fitness',
  canonical_product_name: 'Matrix Fitness G3 Strength (aura) Abdominal Crunch',
  model: 'Abdominal Crunch',
  equipment_type: 'Treadmill',
}

const precorRepair = proposeEquipmentTypeRepair(precorAbdominal)
assert(precorRepair.proposedType === 'Abdominal Machine', 'Precor abdominal crunch repairs to abdominal machine')
assert(precorRepair.willUpdate, 'Precor abdominal crunch is high confidence')

const matrixRepair = proposeEquipmentTypeRepair(matrixAbdominal)
assert(matrixRepair.proposedType === 'Abdominal Machine', 'Matrix abdominal crunch repairs to abdominal machine')
assert(matrixRepair.willUpdate, 'Matrix abdominal crunch is high confidence')

const recumbentRepair = proposeEquipmentTypeRepair({
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Discover Recumbent Bike',
  model: 'Recumbent Bike',
  equipment_type: 'Exercise Bike',
})
assert(recumbentRepair.proposedType === 'Recumbent Bike', 'recumbent product repairs from exercise bike')
assert(recumbentRepair.willUpdate, 'recumbent repair is high confidence')

const chestPress = proposeEquipmentTypeRepair({
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Insignia Chest Press',
  model: 'Chest Press',
  equipment_type: 'Chest Press',
})
assert(!chestPress.proposedType, 'chest press stays chest press')

const legPress = proposeEquipmentTypeRepair({
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Insignia Leg Press',
  model: 'Leg Press',
  equipment_type: 'Leg Press',
})
assert(!legPress.proposedType, 'leg press stays leg press')

const backExtension = proposeEquipmentTypeRepair({
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Insignia Back Extension',
  model: 'Back Extension',
  equipment_type: 'Back Extension',
})
assert(!backExtension.proposedType, 'back extension stays back extension')

const seatedRowRepair = proposeEquipmentTypeRepair({
  brand: 'Precor',
  canonical_product_name: 'Precor Seated Row',
  model: 'Seated Row',
  equipment_type: 'Treadmill',
})
assert(seatedRowRepair.proposedType === 'Row Machine', 'seated row treadmill repairs to row machine')

const climberRepair = proposeEquipmentTypeRepair({
  brand: 'Precor',
  canonical_product_name: 'Precor Climber',
  model: 'Climber',
  equipment_type: 'Stepper/Stair Climber',
})
assert(climberRepair.proposedType === 'Climber', 'climber repairs from stepper/stair climber')
assert(climberRepair.willUpdate, 'climber repair is high confidence')

const report = auditEquipmentTypeRepairs([
  precorAbdominal,
  matrixAbdominal,
  chestPress,
  legPress,
  backExtension,
])
assert(report.summary.highConfidenceUpdates === 2, 'audit counts only high-confidence updates')

console.log('equipment type repair tests passed')
