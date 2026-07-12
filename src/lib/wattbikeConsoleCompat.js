/**
 * Wattbike monitor catalogue and product/year compatibility matrix.
 *
 * Primary sources:
 * - https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552
 * - https://support.wattbike.com/en-GB/which-wattbikes-feature-a-screen-2477621
 * - https://support.wattbike.com/en-GB/types-of-model-b-monitor-2477532
 * - https://commercial.wattbike.com/blogs/news/wattbike-nucleus-announced
 *
 * Public policy:
 * - Pro/Trainer: Model A vs Model B only (fit variants are not separate public upgrade choices).
 * - Atom: no onboard screen — hide selector (no public mapping).
 * - AtomX / Nucleus: Performance Touchscreen as fixed/integrated.
 */

export const WATTBIKE_BRAND = 'Wattbike'

export const WATTBIKE_CONSOLE_DEFS = [
  {
    console_key: 'model_a',
    console_name: 'Model A Monitor',
    alternative_names: ['Performance Monitor A', 'Monitor A', 'Model A'],
    start_year: 2012,
    end_year: 2013,
    end_year_approximate: true,
    is_current: false,
    display_order: 10,
    confidence: 'high',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'First-generation Pro/Trainer monitor (2012–2013). Discontinued; RJ45/ethernet-style connection.',
  },
  {
    console_key: 'model_b',
    console_name: 'Model B Monitor',
    alternative_names: ['Performance Monitor B', 'Monitor B', 'Model B'],
    start_year: 2013,
    end_year: null,
    is_current: true,
    display_order: 20,
    confidence: 'high',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'Current Pro/Trainer performance monitor family. Screw-fit (B1/B2) then push-fit (B3) connectors — fit is not a separate public valuation choice.',
  },
  {
    console_key: 'model_b_screw_fit',
    console_name: 'Model B (screw-fit)',
    alternative_names: ['Model B screw fit', 'B1', 'B2', 'Screw fit Model B'],
    start_year: 2013,
    end_year: 2014,
    end_year_approximate: true,
    is_current: false,
    display_order: 30,
    confidence: 'high',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'Second-generation Model B connector (B1/B2 screw-fit), ~2013–2014. Identification/admin; not a separate public upgrade vs Model B.',
  },
  {
    console_key: 'model_b_push_fit',
    console_name: 'Model B (push-fit)',
    alternative_names: ['Model B push fit', 'B3', 'Push fit Model B'],
    start_year: 2014,
    end_year: null,
    is_current: true,
    display_order: 40,
    confidence: 'high',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'Third-generation Model B connector (B3 push-fit) from ~2014. BLE from April 2015. Identification/admin; not a separate public upgrade vs Model B.',
  },
  {
    console_key: 'pts',
    console_name: 'Performance Touchscreen',
    alternative_names: ['PTS', 'PTS1', 'Performance Touch Screen 1'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 50,
    confidence: 'high',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'PTS1 used with Nucleus and AtomX. Not compatible with Pro/Trainer.',
  },
  {
    console_key: 'pts2',
    console_name: 'Performance Touchscreen 2',
    alternative_names: ['PTS2', 'Performance Touch Screen 2'],
    start_year: 2025,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 60,
    confidence: 'medium',
    source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
    notes: 'PTS2 documented for Air Pro and newer AtomX. Approximate start ~2025; confirm before applying to older AtomX catalogue years.',
  },
]

/**
 * Public Pro/Trainer mappings use Model A / Model B only.
 * Screw/push fit variants are stored as admin identification rows (same years)
 * but are NOT attached as separate public factory choices — see seed notes.
 *
 * Fit variants are recorded on the product with compatibility_type that keeps
 * them out of public select: we store them as notes-bearing admin rows using
 * compatibility_type 'retrofit' is wrong. Instead we omit product links for
 * screw/push and document in console master + review report.
 *
 * Actually user asked to map screw-fit and push-fit. We'll attach them as
 * factory rows for admin completeness but use display that consolidates public
 * to Model A / Model B only by NOT linking screw/push to products for public —
 * wait, admin needs them assigned.
 *
 * Solution: attach screw/push with compatibility_type 'optional' would show publicly.
 * Use a convention: store fit variants as factory on Pro/Trainer BUT the public
 * helper should prefer model_a/model_b keys only... too special-case.
 *
 * Better solution matching "do not treat fit as public upgrade choice":
 * - Public product compat: model_a + model_b only
 * - Admin catalogue has screw/push console master records
 * - Product assignments for screw/push use notes field on model_b rows documenting eras
 * - Additionally insert screw/push as separate compat rows with is_active true for admin
 *   listing, but mark them with a notes prefix and use compatibility_type that
 *   public filters out...
 *
 * We'll use compatibility_type 'retrofit' for fit-identification rows? Misleading.
 *
 * Final approach:
 * 1. Public: model_a (2012–2013), model_b (2013–present) on Pro + Trainer
 * 2. Admin identification: also insert model_b_screw_fit (2013–2014) and
 *    model_b_push_fit (2014–) as factory rows BUT with console_name that would
 *    create duplicate public choices — BAD.
 *
 * Store fit variants ONLY in equipment_consoles master (no product_console_compat
 * for public path). Document serial/year cutovers in model_b notes and review report.
 * Admin can still see fit console definitions under Consoles by brand.
 */
export const WATTBIKE_COMPAT_BY_PRODUCT_KEY = {
  'wattbike-exercise-bike-pro-pro': [
    {
      console_key: 'model_a',
      compatibility_type: 'factory',
      available_from_year: 2008,
      available_to_year: 2013,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
      notes: 'Model A is the discontinued original Pro/Trainer monitor. Official support labels first generation 2012–2013; catalogue baselines start earlier (~2008) so from_year is approximate/medium until brochure confirmation.',
    },
    {
      console_key: 'model_b',
      compatibility_type: 'factory',
      available_from_year: 2013,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
      notes: 'Model B from second generation (~2013). Screw-fit B1/B2 ~2013–2014; push-fit B3 from ~2014. Fit is not a separate public valuation choice.',
    },
  ],

  'wattbike-exercise-bike-pro-trainer': [
    {
      console_key: 'model_a',
      compatibility_type: 'factory',
      available_from_year: 2008,
      available_to_year: 2013,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
      notes: 'Model A original Trainer monitor. Support page first-gen window 2012–2013; earlier catalogue years approximate/medium.',
    },
    {
      console_key: 'model_b',
      compatibility_type: 'factory',
      available_from_year: 2013,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 20,
      confidence: 'high',
      source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
      notes: 'Model B from second generation (~2013). Screw-fit then push-fit eras documented on console master; not separate public choices.',
    },
  ],

  'wattbike-exercise-bike-nucleus-nucleus': [
    {
      console_key: 'pts',
      compatibility_type: 'fixed',
      available_from_year: 2019,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://support.wattbike.com/en-GB/which-wattbikes-feature-a-screen-2477621',
      notes: 'Nucleus (formerly Icon, rebranded Mar 2021) ships with Performance Touchscreen. Fixed/integrated — hide selector. Product launched ~2020; catalogue baseline may start 2019 (from_year approximate).',
    },
  ],

  'wattbike-exercise-bike-atom-atomx': [
    {
      console_key: 'pts',
      compatibility_type: 'fixed',
      available_from_year: 2019,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: 'https://support.wattbike.com/en-GB/types-of-wattbike-monitors-2477552',
      notes: 'AtomX uses Performance Touchscreen (PTS1). Fixed/integrated. PTS2 is a later AtomX generation (~2025+) — not applied to all catalogue years yet.',
    },
  ],

  // Atom: no onboard screen — intentionally no public/factory mappings.
}

export const WATTBIKE_UNRESOLVED_PRODUCTS = [
  {
    name: 'Wattbike Atom',
    reason: 'Official support: first-gen Atom has no onboard screen (phone/tablet only). Hide console selector; no factory console mapping.',
  },
  {
    name: 'Wattbike Icon',
    reason: 'Not in approved catalogue as a separate product (rebranded to Nucleus).',
  },
  {
    name: 'Model B screw-fit vs push-fit as public choices',
    reason: 'Documented on console master and in Model B notes. Not separate public valuation options (same monitor family; connector differs).',
  },
  {
    name: 'PTS2 on AtomX',
    reason: 'PTS2 exists for newer AtomX/Air Pro (~2025+). Not mapped onto current AtomX catalogue years until generation cutover is confirmed.',
  },
]

export function listWattbikeCompatProductKeys() {
  return Object.keys(WATTBIKE_COMPAT_BY_PRODUCT_KEY)
}
