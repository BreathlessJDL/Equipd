/**
 * Product image identity conflict tests.
 */

import {
  buildMatrixImageSearchQueries,
  scoreMatrixImageCandidate,
} from '../src/lib/matrixProductImageSearch.js'
import {
  compareProductIdentity,
  evaluateImageCandidateIdentity,
  extractProductImageIdentity,
  identityTokenPresent,
  queryRetainsRequiredIdentity,
} from '../src/lib/equipmentProductImageIdentity.js'
import { scoreImageSearchCandidate } from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const onyxAscent = {
  brand: 'Matrix Fitness',
  product_family: 'Onyx Collection',
  model: 'Onyx Ascent Trainer',
  canonical_product_name: 'Matrix Onyx Ascent Trainer',
  equipment_type: 'Ascent Trainer',
}

const a5xCandidate = {
  title: 'Matrix A5x Suspension Ascent Trainer',
  sourceUrl: 'https://www.fitnesssuperstore.com/products/matrix-a5x-suspension-ascent-trainer-black-display-remanufactured',
  imageUrl: 'https://cdn.example.com/matrix-a5x-suspension-ascent-trainer.jpg',
  width: 1500,
  height: 1736,
}

const onyxCandidate = {
  title: 'Matrix Onyx Ascent Trainer',
  sourceUrl: 'https://www.matrixfitness.com/eng/cardio/onyx/ascent-trainer',
  imageUrl: 'https://www.matrixfitness.com/images/onyx-ascent-trainer.jpg',
  width: 1200,
  height: 900,
}

// 1) Onyx vs A5x must reject
{
  const gate = evaluateImageCandidateIdentity(onyxAscent, a5xCandidate)
  assert(!gate.eligible, 'Onyx vs A5x should be ineligible')
  assert(gate.reason === 'conflicting_product_identity', 'Onyx vs A5x reason')
  const scored = scoreMatrixImageCandidate(a5xCandidate, onyxAscent)
  assert(scored.score === 0, 'Onyx vs A5x score must be 0')
  assert(scored.rejection?.reject, 'Onyx vs A5x must reject')
}

// 2) Exact Onyx match eligible
{
  const gate = evaluateImageCandidateIdentity(onyxAscent, onyxCandidate)
  assert(gate.eligible, 'Exact Onyx should be eligible')
  assert(gate.identityResult.evidenceLevel === 'exact' || gate.identityResult.exactIdentity, 'Exact Onyx evidence')
  const scored = scoreMatrixImageCandidate(onyxCandidate, onyxAscent)
  assert(scored.score > 0, 'Exact Onyx score > 0')
  assert(!scored.rejection?.reject, 'Exact Onyx not rejected')
}

// 3) Performance Plus vs Performance
{
  const plus = {
    brand: 'Matrix Fitness',
    product_family: 'Performance Plus',
    model: 'Performance Plus Treadmill',
    canonical_product_name: 'Matrix Performance Plus Treadmill',
    equipment_type: 'Treadmill',
  }
  const performanceCandidate = {
    title: 'Matrix Performance Treadmill',
    sourceUrl: 'https://example.com/matrix-performance-treadmill',
    imageUrl: 'https://example.com/performance.jpg',
  }
  const plusCandidate = {
    title: 'Matrix Performance Plus Treadmill',
    sourceUrl: 'https://example.com/matrix-performance-plus-treadmill',
    imageUrl: 'https://example.com/performance-plus.jpg',
  }
  assert(!evaluateImageCandidateIdentity(plus, performanceCandidate).eligible, 'Plus vs Performance reject')
  assert(!evaluateImageCandidateIdentity({
    brand: 'Matrix Fitness',
    product_family: 'Performance Series',
    model: 'Performance Treadmill',
    canonical_product_name: 'Matrix Performance Series Treadmill',
    equipment_type: 'Treadmill',
  }, plusCandidate).eligible, 'Performance vs Plus reject')
}

