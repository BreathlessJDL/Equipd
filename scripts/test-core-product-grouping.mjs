/**
 * Tests for core product / variant grouping.
 */

import {
  buildCoreProductAuditReport,
  buildCoreProductGroupApprovalPayload,
  buildCoreProductGroupExplanation,
  buildCoreProductGroups,
  buildCoreProductKeyFromFields,
  buildCoreProductName,
  buildPossibleRelatedClusters,
  CORE_PRODUCT_GROUP_STATUS,
  deriveCoreProductFields,
  expandCoreProductResearchTargets,
  GROUPING_CONFIDENCE,
  isApprovableCoreProductGroup,
  isResearchDedupeEligibleGroup,
  slugifyCoreProductKey,
  stripConsoleVariantFromModel,
} from '../src/lib/intelligenceCoreProductGrouping.js'
import { buildCoreProductResearchQueue } from '../src/lib/equipmentResearchQueue.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const powermillSt = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: null,
  model: 'PowerMill ST console',
  equipment_type: 'Stepper',
})
assert(
  powermillSt.core_product_name === 'Life Fitness PowerMill',
  'PowerMill ST console should group under Life Fitness PowerMill',
)
assert(powermillSt.variant_name === 'ST Console', 'PowerMill ST console variant label')
assert(powermillSt.core_product_group_confidence === GROUPING_CONFIDENCE.HIGH, 'model console variant should be high confidence')

const powermillSe3 = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: null,
  model: 'PowerMill SE3',
  equipment_type: 'Stepper',
})
const powermillSe3hd = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: null,
  model: 'PowerMill SE3HD',
  equipment_type: 'Stepper',
})

assert(
  powermillSt.core_product_key === powermillSe3.core_product_key,
  'PowerMill ST and SE3 should share core product key when family matches',
)
assert(
  powermillSe3.core_product_key === powermillSe3hd.core_product_key,
  'PowerMill SE3 and SE3HD should share core product key',
)

const discoverVariant = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti Discover SE',
  equipment_type: 'Treadmill',
})
const unityVariant = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti Unity',
  equipment_type: 'Treadmill',
})
const ledVariant = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti LED',
  equipment_type: 'Treadmill',
})

assert(
  discoverVariant.core_product_name === 'Life Fitness Integrity 95Ti',
  'Discover SE console variant should strip to Integrity 95Ti core',
)
assert(discoverVariant.variant_name === 'Discover SE', 'Discover SE variant label')
assert(
  discoverVariant.core_product_key === unityVariant.core_product_key,
  'Unity and Discover variants of Integrity 95Ti should share core product key',
)
assert(
  discoverVariant.core_product_key === ledVariant.core_product_key,
  'LED console term should not be treated as a separate core model',
)

const model95Ti = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti',
  equipment_type: 'Treadmill',
})
const model95Te = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Te',
  equipment_type: 'Treadmill',
})
assert(
  model95Ti.core_product_key !== model95Te.core_product_key,
  '95Ti and 95Te must not be grouped as the same core product',
)

const stripped = stripConsoleVariantFromModel('PowerMill ST console')
assert(stripped.coreModel === 'PowerMill', 'stripConsoleVariantFromModel should leave PowerMill')

const powermillBare = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: null,
  model: 'PowerMill',
  equipment_type: 'Stepper',
})
const powermillIntegrity = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Integrity Series',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})
const powermillDiscoverSe3 = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE3 (2019>)',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})

assert(
  powermillBare.core_product_key !== powermillIntegrity.core_product_key,
  'bare PowerMill and Integrity Series PowerMill must not share a core product key',
)
assert(
  powermillBare.core_product_key !== powermillDiscoverSe3.core_product_key,
  'bare PowerMill and Discover SE3 PowerMill must not share a core product key',
)
assert(
  powermillIntegrity.core_product_key !== powermillDiscoverSe3.core_product_key,
  'Integrity Series PowerMill and Discover SE3 PowerMill must not share a core product key',
)
assert(
  powermillIntegrity.core_product_name === 'Life Fitness Integrity Series PowerMill',
  'Integrity Series should remain in core product name',
)
assert(
  powermillDiscoverSe3.core_product_name === 'Life Fitness Discover PowerMill',
  'Discover family should remain in core product name',
)
assert(powermillDiscoverSe3.variant_name === 'SE3', 'Discover SE3 series should map to SE3 variant')

