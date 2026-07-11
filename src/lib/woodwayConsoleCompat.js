/**
 * Woodway display/console catalogue and product/year compatibility matrix.
 *
 * Primary sources:
 * - https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-OWNERS-MANUAL-102423-V2_web.pdf
 * - https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-PERSONAL-TRAINER-OWNER-MANUAL-071223-V1_web.pdf
 * - https://www.woodway.com/wp-content/uploads/2024/02/woodway_prosmart_owners_manual_web.pdf
 * - https://www.americanspa.com/press-releases/woodway-launches-4front-prosmart-console-powered-by-athlios (ProSmart production July 2016)
 * - https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf
 * - http://en.woodway.com/productmanuals/CURVE%20Owner's%20Manual%20REV%20021210.pdf
 * - https://www.woodway.de/wp-content/uploads/2022/01/Curve-09.2021-v2.3en.pdf
 *
 * Approved catalogue currently includes: 4Front, Curve, Curve Trainer, Curve FTG, Curve XL.
 * Desmo / Mercury / Path / Pro / Pro XL / Force / Curve LTG are not approved yet.
 */

export const WOODWAY_BRAND = 'Woodway'

export const WOODWAY_CONSOLE_DEFS = [
  {
    console_key: 'quick_set',
    console_name: 'Quick Set',
    alternative_names: ['Standard display', 'Quick Set LED', 'LED display', 'Quick Set Display Console'],
    start_year: 2010,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 10,
    confidence: 'high',
    source_url: 'https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-OWNERS-MANUAL-102423-V2_web.pdf',
    notes: '4Front Quick Set LED console (speed, incline, distance, time, HR, calories, pace). “With View Option” variants exist; not modelled as a separate public valuation choice.',
  },
  {
    console_key: 'personal_trainer',
    console_name: 'Personal Trainer',
    alternative_names: ['PT', 'PT Display', 'LCD Personal Trainer', 'Personal Trainer Display'],
    start_year: 2010,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 20,
    confidence: 'high',
    source_url: 'https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-PERSONAL-TRAINER-OWNER-MANUAL-071223-V1_web.pdf',
    notes: '4Front LCD Personal Trainer console. “With View Option” noted in owners manual options list.',
  },
  {
    console_key: 'prosmart',
    console_name: 'ProSmart',
    alternative_names: ['Pro Smart', 'ProSmart Touchscreen', 'Pro Smart Touch Screen Display Console'],
    start_year: 2016,
    end_year: null,
    is_current: true,
    display_order: 30,
    confidence: 'high',
    source_url: 'https://www.americanspa.com/press-releases/woodway-launches-4front-prosmart-console-powered-by-athlios',
    notes: 'ProSmart touchscreen in production July 2016 (Woodway/AthliOS announcement). Also documented for Curve/Trainer/FTG ProSmart series.',
  },
  {
    console_key: 'curve_led',
    console_name: 'Curve LED Display',
    alternative_names: ['Standard Curve display', 'Battery LED display', 'Curve standard display'],
    start_year: 2009,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 40,
    confidence: 'high',
    source_url: 'http://en.woodway.com/productmanuals/CURVE%20Owner\'s%20Manual%20REV%20021210.pdf',
    notes: 'Battery-powered LED display used on Curve / Curve Trainer / Curve XL (and similar). Auto on/off with belt movement.',
  },
  {
    console_key: 'curve_ftg_standard',
    console_name: 'Curve FTG Standard Display',
    alternative_names: ['FTG Standard Screen', 'FTG standard display'],
    start_year: 2018,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 50,
    confidence: 'high',
    source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
    notes: 'Powered standard FTG screen with LOAD readout and load +/- controls. Distinct from battery Curve LED.',
  },
]