// 4) Endurance vs Performance ClimbMill
{
  const endurance = {
    brand: 'Matrix Fitness',
    product_family: 'Endurance Series',
    model: 'Endurance ClimbMill',
    canonical_product_name: 'Matrix Endurance Series ClimbMill',
    equipment_type: 'ClimbMill',
  }
  const performanceClimb = {
    title: 'Matrix Performance ClimbMill',
    sourceUrl: 'https://example.com/matrix-performance-climbmill',
    imageUrl: 'https://example.com/perf-climb.jpg',
  }
  assert(!evaluateImageCandidateIdentity(endurance, performanceClimb).eligible, 'Endurance vs Performance ClimbMill')
}

// 5) T7 vs T5
{
  const t7 = {
    brand: 'Matrix Fitness',
    product_family: 'T7',
    model: 'Treadmill',
    canonical_product_name: 'Matrix T7 Treadmill',
    equipment_type: 'Treadmill',
  }
  const t5Candidate = {
    title: 'Matrix T5 Treadmill',
    sourceUrl: 'https://example.com/matrix-t5-treadmill',
    imageUrl: 'https://example.com/t5.jpg',
  }
  assert(!evaluateImageCandidateIdentity(t7, t5Candidate).eligible, 'T7 vs T5 reject')
}

// 6) A7x vs A5x
{
  const a7x = {
    brand: 'Matrix Fitness',
    product_family: 'A7x',
    model: 'Ascent',
    canonical_product_name: 'Matrix A7x Ascent Trainer',
    equipment_type: 'Ascent Trainer',
  }
  const a5x = {
    title: 'Matrix A5x Ascent Trainer',
    sourceUrl: 'https://example.com/matrix-a5x-ascent-trainer',
    imageUrl: 'https://example.com/a5x.jpg',
  }
  assert(!evaluateImageCandidateIdentity(a7x, a5x).eligible, 'A7x vs A5x reject')
}

// 7) Onyx Recumbent vs R7xe
{
  const onyxRecumbent = {
    brand: 'Matrix Fitness',
    product_family: 'Onyx Collection',
    model: 'Onyx Recumbent Cycle',
    canonical_product_name: 'Matrix Onyx Recumbent Cycle',
    equipment_type: 'Recumbent Bike',
  }
  const r7xe = {
    title: 'Matrix R7xe Recumbent Cycle',
    sourceUrl: 'https://example.com/matrix-r7xe-recumbent',
    imageUrl: 'https://example.com/r7xe.jpg',
  }
  assert(!evaluateImageCandidateIdentity(onyxRecumbent, r7xe).eligible, 'Onyx vs R7xe reject')
}

// 8) Life Fitness Integrity vs Elevation
{
  const integrity = {
    brand: 'Life Fitness',
    product_family: 'Integrity Series',
    model: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Treadmill',
    equipment_type: 'Treadmill',
  }
  const elevation = {
    title: 'Life Fitness Elevation Treadmill',
    sourceUrl: 'https://example.com/life-fitness-elevation-treadmill',
    imageUrl: 'https://example.com/elevation.jpg',
  }
  assert(!evaluateImageCandidateIdentity(integrity, elevation).eligible, 'Integrity vs Elevation reject')
}

// 9) Technogym Excite vs Skillrun
{
  const excite = {
    brand: 'Technogym',
    product_family: 'Excite',
    model: 'Run 700',
    canonical_product_name: 'Technogym Excite Run',
    equipment_type: 'Treadmill',
  }
  const skillrun = {
    title: 'Technogym Skillrun',
    sourceUrl: 'https://www.technogym.com/gb/skillrun.html',
    imageUrl: 'https://www.technogym.com/skillrun.jpg',
  }
  assert(!evaluateImageCandidateIdentity(excite, skillrun).eligible, 'Excite vs Skillrun reject')
}

// Boundary / normalisation cases
assert(identityTokenPresent('matrix-a5x-suspension', 'A5x'), 'hyphenated A5x in URL')
assert(identityTokenPresent('MATRIX A5X ASCENT', 'a5x'), 'case insensitive A5x')
assert(!identityTokenPresent('Matrix A5x Ascent', 'A5'), 'A5 must not equal A5x')
assert(!identityTokenPresent('Matrix T50 Treadmill', 'T5'), 'T5 must not equal T50')
assert(identityTokenPresent('Matrix T5 Treadmill', 'T5'), 'exact T5')
assert(identityTokenPresent('performance-plus-treadmill', 'Performance Plus'), 'Performance Plus compact')