const powermillDiscoverSe = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE (2015-19)',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})
const powermillDiscoverSt = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})

assert(
  powermillDiscoverSe.core_product_key === powermillDiscoverSe3.core_product_key,
  'Discover SE and SE3 PowerMill should share key within the same product family',
)
assert(
  powermillDiscoverSe.core_product_key === powermillDiscoverSt.core_product_key,
  'Discover ST and SE3 PowerMill should share key within the same product family',
)

const elevationAchieve = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Elevation - Achieve',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})
const elevationEngage = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Elevation - Engage',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})
const elevationInspire = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Elevation - Inspire',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})

assert(
  elevationAchieve.core_product_name === 'Life Fitness Elevation Crosstrainer',
  'Elevation - Achieve should canonicalize to Life Fitness Elevation Crosstrainer',
)
assert(elevationAchieve.variant_name === 'Achieve', 'Elevation - Achieve variant label')
assert(elevationAchieve.product_family === 'Elevation', 'Elevation family should not include console name')
assert(
  elevationAchieve.core_product_key === elevationEngage.core_product_key,
  'Elevation Achieve and Engage crosstrainers should share canonical key',
)
assert(
  elevationAchieve.core_product_key === elevationInspire.core_product_key,
  'Elevation Achieve and Inspire crosstrainers should share canonical key',
)
assert(elevationEngage.variant_name === 'Engage', 'Elevation - Engage variant label')
assert(elevationInspire.variant_name === 'Inspire', 'Elevation - Inspire variant label')

const elevationTreadmillAchieve = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Elevation - Achieve',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
})
assert(
  elevationTreadmillAchieve.core_product_name === 'Life Fitness Elevation Treadmill',
  'Elevation - Achieve treadmill should strip console from canonical name',
)
assert(
  elevationTreadmillAchieve.core_product_key !== elevationAchieve.core_product_key,
  'Elevation crosstrainer and treadmill should remain separate canonical products',
)

const discoverSeCrosstrainer = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE (2015-19)',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})
const discoverStCrosstrainer = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})
const discoverSe3Crosstrainer = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE3 (2019>)',
  model: 'Crosstrainer',
  equipment_type: 'Crosstrainer',
})

assert(
  discoverSeCrosstrainer.core_product_name === 'Life Fitness Discover Crosstrainer',
  'Discover SE crosstrainer canonical name should remain unchanged',
)
assert(discoverSeCrosstrainer.variant_name === 'SE', 'Discover SE variant label unchanged')
assert(
  discoverSeCrosstrainer.core_product_key === discoverStCrosstrainer.core_product_key,
  'Discover SE and ST crosstrainers should still share canonical key',
)
assert(
  discoverSeCrosstrainer.core_product_key === discoverSe3Crosstrainer.core_product_key,
  'Discover SE and SE3 crosstrainers should still share canonical key',
)

const powermillRows = [
  { id: 'pm-st', brand: 'Life Fitness', series: null, model: 'PowerMill ST console', equipment_type: 'Stepper' },
  { id: 'pm-se3', brand: 'Life Fitness', series: null, model: 'PowerMill SE3', equipment_type: 'Stepper' },
  { id: 'pm-se3hd', brand: 'Life Fitness', series: null, model: 'PowerMill SE3HD', equipment_type: 'Stepper' },
  { id: 'pm-base', brand: 'Life Fitness', series: null, model: 'PowerMill', equipment_type: 'Stepper' },
  { id: 'pm-integrity', brand: 'Life Fitness', series: 'Integrity Series', model: 'PowerMill', equipment_type: 'Stepper' },
  { id: 'pm-discover-se3', brand: 'Life Fitness', series: 'Discover SE3 (2019>)', model: 'PowerMill', equipment_type: 'Stepper' },
]

