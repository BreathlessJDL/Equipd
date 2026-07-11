/**
 * Concept2 Performance Monitor catalogue and product/year compatibility matrix.
 *
 * Primary sources:
 * - https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness
 * - https://www.concept2.com/about/timeline
 * - https://sportsmith.com/support/guides/concept-2-indoor-rowers-performance-monitor-consoles-which-monitor-do-you-have/
 *
 * Public UI shows factory + optional only. Retrofit rows are stored for admin/future use.
 */

export const CONCEPT2_BRAND = 'Concept2'

export const CONCEPT2_CONSOLE_DEFS = [
  {
    console_key: 'pm1',
    console_name: 'PM1',
    alternative_names: ['Performance Monitor 1', 'PM 1'],
    start_year: 1986,
    end_year: 1993,
    end_year_approximate: true,
    is_current: false,
    display_order: 10,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 1986–1993; some secondary sources extend to ~1995.',
  },
  {
    console_key: 'pm2',
    console_name: 'PM2',
    alternative_names: ['Performance Monitor 2', 'PM 2'],
    start_year: 1995,
    end_year: 2003,
    is_current: false,
    display_order: 20,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 1995–2003. Original period monitor for Model C.',
  },
  {
    console_key: 'pm2_plus',
    console_name: 'PM2+',
    alternative_names: ['PM2 Plus', 'Performance Monitor 2+', 'PM 2+'],
    start_year: 1998,
    end_year: 2003,
    is_current: false,
    display_order: 30,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 1998–2003.',
  },
  {
    console_key: 'pm3',
    console_name: 'PM3',
    alternative_names: ['Performance Monitor 3', 'PM 3'],
    start_year: 2003,
    end_year: 2014,
    is_current: false,
    display_order: 40,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 2003–2014. Original monitor for Model D.',
  },
  {
    console_key: 'pm4',
    console_name: 'PM4',
    alternative_names: ['Performance Monitor 4', 'PM 4'],
    start_year: 2006,
    end_year: 2014,
    is_current: false,
    display_order: 50,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 2006–2014. Original monitor for Model E (Aug 2006).',
  },
  {
    console_key: 'pm5',
    console_name: 'PM5',
    alternative_names: ['Performance Monitor 5', 'PM 5'],
    start_year: 2014,
    end_year: null,
    is_current: true,
    display_order: 60,
    confidence: 'high',
    source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    notes: 'Official timeline 2014–present. Retrofit kits available for older machines.',
  },
]

/**
 * Compatibility rows keyed by canonical_product_key.
 * Years are inclusive. available_to_year null = open-ended.
 */