// Query retention
{
  const queries = buildMatrixImageSearchQueries(onyxAscent)
  assert(queries.length > 0, 'Onyx queries exist')
  assert(queries.every((query) => queryRetainsRequiredIdentity(query, onyxAscent)), 'All Onyx queries retain Onyx')
  assert(queries.every((query) => /onyx/i.test(query)), 'Onyx literal present')
  assert(!queries.some((query) => /^matrix ascent trainer$/i.test(query.trim())), 'No stripped Matrix Ascent Trainer query')
}

// Trusted domain cannot override conflict
{
  const manufacturerConflict = {
    title: 'Matrix A5x Ascent Trainer',
    sourceUrl: 'https://www.matrixfitness.com/a5x-ascent-trainer',
    imageUrl: 'https://www.matrixfitness.com/images/a5x.jpg',
    width: 2000,
    height: 2000,
  }
  const scored = scoreImageSearchCandidate(manufacturerConflict, onyxAscent)
  assert(scored.score === 0, 'Manufacturer domain cannot override A5x conflict')
  assert(scored.rejection?.reason === 'conflicting_product_identity', 'Conflict reason preserved')
}

// Precor Discovery must not accept Vitality / Resolute / Icarian
{
  const discovery = {
    brand: 'Precor',
    product_family: 'Discovery - Dbr',
    model: 'Chest Press',
    canonical_product_name: 'Precor Discovery - Dbr Chest Press',
    equipment_type: 'Chest Press',
  }
  for (const [label, title] of [
    ['vitality', 'Precor Vitality Chest Press'],
    ['resolute', 'Precor Resolute Chest Press'],
    ['icarian', 'Precor Icarian Chest Press'],
  ]) {
    const gate = evaluateImageCandidateIdentity(discovery, {
      title,
      sourceUrl: `https://example.com/precor-${label}-chest-press`,
      imageUrl: `https://example.com/${label}.jpg`,
    })
    assert(!gate.eligible, `Discovery vs ${label} should reject`)
    assert(gate.reason === 'conflicting_product_identity', `Discovery vs ${label} conflict reason`)
  }
  const exact = evaluateImageCandidateIdentity(discovery, {
    title: 'Precor Discovery Chest Press',
    sourceUrl: 'https://www.precor.com/discovery-chest-press',
    imageUrl: 'https://www.precor.com/discovery-chest-press.jpg',
  })
  assert(exact.eligible, 'Exact Discovery should be eligible')
}

// Precor Experience model codes must not cross-match (TRM811 ≠ TRM731)
{
  const trm811 = {
    brand: 'Precor',
    product_family: 'Experience',
    model: 'Precor TRM811',
    canonical_product_name: 'Precor Experience Precor TRM811',
    equipment_type: 'Treadmill',
  }
  const wrong = evaluateImageCandidateIdentity(trm811, {
    title: 'Precor TRM731 Treadmill',
    sourceUrl: 'https://www.precor.com/en-US/products/TRM731',
    imageUrl: 'https://cdn.example/trm731.jpg',
  })
  assert(!wrong.eligible, 'TRM811 vs TRM731 should reject')
  assert(wrong.reason === 'conflicting_product_identity', 'TRM811 vs TRM731 conflict reason')

  const exact = evaluateImageCandidateIdentity(trm811, {
    title: 'Precor TRM811 Treadmill',
    sourceUrl: 'https://www.precor.com/en-US/products/TRM811',
    imageUrl: 'https://cdn.example/trm811.jpg',
  })
  assert(exact.eligible, 'TRM811 exact should be eligible')
  assert(exact.identityResult.evidenceLevel === 'exact', 'TRM811 exact evidence')
  assert(
    exact.identityResult.matched.some((entry) => entry.type === 'model_code'),
    'TRM811 should match model code',
  )
}

// Pulse Classic must not accept Premium / Series 3
{
  const classic = {
    brand: 'Pulse Fitness',
    product_family: 'Classic',
    model: 'Chest Press',
    canonical_product_name: 'Pulse Fitness Classic Chest Press',
    equipment_type: 'Chest Press',
  }
  for (const [label, title] of [
    ['premium', 'Pulse Fitness Premium Chest Press'],
    ['series_3', 'Pulse Fitness Series 3 Chest Press'],
  ]) {
    const gate = evaluateImageCandidateIdentity(classic, {
      title,
      sourceUrl: `https://example.com/pulse-${label}`,
      imageUrl: `https://example.com/pulse-${label}.jpg`,
    })
    assert(!gate.eligible, `Pulse Classic vs ${label} should reject`)
  }
}

