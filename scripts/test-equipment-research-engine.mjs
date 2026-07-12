/**
 * Tests research_engine payload defaults for fast vs deep research.
 */

import {
  attachResearchEngineToBatchQueue,
  buildEquipmentResearchRequestBody,
  EQUIPMENT_RESEARCH_ENGINE,
  resolveClientResearchEngine,
} from '../src/lib/equipmentResearchEngine.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const equipmentId = 'eq-123'

const fastSingle = buildEquipmentResearchRequestBody(equipmentId, {
  researchEngine: EQUIPMENT_RESEARCH_ENGINE.FAST,
})
assert(fastSingle.research_engine === 'fast', 'single-product fast button sends research_engine: fast')

const deepSingle = buildEquipmentResearchRequestBody(equipmentId, {
  researchEngine: EQUIPMENT_RESEARCH_ENGINE.V3,
})
assert(deepSingle.research_engine === 'v3', 'deep research button sends research_engine: v3')

const missingEngine = buildEquipmentResearchRequestBody(equipmentId, {})
assert(missingEngine.research_engine === 'fast', 'missing researchEngine in client builder defaults to fast')

const batchQueue = attachResearchEngineToBatchQueue([
  { equipmentId: 'a', label: 'Product A' },
  { equipmentId: 'b', label: 'Product B' },
], EQUIPMENT_RESEARCH_ENGINE.FAST)

assert(batchQueue.length === 2, 'batch queue length preserved')
assert(
  batchQueue.every((entry) => entry.researchEngine === 'fast'),
  'Top 100 batch default sends research_engine: fast on every queued row',
)

const batchDeep = attachResearchEngineToBatchQueue(batchQueue, EQUIPMENT_RESEARCH_ENGINE.V3)
assert(
  batchDeep.every((entry) => entry.researchEngine === 'v3'),
  'batch deep selection stamps v3 on each row',
)

const top100FirstRequest = buildEquipmentResearchRequestBody(batchQueue[0].equipmentId, {
  researchEngine: batchQueue[0].researchEngine,
  researchTarget: { product_id: 'prod-1' },
})
assert(
  top100FirstRequest.research_engine === 'fast',
  'Top 100 first product request body uses fast engine from queue row',
)

assert(
  resolveClientResearchEngine(undefined, undefined) === 'fast',
  'client resolver defaults to fast when engine and mode missing',
)

console.log('equipment research engine payload tests passed')
