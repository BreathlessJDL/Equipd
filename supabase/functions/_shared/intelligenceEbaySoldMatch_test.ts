import { classifyEbaySoldListing } from './intelligenceEbaySoldSearch.ts'
import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const equipment95T: EquipmentIntelligenceRow = {
  id: 'test-95t',
  brand: 'Life Fitness',
  series: null,
  model: '95T',
  equipment_type: 'Treadmill',
  slug: 'life-fitness-95t',
}

function classify95T(title: string, price = 1200) {
  return classifyEbaySoldListing(equipment95T, {
    title,
    link: 'https://www.ebay.co.uk/itm/test',
    price_numeric: price,
    structured_price_raw: price,
    price_source: 'totalPrice',
  })
}

const accept95T = classify95T('Life Fitness 95T Treadmill')
assert(accept95T.status === 'accepted', `95T should accept 95T title: ${accept95T.reason}`)
assert(accept95T.model_code_found === true, 'model_code_found should be true for 95T')
assert(accept95T.matched_alias === '95T', `matched_alias should be 95T, got ${accept95T.matched_alias}`)
assert(
  accept95T.expected_model_code === '95T',
  `expected_model_code should be 95T, got ${accept95T.expected_model_code}`,
)

const accept95Hyphen = classify95T('Life Fitness 95-T Treadmill')
assert(accept95Hyphen.status === 'accepted', `95T should accept 95-T title: ${accept95Hyphen.reason}`)
assert(accept95Hyphen.matched_alias === '95-T', `matched_alias should be 95-T, got ${accept95Hyphen.matched_alias}`)

const reject95TiFor95T = classify95T('Life Fitness 95 Ti Treadmill')
assert(
  reject95TiFor95T.status === 'rejected',
  `95T should reject 95 Ti title, got ${reject95TiFor95T.status}: ${reject95TiFor95T.reason}`,
)
assert(
  reject95TiFor95T.reason.includes('Different model code detected: expected 95T, found 95Ti'),
  `95T rejection should name conflicting 95Ti code: ${reject95TiFor95T.reason}`,
)

const rejectT95iFor95T = classify95T('Life Fitness T95i Commercial Treadmill')
assert(
  rejectT95iFor95T.status === 'rejected',
  `95T should reject T95i title, got ${rejectT95iFor95T.status}: ${rejectT95iFor95T.reason}`,
)

const rejectT3 = classify95T('Life Fitness T3 Treadmill')
assert(
  rejectT3.status === 'rejected' &&
    rejectT3.reason.includes('Different model code detected: expected 95T, found T3'),
  `95T should reject T3 title, got ${rejectT3.status}: ${rejectT3.reason}`,
)

const rejectT5 = classify95T('Life Fitness T5 Treadmill')
assert(
  rejectT5.status === 'rejected' &&
    rejectT5.reason.includes('Different model code detected: expected 95T, found T5'),
  `95T should reject T5 title, got ${rejectT5.status}: ${rejectT5.reason}`,
)

const equipment95Ti: EquipmentIntelligenceRow = {
  ...equipment95T,
  id: 'test-95ti',
  model: '95Ti',
  slug: 'life-fitness-95ti',
}

function classify95Ti(title: string, price = 1200) {
  return classifyEbaySoldListing(equipment95Ti, {
    title,
    link: 'https://www.ebay.co.uk/itm/test',
    price_numeric: price,
    structured_price_raw: price,
    price_source: 'totalPrice',
    sold_date: '2026-01-15T00:00:00.000Z',
  })
}

const rejectPartsRoller = classify95Ti(
  'LIFE FITNESS Treadmill 93T / 95Ti Front Roller & Rear Roller 0K65-01001-0000',
)
assert(
  rejectPartsRoller.status === 'rejected',
  `parts listing should reject, got ${rejectPartsRoller.status}: ${rejectPartsRoller.reason}`,
)
assert(
  rejectPartsRoller.reason === 'Parts/accessory listing, not complete equipment',
  `parts rejection reason should be explicit: ${rejectPartsRoller.reason}`,
)
assert(
  (rejectPartsRoller.parts_terms_detected?.length ?? 0) > 0,
  'parts_terms_detected should be populated',
)

const accept95TiCommercial = classify95Ti(
  'Life Fitness 95Ti Commercial Treadmill Fully Working',
)
assert(
  accept95TiCommercial.status === 'accepted',
  `95Ti commercial title should accept: ${accept95TiCommercial.reason}`,
)
assert(
  accept95TiCommercial.confidence >= 90,
  `95Ti commercial should be high confidence, got ${accept95TiCommercial.confidence}`,
)
assert(
  accept95TiCommercial.score_breakdown?.score_path === 'exact_model_accept',
  '95Ti commercial should include exact model score breakdown',
)
assert(
  accept95TiCommercial.score_breakdown?.brand_score === 40 &&
    accept95TiCommercial.score_breakdown?.model_score === 48,
  `score breakdown should decompose brand+model, got ${JSON.stringify(accept95TiCommercial.score_breakdown)}`,
)
assert(accept95TiCommercial.score_breakdown?.brand_match === true, 'accepted listing should have brand_match true')
assert(
  accept95TiCommercial.score_breakdown?.expected_brand === 'Life Fitness' &&
    accept95TiCommercial.score_breakdown?.detected_brand === 'Life Fitness',
  'accepted listing should show expected and detected brand',
)