// Pulse H-range may accept official Classic / Club Line / Premium pages for the same station
{
  const hRange = {
    brand: 'Pulse Fitness',
    product_family: 'H-range Strength',
    model: 'Abdominal',
    canonical_product_name: 'Pulse Fitness H-range Strength Abdominal',
    equipment_type: 'Abdominal Machine',
  }
  const classic = evaluateImageCandidateIdentity(hRange, {
    title: 'Classic Abdominal',
    sourceUrl: 'https://pulsefitness.com/product/strength-selectorised-classic-abdominal-599h-aag/',
    imageUrl: 'https://pulsefitness.com/classic-ab.jpg',
  })
  assert(classic.eligible, 'H-range Abdominal vs Classic Abdominal should be eligible')
  assert(classic.identityResult.evidenceLevel === 'exact', 'H-range ↔ Classic should be exact')
  assert(
    !evaluateImageCandidateIdentity(hRange, {
      title: 'Classic Pec Deck',
      sourceUrl: 'https://pulsefitness.com/product/strength-selectorised-classic-pec-deck-599h-xxx/',
      imageUrl: 'https://pulsefitness.com/pec.jpg',
    }).eligible || evaluateImageCandidateIdentity(hRange, {
      title: 'Classic Pec Deck',
      sourceUrl: 'https://pulsefitness.com/product/strength-selectorised-classic-pec-deck-599h-xxx/',
      imageUrl: 'https://pulsefitness.com/pec.jpg',
    }).identityResult.evidenceLevel !== 'exact',
    'H-range Abdominal must not exact-match Pec Deck',
  )
}

// Pulse Fusion U-Cycle should match official U-Cycle 240G pages
{
  const ucycle = {
    brand: 'Pulse Fitness',
    product_family: '240g-3.5st',
    model: 'Fusion U-Cycle Series 1',
    canonical_product_name: 'Pulse Fitness 240g-3.5st Fusion U-Cycle Series 1',
    equipment_type: 'Exercise Bike',
  }
  const identity = extractProductImageIdentity(ucycle, { kind: 'product' })
  assert(identity.modelCodes.includes('240G'), '240G model code extracted')
  assert(!identity.pulseSeries.includes('g_range'), 'cardio 240G must not become G-range')
  const gate = evaluateImageCandidateIdentity(ucycle, {
    title: 'U-Cycle – Upright Cycle',
    sourceUrl: 'https://pulsefitness.com/product/u-cycle-upright-cycle-240g-aaj/',
    imageUrl: 'https://pulsefitness.com/240g.jpg',
  })
  assert(gate.eligible, 'Fusion U-Cycle vs official U-Cycle should be eligible')
  assert(gate.identityResult.evidenceLevel === 'exact', 'Fusion U-Cycle exact evidence')
}

// Pulse F-ST must not accept 220G pages
{
  const fst = {
    brand: 'Pulse Fitness',
    product_family: '220 F-st',
    model: "Pace' Stepper",
    canonical_product_name: "Pulse Fitness 220 F-st Pace' Stepper",
    equipment_type: 'Stepper/Stair Climber',
  }
  const wrong = evaluateImageCandidateIdentity(fst, {
    title: 'Pulse Fitness 220G Independent Stepper',
    sourceUrl: 'https://pulsefitness.com/product/cv-standing-seated-stepper-step-independent-stepper-7-tactile-220g-aag/',
    imageUrl: 'https://pulsefitness.com/220g.jpg',
  })
  assert(!wrong.eligible || wrong.identityResult.hasConflict || wrong.identityResult.evidenceLevel !== 'exact', 'F-ST vs 220G must not be exact')
  assert(
    wrong.identityResult.hasConflict
      || !wrong.identityResult.matched.some((entry) => entry.type === 'model_code'),
    'F-ST vs 220G should not match model codes',
  )

  const right = evaluateImageCandidateIdentity(fst, {
    title: 'Pulse Fitness Pace Stepper 220 F-ST',
    sourceUrl: 'https://example.com/pulse-pace-220f',
    imageUrl: 'https://example.com/pace.jpg',
  })
  assert(right.eligible, 'F-ST Pace should match Pace 220F')
  assert(right.identityResult.evidenceLevel === 'exact', 'F-ST Pace exact evidence')

  // Search query text must not poison candidate identity.
  const poisoned = evaluateImageCandidateIdentity(fst, {
    title: 'Step - Independent Stepper - Pulse Fitness',
    sourceUrl: 'https://pulsefitness.com/product/cv-standing-seated-stepper-step-independent-stepper-7-tactile-220g-aag/',
    imageUrl: 'https://pulsefitness.com/wp-content/uploads/2019/10/220G-AAG.jpg',
    searchQuery: "Pulse Fitness Pace Stepper 220FST",
  })
  assert(
    poisoned.identityResult.hasConflict || poisoned.identityResult.evidenceLevel !== 'exact',
    'Search query must not make F-ST exact-match a 220G page',
  )
}