const groups = buildCoreProductGroups(powermillRows)
const consoleOnlyGroup = groups.find((group) => (
  group.core_product_key === powermillSt.core_product_key && group.grouping_tier === 'high'
))
assert(consoleOnlyGroup, 'console-only PowerMill variants should form one high-confidence group')
assert(consoleOnlyGroup.member_count >= 3, 'console-only PowerMill group should include variant rows')
assert(
  isResearchDedupeEligibleGroup(consoleOnlyGroup),
  'high-confidence console-only group should be research dedupe eligible',
)

const explanation = buildCoreProductGroupExplanation(consoleOnlyGroup)
assert(
  /console descriptor/i.test(explanation) && /SE3HD|ST Console|SE3/.test(explanation),
  'group explanation should mention console descriptor differences',
)

const related = buildPossibleRelatedClusters(powermillRows)
const powermillRelated = related.find((cluster) => /powermill/i.test(cluster.core_model))
assert(powermillRelated, 'PowerMill families should appear as a possible related cluster')
assert(
  powermillRelated.distinct_core_products >= 3,
  'PowerMill related cluster should list separate family candidates',
)

const relatedTargets = expandCoreProductResearchTargets(groups)
const dedupedConsoleTargets = relatedTargets.filter(
  (target) => target.dedupeEligible && target.group.core_product_key === consoleOnlyGroup.core_product_key,
)
assert(dedupedConsoleTargets.length === 1, 'expand targets should dedupe console-only group once')

const audit = buildCoreProductAuditReport(powermillRows, { incompleteRowFilter: () => true })
assert(audit.possible_related_cluster_count >= 1, 'audit should surface possible related clusters')

const coreQueue = buildCoreProductResearchQueue(powermillRows, { targetCount: 10, skipCompleted: false })
assert(
  coreQueue.queue.filter((entry) => entry.coreProductKey === consoleOnlyGroup.core_product_key).length === 1,
  'research queue should research console-only PowerMill group once',
)
assert(
  coreQueue.queue.filter((entry) => entry.dedupeEligible).length >= 1,
  'research queue should mark dedupe-eligible entries',
)
assert(
  coreQueue.queue.length >= 3,
  'research queue should keep separate family lines as separate research targets',
)

const dedupeEligibleKeys = new Set(
  coreQueue.queue.filter((entry) => entry.dedupeEligible).map((entry) => entry.coreProductKey),
)
assert(dedupeEligibleKeys.size === 1, 'only one dedupe-eligible core product group in powermill fixture')

const nonDedupedPowermillTargets = coreQueue.queue.filter(
  (entry) => !entry.dedupeEligible && /powermill/i.test(entry.label),
)
assert(
  nonDedupedPowermillTargets.length >= 2,
  'possible related cluster family lines should remain separate research targets',
)

const notDuplicateRows = powermillRows.map((row) => ({
  ...row,
  core_product_group_status: row.id.startsWith('pm-st') || row.id.startsWith('pm-se3')
    ? CORE_PRODUCT_GROUP_STATUS.NOT_DUPLICATE
    : row.core_product_group_status,
}))
const notDupGroups = buildCoreProductGroups(notDuplicateRows)
const notDupConsoleGroup = notDupGroups.find((group) => group.core_product_key === powermillSt.core_product_key)
assert(
  !isResearchDedupeEligibleGroup(notDupConsoleGroup),
  'not_duplicate status should block automatic research deduping',
)

assert(
  slugifyCoreProductKey('Life Fitness', 'Stepper', 'Integrity Series', 'PowerMill')
    === 'life-fitness-stepper-integrity-series-powermill',
  'core product key should include meaningful series/family terms',
)

const technogymUnity = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite',
  model: 'Run 1000 Unity',
  equipment_type: 'Treadmill',
})
const technogymLive22 = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite',
  model: 'Run 1000 Live 22',
  equipment_type: 'Treadmill',
})
assert(
  technogymUnity.core_product_key === technogymLive22.core_product_key,
  'Technogym Unity and Live 22 console variants should share core product key',
)
assert(technogymUnity.variant_name === 'Unity', 'Technogym Unity variant label')
assert(technogymLive22.variant_name === 'Live 22', 'Technogym Live 22 variant label')