const accept95TiRefurb = classify95Ti(
  'LIFEFITNESS 95Ti Club Series INTEGRITY Treadmill refurbished/serviced',
)
assert(
  accept95TiRefurb.status === 'accepted',
  `refurbished 95Ti should accept: ${accept95TiRefurb.reason}`,
)
assert(
  accept95TiRefurb.confidence >= 90,
  `refurbished 95Ti should be 90+, got ${accept95TiRefurb.confidence}`,
)

const acceptT95i = classify95Ti(
  'Life Fitness T95i Commercial Treadmill | Fully Working | Heavy Duty Garage Gym',
)
assert(
  acceptT95i.status === 'accepted',
  `95Ti should accept T95i title: ${acceptT95i.reason}`,
)
assert(acceptT95i.matched_alias === 'T95i', `matched_alias should be T95i, got ${acceptT95i.matched_alias}`)
assert(acceptT95i.confidence >= 90, `T95i commercial should be 90+, got ${acceptT95i.confidence}`)

assert(rejectPartsRoller.score_breakdown?.parts_accessory_hard_reject != null, 'parts breakdown should record hard reject')

const reviewRunningMachine = classify95Ti('Life Fitness Running Machine')
assert(
  reviewRunningMachine.score_breakdown?.missing_model_result != null,
  'review candidate should record missing model result in breakdown',
)
assert(
  reviewRunningMachine.status === 'review',
  `vague running machine should review, got ${reviewRunningMachine.status}: ${reviewRunningMachine.reason}`,
)
assert(reviewRunningMachine.needs_review === true, 'needs_review should be true')
assert(
  reviewRunningMachine.reason.includes('exact model code missing'),
  `review reason should mention missing model code: ${reviewRunningMachine.reason}`,
)
assert(
  reviewRunningMachine.confidence >= 55 && reviewRunningMachine.confidence <= 75,
  `review confidence should be mid-range, got ${reviewRunningMachine.confidence}`,
)
assert(reviewRunningMachine.score_breakdown?.brand_match === true, 'review listing should have brand_match true')
assert(
  reviewRunningMachine.score_breakdown?.expected_brand === 'Life Fitness' &&
    reviewRunningMachine.score_breakdown?.detected_brand === 'Life Fitness',
  'review listing should show matching expected and detected brand',
)
assert(
  reviewRunningMachine.score_breakdown?.brand_score === 40,
  `review listing should award brand score when brand matches, got ${reviewRunningMachine.score_breakdown?.brand_score}`,
)

const reviewClassicSilver = classify95Ti(
  'LIFEFITNESS Classic Silver Treadmill - serviced Commercial Equipment',
)
assert(
  reviewClassicSilver.status === 'review',
  `classic silver treadmill should review, got ${reviewClassicSilver.status}: ${reviewClassicSilver.reason}`,
)
assert(reviewClassicSilver.needs_review === true, 'classic silver should need review')
assert(
  reviewClassicSilver.score_breakdown?.brand_score === 40,
  `classic silver review should award brand score, got ${reviewClassicSilver.score_breakdown?.brand_score}`,
)

const wrongBrandReview = classify95Ti('Technogym Commercial Treadmill')
assert(
  wrongBrandReview.status === 'rejected',
  `different brand should reject, got ${wrongBrandReview.status}: ${wrongBrandReview.reason}`,
)
assert(wrongBrandReview.score_breakdown?.brand_match === false, 'wrong brand should set brand_match false')
assert(
  wrongBrandReview.score_breakdown?.brand_score === 0,
  `wrong brand should not award brand score, got ${wrongBrandReview.score_breakdown?.brand_score}`,
)
assert(
  wrongBrandReview.score_breakdown?.detected_brand == null,
  'wrong brand should not populate detected_brand',
)

const reject95TFor95Ti = classify95Ti('Life Fitness 95T Treadmill')
assert(
  reject95TFor95Ti.status === 'rejected',
  `95Ti should reject 95T title, got ${reject95TFor95Ti.status}: ${reject95TFor95Ti.reason}`,
)
assert(
  reject95TFor95Ti.reason.includes('Different model code detected: expected 95Ti, found 95T'),
  `95Ti rejection should be explicit about 95T mismatch: ${reject95TFor95Ti.reason}`,
)

