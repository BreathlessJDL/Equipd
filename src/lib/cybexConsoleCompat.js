/**
 * Cybex console catalogue and product/year compatibility matrix.
 *
 * Primary sources:
 * - https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details
 * - https://support.lifefitness.com/hc/en-us/articles/360037410533-Cybex-770-771-772-Arc-Introduction
 * - https://cdn.sweatband.com/upload/multimedia/770%20T.pdf (770T: LED or E3 View)
 * - https://kb.cybexintl.com/Owners_Manuals/Arc/625AT_Owner's_Manual_5625-4_RevA.pdf (LED or EPEM)
 * - https://kb.cybexintl.com/Owners_Manuals/Cybex_70T_Console_Owners_Manual_1008851-0001.pdf (70T = R-Series)
 * - https://www.lifefitness.com/en-us/catalog/cybex/cybex-products/cybex-50l-console-for-cardio-equipment
 * - https://www.lifefitness.com/en-us/catalog/cybex/cybex-products/cybex-70t-console
 *
 * Important:
 * - 50L and 70T are documented for later Cybex/R-Series cardio, not as brand-wide options for 530/625/750/770.
 * - Strength products must never receive console mappings.
 * - Public brand-wide fallback is disabled; only explicit product_console_compat rows apply.
 */

export const CYBEX_BRAND = 'Cybex'

export const CYBEX_CONSOLE_DEFS = [
  {
    console_key: 'led',
    console_name: 'LED',
    alternative_names: ['LED Console', 'CardioTouch LED', 'Standard LED'],
    start_year: 2007,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 10,
    confidence: 'high',
    source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details',
    notes: 'Standard LED console family used across Cybex cardio. Life Fitness support lists LED as one of three Cybex cardio console types.',
  },
  {
    console_key: 'e3_view',
    console_name: 'E3 View',
    alternative_names: ['E3 View Monitor', 'E3 View HD', 'EPEM', 'Embedded Personal Entertainment Monitor'],
    start_year: 2011,
    end_year: 2018,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 20,
    confidence: 'high',
    source_url: 'https://cdn.sweatband.com/upload/multimedia/770%20T.pdf',
    notes: 'Optional embedded HD entertainment monitor on 600/700 series. 625 manuals also list EPEM. Approximate end ~2018 as Cybex GO / later consoles superseded entertainment options.',
  },
  {
    console_key: 'cybex_go',
    console_name: 'Cybex GO',
    alternative_names: ['GO Console', 'Cybex Go'],
    start_year: 2014,
    end_year: null,
    is_current: true,
    display_order: 30,
    confidence: 'high',
    source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037410533-Cybex-770-771-772-Arc-Introduction',
    notes: 'Cybex GO released June 2014 (documented on 772 Arc). Life Fitness support lists Cybex GO as the third Cybex cardio console type alongside LED and E3 View.',
  },
  {
    console_key: '50l',
    console_name: '50L',
    alternative_names: ['Cybex 50L', '50L Console'],
    start_year: 2017,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 40,
    confidence: 'medium',
    source_url: 'https://www.lifefitness.com/en-us/catalog/cybex/cybex-products/cybex-50l-console-for-cardio-equipment',
    notes: 'Simplified LED-style console (later Cybex generation / R-Series era). Discontinued on Life Fitness catalogue. Not mapped to 530/625/750/770 catalogue products without frame evidence.',
  },
  {
    console_key: '70t',
    console_name: '70T',
    alternative_names: ['Cybex 70T', '70T Console', '70T HD'],
    start_year: 2017,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 50,
    confidence: 'high',
    source_url: 'https://kb.cybexintl.com/Owners_Manuals/Cybex_70T_Console_Owners_Manual_1008851-0001.pdf',
    notes: '16" touchscreen console documented for R-Series treadmill/bike/Arc Trainer. Not applied to classic 530/625/750/770 products in this catalogue.',
  },
]

/** Shared 700-series entertainment options (LED base + E3 + GO). */
function series700Mappings({ ledFrom = 2011, e3From = 2011 } = {}) {
  return [
    {
      console_key: 'led',
      compatibility_type: 'factory',
      available_from_year: ledFrom,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://cdn.sweatband.com/upload/multimedia/770%20T.pdf',
      notes: 'Standard LED / CardioTouch LED console for 700-series cardio.',
    },
    {
      console_key: 'e3_view',
      compatibility_type: 'optional',
      available_from_year: e3From,
      available_to_year: 2018,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://cdn.sweatband.com/upload/multimedia/770%20T.pdf',
      notes: 'Optional E3 View HD monitor on 700-series. Approximate availability window.',
    },
    {
      console_key: 'cybex_go',
      compatibility_type: 'optional',
      available_from_year: 2014,
      available_to_year: null,
      is_default: false,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037410533-Cybex-770-771-772-Arc-Introduction',
      notes: 'Cybex GO from June 2014 on 700-series platforms (documented on 772 Arc; listed as 700-series entertainment option).',
    },
  ]
}