// Absent target model with no explicit conflict stays low-cap / not auto exact
{
  const genericAscent = {
    title: 'Matrix commercial ascent trainer',
    sourceUrl: 'https://www.fitkituk.com/matrix-ascent-trainer',
    imageUrl: 'https://www.fitkituk.com/ascent.jpg',
  }
  const result = compareProductIdentity(onyxAscent, genericAscent)
  assert(!result.hasConflict, 'Generic ascent is not an explicit conflict')
  assert(result.evidenceLevel !== 'exact' || !result.matched.some((entry) => entry.token === 'onyx'), 'Generic ascent is not exact Onyx')
  assert(result.maxConfidence <= 70, 'Generic ascent capped at family/brand level')
}

// Technogym generation / family conflicts
{
  const selectionPro = {
    brand: 'Technogym',
    product_family: 'Selection Pro',
    model: 'Pulldown',
    canonical_product_name: 'Technogym Selection Pro Pulldown',
    equipment_type: 'Lat Pulldown',
  }
  const pureStrength = {
    title: 'Technogym Pure Strength Pulldown',
    sourceUrl: 'https://www.technogym.com/en-US/product/pure-strength-pulldown_MG2000-NBGJV0.html',
    imageUrl: 'https://www.technogym.com/en-US/feed/images/MG2000-NBGJV0/pure-pulldown-plp.jpg',
  }
  const gate = evaluateImageCandidateIdentity(selectionPro, pureStrength)
  assert(!gate.eligible, 'Selection Pro vs Pure Strength must reject')
  assert(
    gate.identityResult.conflicts.some((entry) => entry.type === 'technogym_line'),
    'Selection Pro vs Pure Strength technogym_line conflict',
  )

  const selectionLine = {
    brand: 'Technogym',
    product_family: 'Selection Line',
    model: 'Chest Press',
    canonical_product_name: 'Technogym Selection Line Chest Press',
    equipment_type: 'Chest Press',
  }
  const selection700 = {
    title: 'Technogym Selection 700 Chest Press',
    sourceUrl: 'https://www.technogym.com/en-US/product/selection-700-chest-press_MNFC.html',
    imageUrl: 'https://www.technogym.com/en-US/feed/images/MNFC/selection-700-chest-press-plp.jpg',
  }
  const lineVs700 = evaluateImageCandidateIdentity(selectionLine, selection700)
  assert(!lineVs700.eligible, 'Selection Line vs Selection 700 must reject')

  const strengthBench = {
    brand: 'Technogym',
    product_family: 'Strength',
    model: 'Panca Regolabile',
    canonical_product_name: 'Technogym Strength Panca Regolabile',
    equipment_type: 'Bench',
  }
  const pureBench = {
    title: 'Adjustable Bench Pure Strength',
    sourceUrl: 'https://www.technogym.com/it-IT/product/adjustable-bench-pure-strength_PG04.html',
    imageUrl: 'https://www.technogym.com/images/pure-adjustable-bench.jpg',
  }
  assert(
    !evaluateImageCandidateIdentity(strengthBench, pureBench).eligible,
    'Strength vs Pure Strength bench must reject',
  )
}

console.log('equipment-product-image-identity tests passed')