const matrixXr = deriveCoreProductFields({
  brand: 'Matrix',
  series: 'Performance',
  model: 'T7x XR',
  equipment_type: 'Treadmill',
})
const matrixXur = deriveCoreProductFields({
  brand: 'Matrix',
  series: 'Performance',
  model: 'T7x XUR',
  equipment_type: 'Treadmill',
})
assert(
  matrixXr.core_product_key === matrixXur.core_product_key,
  'Matrix XR and XUR console variants should share core product key',
)

const precorP82 = deriveCoreProductFields({
  brand: 'Precor',
  series: null,
  model: 'TRM 885 P82',
  equipment_type: 'Treadmill',
})
const precorP31 = deriveCoreProductFields({
  brand: 'Precor',
  series: null,
  model: 'TRM 885 P31',
  equipment_type: 'Treadmill',
})
assert(
  precorP82.core_product_key === precorP31.core_product_key,
  'Precor P31 and P82 console variants should share core product key',
)

const cybexE3 = deriveCoreProductFields({
  brand: 'Cybex',
  series: 'VR3',
  model: 'Treadmill E3 View',
  equipment_type: 'Treadmill',
})
const cybexBase = deriveCoreProductFields({
  brand: 'Cybex',
  series: 'VR3',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
})
assert(
  cybexE3.core_product_key === cybexBase.core_product_key,
  'Cybex E3 View console variant should share core product key with base model',
)

const starTracLed = deriveCoreProductFields({
  brand: 'Star Trac',
  series: null,
  model: 'TRX 3500 LED',
  equipment_type: 'Treadmill',
})
const starTracTouch = deriveCoreProductFields({
  brand: 'Star Trac',
  series: null,
  model: 'TRX 3500 10 inch touchscreen',
  equipment_type: 'Treadmill',
})
assert(
  starTracLed.core_product_key === starTracTouch.core_product_key,
  'Star Trac LED and touchscreen variants should share core product key',
)

const discoverSe4 = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE4',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})
assert(discoverSe4.variant_name === 'SE4', 'Discover SE4 series should map to SE4 console variant')

const technogym1000p = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'BIKE EXCITE 1000 P LED',
  equipment_type: 'Bike',
})
const technogym1000sp = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'BIKE EXCITE 1000 SP LED',
  equipment_type: 'Bike',
})
const technogym1000ce = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'BIKE EXCITE 1000 CE UNITY',
  equipment_type: 'Bike',
})
assert(
  technogym1000p.core_product_key === technogym1000sp.core_product_key,
  'Technogym 1000 P and 1000 SP should share core product key',
)
assert(
  technogym1000p.core_product_key === technogym1000ce.core_product_key,
  'Technogym 1000 CE should share core product key with 1000 base tier',
)
assert(technogym1000p.variant_name?.includes('P'), 'Technogym 1000 P should keep P variant')
assert(technogym1000sp.variant_name?.includes('SP'), 'Technogym 1000 SP should keep SP variant')

const technogym700unity = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite',
  model: 'SYNCHRO 700 UNITY',
  equipment_type: 'Cross Trainer',
})
const technogym700visio = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite',
  model: 'SYNCHRO 700 VISIO',
  equipment_type: 'Cross Trainer',
})
const technogym1000pSynchro = deriveCoreProductFields({
  brand: 'Technogym',
  series: 'Excite 2016',
  model: 'SYNCHRO EXCITE 1000 P UNITY',
  equipment_type: 'Cross Trainer',
})
assert(
  technogym700unity.core_product_key === technogym700visio.core_product_key,
  'Technogym 700 Unity and 700 Visio should share core product key',
)
assert(
  technogym700unity.core_product_key !== technogym1000pSynchro.core_product_key,
  'Technogym Synchro 700 and 1000 must remain separate hardware tiers',
)

assert(isApprovableCoreProductGroup(consoleOnlyGroup), 'pending high-confidence group should be approvable')
const approvalPayload = buildCoreProductGroupApprovalPayload(consoleOnlyGroup)
assert(approvalPayload.coreProductKey === consoleOnlyGroup.core_product_key, 'approval payload should keep core product key')
assert(approvalPayload.members.length === consoleOnlyGroup.member_count, 'approval payload should include all members')
assert(
  approvalPayload.members.every((member) => member.coreProductKey === consoleOnlyGroup.core_product_key),
  'approval payload members should share core product key',
)

