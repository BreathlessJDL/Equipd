import {
  buildTechnogymModelVariantAudit,
  parseTechnogymModel,
} from '../src/lib/technogymModelVariantAudit.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const bike1000p = parseTechnogymModel({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'BIKE EXCITE 1000 P LED',
  equipment_type: 'Bike',
})
assert(bike1000p.machineType === 'BIKE', 'machine type BIKE')
assert(bike1000p.modelSuffix === '1000 P', 'suffix 1000 P')
assert(bike1000p.consoleTokens.includes('LED'), 'console LED')

const recline700unity = parseTechnogymModel({
  brand: 'Technogym',
  series: 'EXCITE + NEW RECLINE',
  model: 'NEW RECLINE EXCITE 700 UNITY',
  equipment_type: 'Recumbent Bike',
})
assert(recline700unity.machineType === 'NEW RECLINE', 'machine type NEW RECLINE')
assert(/700/.test(recline700unity.modelSuffix), 'suffix contains 700')

const audit = buildTechnogymModelVariantAudit([
  { id: '1', series: 'Excite 2016', model: 'BIKE EXCITE 1000 P LED', equipment_type: 'Bike' },
  { id: '2', series: 'Excite 2016', model: 'BIKE EXCITE 1000 P TV', equipment_type: 'Bike' },
  { id: '3', series: 'Excite 2016', model: 'BIKE EXCITE 1000 P UNITY', equipment_type: 'Bike' },
  { id: '4', series: 'Excite 2016', model: 'BIKE EXCITE 1000 SP LED', equipment_type: 'Bike' },
  { id: '5', series: 'Excite 2016', model: 'BIKE EXCITE 700 VISIO', equipment_type: 'Bike' },
  { id: '6', series: 'Excite 2016', model: 'BIKE EXCITE 700 UNITY', equipment_type: 'Bike' },
])

assert(audit.summary.total_rows === 6, 'audit row count')
assert(audit.groups.length >= 1, 'at least one group')
assert(audit.recommendations.possible_hardware_suffixes.length >= 1, 'hardware suffix evidence')

console.log('technogym model variant audit tests passed')