export const CONCEPT2_COMPAT_BY_PRODUCT_KEY = {
  'concept2-rowers-rowerg-model-c': [
    // 1993–1994: unresolved for public factory options — no factory/optional rows.
    // Retrofit rows retained for admin/historical use only.
    {
      console_key: 'pm2',
      compatibility_type: 'factory',
      available_from_year: 1995,
      available_to_year: 2003,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://sportsmith.com/support/guides/concept-2-indoor-rowers-performance-monitor-consoles-which-monitor-do-you-have/',
      notes: 'PM2 factory/default for Model C from official PM2 start (1995) through end of Model C period.',
    },
    {
      console_key: 'pm2_plus',
      compatibility_type: 'optional',
      available_from_year: 1998,
      available_to_year: 2003,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM2+ optional for later Model C (1998–2003).',
    },
    {
      console_key: 'pm3',
      compatibility_type: 'retrofit',
      available_from_year: 1993,
      available_to_year: 2003,
      from_year_approximate: true,
      is_default: false,
      display_order: 30,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'Later monitor can be fitted; not original-period for Model C. Admin-only publicly.',
    },
    {
      console_key: 'pm4',
      compatibility_type: 'retrofit',
      available_from_year: 1993,
      available_to_year: 2003,
      from_year_approximate: true,
      is_default: false,
      display_order: 40,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'Retrofit only. Admin-only publicly.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'retrofit',
      available_from_year: 1993,
      available_to_year: 2003,
      from_year_approximate: true,
      is_default: false,
      display_order: 50,
      confidence: 'high',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM5 retrofit kits exist for older indoor rowers; not factory for Model C. Admin-only publicly.',
    },
  ],

  'concept2-rowers-rowerg-model-d': [
    {
      console_key: 'pm3',
      compatibility_type: 'factory',
      available_from_year: 2003,
      available_to_year: 2013,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://www.concept2.com/about/timeline',
      notes: 'Model D introduced 2003 with PM3. Factory through end of 2013; PM5 from 2014.',
    },
    {
      console_key: 'pm4',
      compatibility_type: 'optional',
      available_from_year: 2006,
      available_to_year: 2014,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM4 optional for Model D 2006–2014 (approved). Medium confidence on factory-option status.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'factory',
      available_from_year: 2014,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://sportsmith.com/support/guides/concept-2-indoor-rowers-performance-monitor-consoles-which-monitor-do-you-have/',
      notes: 'PM5 standard on Model D / RowErg from Oct 2014 (from_year approximate within 2014).',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'retrofit',
      available_from_year: 2003,
      available_to_year: 2013,
      is_default: false,
      display_order: 40,
      confidence: 'high',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM5 retrofit on pre-2014 Model D machines. Not shown publicly by default.',
    },
  ],

  'concept2-rowers-rowerg-model-e': [
    {
      console_key: 'pm4',
      compatibility_type: 'factory',
      available_from_year: 2006,
      available_to_year: 2013,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://www.concept2.com/about/timeline',
      notes: 'Model E launched Aug 2006 with PM4. Factory through end of 2013.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'factory',
      available_from_year: 2014,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://sportsmith.com/support/guides/concept-2-indoor-rowers-performance-monitor-consoles-which-monitor-do-you-have/',
      notes: 'PM5 standard from Oct 2014 on Model E / tall-leg RowErg.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'retrofit',
      available_from_year: 2006,
      available_to_year: 2013,
      is_default: false,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM5 retrofit on pre-2014 Model E. Not shown publicly by default.',
    },
  ],

  'concept2-rowers-dynamic-rowerg': [
    {
      console_key: 'pm3',
      compatibility_type: 'factory',
      available_from_year: 2010,
      available_to_year: 2013,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/about/timeline',
      notes: 'Dynamic launched 2010 in the PM3/PM4 era. Exact original monitor by year needs brochure confirmation.',
    },
    {
      console_key: 'pm4',
      compatibility_type: 'optional',
      available_from_year: 2010,
      available_to_year: 2013,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM4 available in Dynamic pre-PM5 window; medium confidence.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'factory',
      available_from_year: 2014,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://sportsmith.com/support/guides/concept-2-indoor-rowers-performance-monitor-consoles-which-monitor-do-you-have/',
      notes: 'PM5 on Dynamic from Oct 2014.',
    },
    {
      console_key: 'pm5',
      compatibility_type: 'retrofit',
      available_from_year: 2010,
      available_to_year: 2013,
      from_year_approximate: true,
      is_default: false,
      display_order: 40,
      confidence: 'high',
      source_url: 'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
      notes: 'PM5 retrofit on earlier Dynamic machines. Not shown publicly by default.',
    },
  ],

  'concept2-exercise-bike-bikeerg': [
    {
      console_key: 'pm5',
      compatibility_type: 'fixed',
      available_from_year: 2015,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://www.concept2.com/about/timeline',
      notes: 'BikeErg officially launched Aug 2017 with PM5; catalogue baseline may start earlier. No alternate factory monitor — fixed/integrated. from_year approximate.',
    },
  ],
}

export const CONCEPT2_UNRESOLVED_PRODUCTS = [
  {
    name: 'SkiErg',
    reason: 'Not present in approved equipment_products catalogue yet. Planned in concept2-equipment-intelligence.csv.',
  },
  {
    name: 'Model A Indoor Rower',
    reason: 'Not in approved catalogue. Pre-PM era / very early machines.',
  },
  {
    name: 'Model B Indoor Rower',
    reason: 'Not in approved catalogue. Would map PM1 factory (1986–) with later retrofits.',
  },
  {
    name: 'Model C (1993–1994)',
    reason: 'Unresolved for public factory options — hide selector. Official PM2 timeline starts 1995. Retrofit rows retained admin-only.',
  },
]

export function listConcept2CompatProductKeys() {
  return Object.keys(CONCEPT2_COMPAT_BY_PRODUCT_KEY)
}
