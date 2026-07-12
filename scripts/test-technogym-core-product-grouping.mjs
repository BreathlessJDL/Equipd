import {
  buildTechnogymCanonicalProductName,
  parseTechnogymCanonicalIdentity,
  stripTechnogymNonPricingVariants,
} from '../src/lib/technogymCoreProductGrouping.js'
import { deriveCoreProductFields } from '../src/lib/intelligenceCoreProductGrouping.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const stripped = stripTechnogymNonPricingVariants('BIKE EXCITE 1000 P LED', { existingVariantName: 'LED' })
assert(stripped.coreModel === 'BIKE EXCITE 1000', 'strip P from 1000 P')
assert(stripped.variantName?.includes('P'), 'variant includes P')

const glued = stripTechnogymNonPricingVariants('RECLINE EXCITE 1000P UNITY')
assert(glued.coreModel === 'RECLINE EXCITE 1000', 'strip glued 1000P and Unity')

const legacy = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'STEP EXCITE 1000 P LED',
  equipment_type: 'Stepper',
}, { technogymGroupingEnabled: false })
const updated = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'STEP EXCITE 1000 P LED',
  equipment_type: 'Stepper',
}, { technogymGroupingEnabled: true })
assert(legacy.core_product_key !== updated.core_product_key, 'Technogym grouping should change canonical key')

const run700 = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'EXCITE + RUN',
  model: 'RUN EXCITE 700 VISIO WEB',
  equipment_type: 'Treadmill',
})
assert(run700.core_product_name === 'Technogym Excite Run 700', 'Excite Run 700 canonical name')
assert(run700.core_product_key.includes('run-excite-700'), 'grouping key unchanged')

const newBike700 = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'EXCITE + NEW BIKE',
  model: 'NEW BIKE EXCITE 700 SP',
  equipment_type: 'Bike',
})
assert(newBike700.core_product_name === 'Technogym Excite New Bike 700', 'Excite New Bike 700 canonical name')

const synchro700 = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'EXCITE + SYNCHRO',
  model: 'SYNCHRO EXCITE 700',
  equipment_type: 'Crosstrainer',
})
assert(synchro700.core_product_name === 'Technogym Excite Synchro 700', 'Excite Synchro 700 canonical name')

const console700 = parseTechnogymCanonicalIdentity({
  series: 'EXCITE + RUN',
  model: 'RUN EXCITE 700 UNITY',
})
assert(console700.machine === 'Run' && console700.hardwareTier === '700', 'parse machine and tier')

const named = buildTechnogymCanonicalProductName('Technogym', {
  series: 'EXCITE + CROSSOVER',
  model: 'CROSSOVER EXCITE 700',
})
assert(named === 'Technogym Excite Crossover 700', 'Excite Crossover 700 canonical name')

console.log('technogym core product grouping tests passed')