export const WOODWAY_COMPAT_BY_PRODUCT_KEY = {
  'woodway-treadmill-4front-4front': [
    {
      console_key: 'quick_set',
      compatibility_type: 'factory',
      available_from_year: 2010,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-OWNERS-MANUAL-102423-V2_web.pdf',
      notes: 'Quick Set listed as standard LED console option on 4Front / Pro / Pro XL owners manual.',
    },
    {
      console_key: 'personal_trainer',
      compatibility_type: 'optional',
      available_from_year: 2010,
      available_to_year: null,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://www.woodway.com/wp-content/uploads/2024/02/4-FRONT-OWNERS-MANUAL-102423-V2_web.pdf',
      notes: 'LCD Personal Trainer listed as factory option alongside Quick Set.',
    },
    {
      console_key: 'prosmart',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: null,
      is_default: false,
      display_order: 30,
      confidence: 'high',
      source_url: 'https://www.americanspa.com/press-releases/woodway-launches-4front-prosmart-console-powered-by-athlios',
      notes: 'ProSmart available from July 2016 production announcement; listed in current 4Front options.',
    },
  ],

  'woodway-non-motorised-treadmill-curve-curve': [
    {
      console_key: 'curve_led',
      compatibility_type: 'factory',
      available_from_year: 2009,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'http://en.woodway.com/productmanuals/CURVE%20Owner\'s%20Manual%20REV%20021210.pdf',
      notes: 'Standard battery LED display for Curve. Pre-ProSmart era effectively fixed; remains factory default when ProSmart is also offered.',
    },
    {
      console_key: 'prosmart',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: null,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
      notes: 'Curve ProSmart series documented in non-motorized users manual (requires mains power). Start year aligned to ProSmart launch (~2016); medium confidence for earliest Curve ProSmart availability.',
    },
  ],

  'woodway-non-motorised-treadmill-curve-trainer-curve-trainer': [
    {
      console_key: 'curve_led',
      compatibility_type: 'factory',
      available_from_year: 2009,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://www.woodway.de/wp-content/uploads/2022/01/Curve-09.2021-v2.3en.pdf',
      notes: 'Same battery LED family as Curve / Curve XL per Curve brochure/manual.',
    },
    {
      console_key: 'prosmart',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: null,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'medium',
      source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
      notes: 'Curve Trainer ProSmart assembly documented. Start year approximate to ProSmart era.',
    },
  ],

  'woodway-non-motorised-treadmill-curve-xl-curve-xl': [
    {
      console_key: 'curve_led',
      compatibility_type: 'fixed',
      available_from_year: 2009,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
      notes: 'Curve XL covered under standard Curve LED display sections. ProSmart section lists Curve/Trainer/FTG, not Curve XL — treat as fixed standard LED unless later evidence appears.',
    },
  ],

  'woodway-non-motorised-treadmill-curve-ftg-curve-ftg': [
    {
      console_key: 'curve_ftg_standard',
      compatibility_type: 'factory',
      available_from_year: 2018,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
      notes: 'FTG Standard Screen (powered, LOAD controls). Manual documents FTG Standard and ProSmart.',
    },
    {
      console_key: 'prosmart',
      compatibility_type: 'optional',
      available_from_year: 2018,
      available_to_year: null,
      from_year_approximate: true,
      is_default: false,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://woodway.com/wp-content/uploads/2024/02/um-nt-en-02_woodway_non_motorized_treadmills_users_manual_0_web.pdf',
      notes: 'FTG ProSmart documented alongside FTG Standard.',
    },
  ],
}

export const WOODWAY_UNRESOLVED_PRODUCTS = [
  {
    name: 'Desmo / Mercury / Path / Pro / Pro XL / Force / Curve LTG',
    reason: 'Not present in approved equipment_products catalogue. Map after onboard.',
  },
  {
    name: '4Front Quick Set / PT “with View Option”',
    reason: 'Listed in owners manual options. Not modelled as separate public consoles (same display family + TV view).',
  },
  {
    name: '4Front Pro / 4Front Pro XL as separate SKUs',
    reason: 'Manual covers 4Front / Pro / Pro XL together; catalogue has single 4Front product. Confirm if Pro/Pro XL need separate canonical products.',
  },
  {
    name: 'Curve ProSmart earliest year',
    reason: 'ProSmart launch mid-2016 for 4Front is well sourced; Curve ProSmart start flagged medium/approximate.',
  },
]

export function listWoodwayCompatProductKeys() {
  return Object.keys(WOODWAY_COMPAT_BY_PRODUCT_KEY)
}