const rejectT3For95Ti = classify95Ti('Life Fitness T3 Treadmill')
assert(
  rejectT3For95Ti.status === 'rejected' &&
    rejectT3For95Ti.reason.includes('Different model code detected: expected 95Ti, found T3'),
  `95Ti should reject T3 title, got ${rejectT3For95Ti.status}: ${rejectT3For95Ti.reason}`,
)

const lowPriceAccept = classify95Ti('Life Fitness 95Ti Commercial Treadmill', 150)
assert(
  lowPriceAccept.status === 'accepted',
  `95Ti should accept low auction price: ${lowPriceAccept.reason}`,
)
assert(lowPriceAccept.low_price_warning === true, 'low_price_warning should be true below floor')
assert(
  lowPriceAccept.confidence >= 82 && lowPriceAccept.confidence <= 88,
  `low-price 95Ti should land around 82-88, got ${lowPriceAccept.confidence}`,
)

const lowPricePartsReject = classifyEbaySoldListing(equipment95T, {
  title: 'Life Fitness 95T treadmill for parts',
  link: 'https://www.ebay.co.uk/itm/parts',
  price_numeric: 150,
  structured_price_raw: 150,
  price_source: 'totalPrice',
})
assert(
  lowPricePartsReject.status === 'rejected',
  `low price with parts should reject: ${lowPricePartsReject.reason}`,
)

const ic7Equipment: EquipmentIntelligenceRow = {
  id: 'test-ic7',
  brand: 'Life Fitness',
  series: 'Indoor Bike',
  model: 'IC7',
  equipment_type: 'Indoor Bike',
  slug: 'life-fitness-ic7',
}

const ic7Candidate = classifyEbaySoldListing(ic7Equipment, {
  title: 'Life Fitness IC7 Spin Bike',
  link: 'https://www.ebay.co.uk/itm/ic7',
  price_numeric: 900,
  structured_price_raw: 900,
  price_source: 'totalPrice',
})
assert(ic7Candidate.status === 'accepted', `IC7 should accept spin bike title: ${ic7Candidate.reason}`)

const equipment95Ri: EquipmentIntelligenceRow = {
  id: 'test-95ri',
  brand: 'Life Fitness',
  series: 'Silver Line',
  model: '95Ri',
  equipment_type: 'Recumbent Bike',
  slug: 'life-fitness-95ri',
}

function classify95Ri(title: string, price = 800) {
  return classifyEbaySoldListing(equipment95Ri, {
    title,
    link: 'https://www.ebay.co.uk/itm/95ri',
    price_numeric: price,
    structured_price_raw: price,
    price_source: 'totalPrice',
    sold_date: '2026-01-15T00:00:00.000Z',
  })
}

const accept95RiWithoutSeries = classify95Ri(
  'Life Fitness 95Ri Recumbent Exercise Bike | Commercial Gym Equipment',
)
assert(
  accept95RiWithoutSeries.status === 'accepted',
  `95Ri should accept without Silver Line in title: ${accept95RiWithoutSeries.reason}`,
)
assert(accept95RiWithoutSeries.model_code_found === true, '95Ri model code should be found')
assert(
  accept95RiWithoutSeries.expected_model_code === '95Ri',
  `expected model code should be 95Ri, got ${accept95RiWithoutSeries.expected_model_code}`,
)
assert(
  accept95RiWithoutSeries.score_breakdown?.brand_score === 40 &&
    accept95RiWithoutSeries.score_breakdown?.model_score === 48,
  '95Ri accept should award brand and model scores',
)

const accept95RiWithSeries = classify95Ri(
  'Life Fitness Silver Line 95Ri Recumbent Bike Commercial',
)
assert(
  accept95RiWithSeries.status === 'accepted',
  `95Ri should accept with Silver Line in title: ${accept95RiWithSeries.reason}`,
)
assert(
  (accept95RiWithSeries.score_breakdown?.series_range_bonus ?? 0) > 0,
  'Silver Line in title should add series/range confidence bonus',
)

const reject95RiWrongType = classify95Ri('Life Fitness 95Ri Treadmill Commercial')
assert(
  reject95RiWrongType.status === 'rejected',
  `95Ri recumbent equipment should reject treadmill listing: ${reject95RiWrongType.status}: ${reject95RiWrongType.reason}`,
)
assert(
  reject95RiWrongType.reason.includes('Wrong equipment type'),
  `wrong equipment type rejection should be explicit: ${reject95RiWrongType.reason}`,
)

const reject95RiSeriesOnlyMismatch = classify95Ti(
  'Life Fitness Silver Line Treadmill Commercial Serviced',
)
assert(
  reject95RiSeriesOnlyMismatch.status !== 'rejected' ||
    !reject95RiSeriesOnlyMismatch.reason.includes('Different series/range'),
  'series/range alone should never hard reject',
)

console.log('intelligenceEbaySoldMatch tests passed')