/** 600-series: LED + E3/EPEM (no Cybex GO evidence on early 625 docs). */
function series600Mappings({ ledFrom = 2011, e3From = 2011, includeGo = false } = {}) {
  const rows = [
    {
      console_key: 'led',
      compatibility_type: 'factory',
      available_from_year: ledFrom,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://kb.cybexintl.com/Owners_Manuals/Arc/625AT_Owner\'s_Manual_5625-4_RevA.pdf',
      notes: 'Standard LED console for 600-series cardio.',
    },
    {
      console_key: 'e3_view',
      compatibility_type: 'optional',
      available_from_year: e3From,
      available_to_year: 2018,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://kb.cybexintl.com/Owners_Manuals/Arc/625AT_Owner\'s_Manual_5625-4_RevA.pdf',
      notes: 'Optional E3 View / EPEM entertainment monitor on 600-series.',
    },
  ]
  if (includeGo) {
    rows.push({
      console_key: 'cybex_go',
      compatibility_type: 'optional',
      available_from_year: 2014,
      available_to_year: null,
      is_default: false,
      display_order: 30,
      confidence: 'medium',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details',
      notes: 'Cybex GO may appear on later 600-series units; medium confidence vs well-documented 700-series GO.',
    })
  }
  return rows
}

export const CYBEX_COMPAT_BY_PRODUCT_KEY = {
  // --- 500 series ---
  'cybex-treadmill-530t-treadmill': [
    {
      console_key: 'led',
      compatibility_type: 'fixed',
      available_from_year: 2008,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://gymstore.com/cybex-530t-pro-treadmill/',
      notes: '530T documented with split LED console (upper/lower LED). No E3 View/50L/70T evidence for this generation — treat as fixed LED. Medium confidence (dealer/spec sheet secondary to OEM manual).',
    },
  ],

  // --- 600 series ---
  'cybex-treadmill-625t-ifi': series600Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-exercise-bike-625c-upright-bike': series600Mappings({ ledFrom: 2011, e3From: 2011 }),
  'cybex-exercise-bike-625r-recumbent-bike': series600Mappings({ ledFrom: 2011, e3From: 2011 }),
  'cybex-cross-trainer-626at-total-body-arc-trainer': series600Mappings({ ledFrom: 2013, e3From: 2013 }),
  'cybex-cross-trainer-630a-arc-trainer': [
    {
      console_key: 'led',
      compatibility_type: 'fixed',
      available_from_year: 2007,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details',
      notes: 'Earlier Arc Trainer generation. Map LED only until OEM brochure confirms E3/EPEM for 630A. Medium confidence.',
    },
  ],

  // --- 700 series ---
  'cybex-treadmill-750t-treadmill': series700Mappings({ ledFrom: 2011, e3From: 2011 }),
  'cybex-treadmill-770t-treadmill': series700Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-exercise-bike-770c-upright-bike': series700Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-exercise-bike-770r-recumbent-bike': series700Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-cross-trainer-770at-total-body-arc-trainer': series700Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-cross-trainer-770at-lower-body-arc-trainer': series700Mappings({ ledFrom: 2012, e3From: 2012 }),
  'cybex-cross-trainer-772at-lower-body-arc-trainer': [
    {
      console_key: 'led',
      compatibility_type: 'factory',
      available_from_year: 2013,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037410533-Cybex-770-771-772-Arc-Introduction',
      notes: '772 Arc released 2013 (corded). LED base console.',
    },
    {
      console_key: 'e3_view',
      compatibility_type: 'optional',
      available_from_year: 2013,
      available_to_year: 2018,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037406233-Cybex-772-771-770-Arc-Trainer-Owner-s-Manuals',
      notes: '772 Arc E3 manuals exist; optional E3 View era.',
    },
    {
      console_key: 'cybex_go',
      compatibility_type: 'optional',
      available_from_year: 2014,
      available_to_year: 2018,
      to_year_approximate: true,
      is_default: false,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037410533-Cybex-770-771-772-Arc-Introduction',
      notes: '772 Arc with Cybex GO released June 2014–June 2018 per Life Fitness support.',
    },
  ],

  // --- Sparc ---
  'cybex-cross-trainer-sparc-arc-trainer': [
    {
      console_key: 'led',
      compatibility_type: 'factory',
      available_from_year: 2016,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details',
      notes: 'Sparc Arc Trainer (~2016). LED treated as factory default pending Sparc-specific OEM console brochure. Do not assume 70T/50L.',
    },
    {
      console_key: 'cybex_go',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: null,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://support.lifefitness.com/hc/en-us/articles/360037408593-Cybex-Consoles-Details',
      notes: 'Possible Cybex GO / entertainment console on Sparc-era units; medium confidence until Sparc sell sheet confirms.',
    },
  ],
}

export const CYBEX_UNRESOLVED_PRODUCTS = [
  {
    name: '50L / 70T on catalogue products',
    reason: '50L and 70T are later/R-Series consoles. Included in equipment_consoles master but not mapped to 530/625/750/770/Sparc without frame compatibility evidence.',
  },
  {
    name: 'R-Series cardio frames',
    reason: 'Not present as approved canonical products. When onboarded, map 50L (base) and 70T (premium) explicitly.',
  },
  {
    name: '530T / 630A exact console SKU',
    reason: 'Mapped as fixed LED with medium confidence from secondary specs / era inference.',
  },
  {
    name: 'Sparc Arc Trainer console options',
    reason: 'LED + optional Cybex GO at medium confidence pending Sparc OEM documentation.',
  },
  {
    name: 'Strength products',
    reason: 'Must never receive console mappings (69 non-cardio Cybex products left unmapped by design).',
  },
]

export function listCybexCompatProductKeys() {
  return Object.keys(CYBEX_COMPAT_BY_PRODUCT_KEY)
}