const approvedGroup = {
  ...consoleOnlyGroup,
  group_status: CORE_PRODUCT_GROUP_STATUS.APPROVED,
}
assert(!isApprovableCoreProductGroup(approvedGroup), 'approved groups should not be approvable again')

// --- Plus-sign identity + redundant family naming ---
assert(slugifyCoreProductKey('Bike') === 'bike', 'Bike slug remains bike')
assert(slugifyCoreProductKey('Bike+') === 'bike-plus', 'Bike+ slug becomes bike-plus')
assert(
  slugifyCoreProductKey('Bike') !== slugifyCoreProductKey('Bike+'),
  'Bike and Bike+ must produce different slug keys',
)
assert(slugifyCoreProductKey('SE3HD+') === 'se3hd-plus', 'SE3HD+ slug becomes se3hd-plus')
assert(slugifyCoreProductKey('Console + TV') === 'console-plus-tv', 'Console + TV slug becomes console-plus-tv')
assert(
  slugifyCoreProductKey('Life Fitness', 'Stepper', 'Integrity Series', 'PowerMill')
    === 'life-fitness-stepper-integrity-series-powermill',
  'ordinary commercial keys without + remain unchanged',
)

const pelotonBike = deriveCoreProductFields({
  brand: 'Peloton',
  series: 'Bike',
  model: 'Bike',
  equipment_type: 'Indoor Bike',
})
const pelotonBikePlus = deriveCoreProductFields({
  brand: 'Peloton',
  series: 'Bike+',
  model: 'Bike+',
  equipment_type: 'Indoor Bike',
})
assert(pelotonBike.core_product_name === 'Peloton Bike', 'Peloton Bike display name')
assert(pelotonBikePlus.core_product_name === 'Peloton Bike+', 'Peloton Bike+ display name')
assert(
  pelotonBike.core_product_key !== pelotonBikePlus.core_product_key,
  'Peloton Bike and Bike+ must produce different canonical keys',
)
assert(
  pelotonBikePlus.core_product_key.includes('plus'),
  'Peloton Bike+ canonical key should contain plus',
)

assert(
  buildCoreProductName('NordicTrack', 'Commercial', 'Commercial 1750') === 'NordicTrack Commercial 1750',
  'redundant Commercial family prefix suppressed',
)
assert(
  buildCoreProductName('BowFlex', 'Max Total', 'Max Total 16') === 'BowFlex Max Total 16',
  'redundant Max Total family prefix suppressed',
)
assert(
  buildCoreProductName('Peloton', 'Cross Training', 'Cross Training Bike') === 'Peloton Cross Training Bike',
  'redundant Cross Training family prefix suppressed',
)
assert(
  buildCoreProductName('BowFlex', 'Treadmill', 'Treadmill 22') === 'BowFlex Treadmill 22',
  'redundant Treadmill family prefix suppressed',
)
assert(
  buildCoreProductName('NordicTrack', 'T Series', 'T 6.5S') === 'NordicTrack T Series T 6.5S',
  'T Series must remain when model does not start with full family phrase',
)
assert(
  buildCoreProductName('BowFlex', 'Max Trainer', 'M6') === 'BowFlex Max Trainer M6',
  'Max Trainer M6 must keep family',
)
assert(
  buildCoreProductName('Peloton', 'Bike', 'Bike+') === 'Peloton Bike+',
  'family Bike + model Bike+ should name as Peloton Bike+ without repeating family',
)
assert(
  buildCoreProductName('Wattbike', 'Atom', 'Atom') === 'Wattbike Atom',
  'identical family/model still collapses once',
)
assert(
  buildCoreProductName('Life Fitness', 'Integrity Series', 'PowerMill') === 'Life Fitness Integrity Series PowerMill',
  'commercial Integrity Series PowerMill name unchanged',
)
assert(
  buildCoreProductName('Technogym', 'Excite', 'Run 700') === 'Technogym Excite Run 700',
  'Technogym family retained when model does not start with family',
)

console.log('core product grouping tests passed')
