/**
 * Phase 1B buyer-intent SEO configs for Wattbike, Cybex, Life Fitness and Hammer Strength.
 *
 * Merged into BRAND_BUYER_SEO by brandBuyerSeo.js.
 * Concept2 remains defined in brandBuyerSeo.js (Phase 1A benchmark — do not alter here).
 */

import { LANDING_PATHS } from './landingPagePaths.js'

/** @type {Readonly<Record<string, import('./brandBuyerSeo.js').BrandBuyerSeoConfig>>} */
export const PHASE1B_BRAND_BUYER_SEO = Object.freeze({
  wattbike: Object.freeze({
    slug: 'wattbike',
    intent: 'buyer',
    h1: 'Used Wattbikes for Sale',
    metaTitle: 'Used Wattbikes for Sale',
    metaDescription: (
      'Browse used Wattbikes for sale on Equipd — including Atom, AtomX, Pro, Pro Trainer '
      + 'and Nucleus. Check live UK marketplace listings and model value guides.'
    ),
    lede: (
      'Find used Wattbikes from UK sellers and research Atom, AtomX, Pro, Pro Trainer '
      + 'and Nucleus models before you buy.'
    ),
    heroCta: Object.freeze({
      label: 'Browse Wattbike for sale',
    }),
    heroSecondaryCta: Object.freeze({
      label: 'Explore Wattbike values',
    }),
    searchPlaceholder: 'Search Wattbike equipment and models...',
    heroContextBody: (
      'Compare Wattbike models, research values and buy with confidence from UK sellers on Equipd.'
    ),
    marketplaceHeading: 'Used Wattbike equipment for sale',
    marketplaceHeadingEmpty: 'Looking for a used Wattbike?',
    marketplaceLede: 'Live Wattbike listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Wattbike listings right now. Browse related indoor cycles '
      + 'and exercise bikes, or request a Wattbike — new stock appears on Equipd as sellers list it.'
    ),
    modelsHeading: 'Explore Wattbike equipment',
    modelsLede: (
      'Research Wattbike models before you buy — compare Atom, AtomX, Pro, Pro Trainer and '
      + 'Nucleus, then open a model guide for specs and values.'
    ),
    featuredModelKeys: Object.freeze([
      'wattbike-exercise-bike-atom-atom',
      'wattbike-exercise-bike-atom-atomx',
      'wattbike-exercise-bike-pro-pro',
      'wattbike-exercise-bike-pro-trainer',
      'wattbike-exercise-bike-nucleus-nucleus',
    ]),
    modelBlurbs: Object.freeze({
      'wattbike-exercise-bike-atom-atom': (
        'Wattbike Atom — a popular electromagnetic trainer used in homes, studios and performance settings.'
      ),
      'wattbike-exercise-bike-atom-atomx': (
        'AtomX sits in the Atom family with a higher-spec positioning for buyers comparing Atom-range bikes.'
      ),
      'wattbike-exercise-bike-pro-pro': (
        'Wattbike Pro is the classic air/magnetic commercial trainer many UK facilities recognise.'
      ),
      'wattbike-exercise-bike-pro-trainer': (
        'Pro Trainer is the Pro-family option for buyers specifically searching that model name.'
      ),
      'wattbike-exercise-bike-nucleus-nucleus': (
        'Nucleus is Wattbike’s later commercial platform for buyers comparing beyond Atom and Pro.'
      ),
    }),
    buyingGuide: Object.freeze({
      title: 'What to check when buying a used Wattbike',
      checkpoints: Object.freeze([
        Object.freeze({
          title: 'Confirm the model',
          body: (
            'Confirm the exact model (Atom, AtomX, Pro, Pro Trainer or Nucleus) from the frame badge '
            + 'and console, and ask whether the bike came from a home, studio or commercial floor — '
            + 'usage history usually shows in wear on pedals, saddle and contact points.'
          ),
        }),
        Object.freeze({
          title: 'Resistance & display',
          body: (
            'Ride the bike through the resistance range. Listen for unusual drivetrain noise, check '
            + 'that resistance changes smoothly, and confirm the display powers on and responds under load.'
          ),
        }),
        Object.freeze({
          title: 'Contact points & adjustments',
          body: (
            'Inspect pedals, crank arms, saddle, handlebars and adjustment mechanisms for play or damage. '
            + 'Check that height and reach adjustments lock securely and that feet and fixings are complete.'
          ),
        }),
        Object.freeze({
          title: 'Collection & what’s included',
          body: (
            'Agree what is included (pedals, power supply, accessories) and how collection or delivery '
            + 'will work before you pay through Equipd. Wattbikes are heavy — plan access and handling.'
          ),
        }),
      ]),
      paragraphs: Object.freeze([
        (
          'Confirm the exact model (Atom, AtomX, Pro, Pro Trainer or Nucleus) from the frame badge '
          + 'and console, and ask whether the bike came from a home, studio or commercial floor — '
          + 'usage history usually shows in wear on pedals, saddle and contact points.'
        ),
        (
          'Ride the bike through the resistance range. Listen for unusual drivetrain noise, check '
          + 'that resistance changes smoothly, and confirm the display powers on and responds under load.'
        ),
        (
          'Inspect pedals, crank arms, saddle, handlebars and adjustment mechanisms for play or damage. '
          + 'Check that height and reach adjustments lock securely and that feet and fixings are complete.'
        ),
        (
          'Agree what is included (pedals, power supply, accessories) and how collection or delivery '
          + 'will work before you pay through Equipd. Wattbikes are heavy — plan access and handling.'
        ),
      ]),
    }),
    valuesHeading: 'Research Wattbike equipment values',
    valuesLede: (
      'Open a model value guide to research original RRP, production information and '
      + 'estimated used values in context — live asking prices on marketplace listings above '
      + 'may differ from guide ranges.'
    ),
    about: Object.freeze({
      title: 'About used Wattbikes on Equipd',
      paragraphs: Object.freeze([
        (
          'Wattbike builds indoor cycling trainers used across home and commercial settings. On Equipd '
          + 'you can browse used Wattbikes for sale from UK sellers, compare Atom, AtomX, Pro, Pro Trainer '
          + 'and Nucleus model guides, and use valuations when you want a sense of typical used pricing.'
        ),
        (
          'Equipd estimates used values from original RRP baselines, production years, condition and '
          + 'console options where mapped — then links you to live marketplace listings when sellers '
          + 'have Wattbikes listed.'
        ),
      ]),
    }),
    categoryLinks: Object.freeze([
      { to: '/used-commercial-indoor-cycles', label: 'Used commercial indoor cycles' },
      { to: '/used-commercial-exercise-bikes', label: 'Used commercial exercise bikes' },
      { to: LANDING_PATHS.commercialCardio, label: 'Commercial cardio equipment' },
      { to: LANDING_PATHS.buy, label: 'Buy used gym equipment' },
    ]),
    faqItems: Object.freeze([
      {
        question: 'Can I buy a used Wattbike on Equipd?',
        answer: (
          'Yes. Equipd is a UK marketplace where sellers list used Wattbikes for sale. When listings '
          + 'are live they appear on this page and in browse results filtered by Wattbike.'
        ),
      },
      {
        question: 'Which Wattbike models does Equipd cover?',
        answer: (
          'The Equipd catalogue currently includes Wattbike Atom, AtomX, Pro, Pro Trainer and Nucleus '
          + '— each with its own model page and value guide.'
        ),
      },
      {
        question: 'What should I check on a used Wattbike?',
        answer: (
          'Confirm the model, ride through the resistance range, check the display under load, and '
          + 'inspect pedals, saddle, adjustments and frame fixings. Ask about usage history and what '
          + 'accessories are included.'
        ),
      },
      {
        question: 'How are Wattbike values estimated?',
        answer: (
          'Equipd estimates used values from the model’s original RRP, manufacture year, condition '
          + 'and configuration where mapped. Live asking prices on marketplace listings may differ '
          + 'from the typical value range on a model guide.'
        ),
      },
      {
        question: 'Can I sell my Wattbike on Equipd?',
        answer: (
          'Yes. You can create a listing from a valuation or from the sell flow. Equipd supports '
          + 'secure offers, handover tracking and seller payouts for eligible equipment.'
        ),
      },
    ]),
    collectionPageName: 'Used Wattbikes for Sale',
  }),

  cybex: Object.freeze({
    slug: 'cybex',
    intent: 'buyer',
    h1: 'Used Cybex Equipment for Sale',
    metaTitle: 'Used Cybex Gym Equipment for Sale',
    metaDescription: (
      'Browse used Cybex gym equipment for sale on Equipd — treadmills, Arc Trainers, bikes '
      + 'and strength machines. Check live UK marketplace listings and model value guides.'
    ),
    lede: (
      'Find used Cybex equipment from UK sellers and research treadmills, Arc Trainers, bikes '
      + 'and strength models before you buy.'
    ),
    heroCta: Object.freeze({
      label: 'Browse Cybex for sale',
    }),
    heroSecondaryCta: Object.freeze({
      label: 'Explore Cybex values',
    }),
    searchPlaceholder: 'Search Cybex equipment and models...',
    heroContextBody: (
      'Browse used Cybex equipment, research models and values, and buy with confidence from UK sellers.'
    ),
    marketplaceHeading: 'Used Cybex equipment for sale',
    marketplaceHeadingEmpty: 'Looking for used Cybex equipment?',
    marketplaceLede: 'Live Cybex listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Cybex listings right now. Browse related commercial cardio and '
      + 'strength equipment, or request Cybex kit — new stock appears on Equipd as sellers list it.'
    ),
    modelsHeading: 'Explore Cybex equipment',
    modelsLede: (
      'Cybex spans commercial cardio and strength. Below is a curated set of commonly searched '
      + 'models — open the full catalogue for Eagle, VR1, VR3 and more.'
    ),
    modelGroups: Object.freeze([
      Object.freeze({
        id: 'cardio',
        title: 'Cardio',
        keys: Object.freeze([
          'cybex-treadmill-770t-treadmill',
          'cybex-treadmill-750t-treadmill',
          'cybex-cross-trainer-770at-total-body-arc-trainer',
          'cybex-cross-trainer-630a-arc-trainer',
          'cybex-exercise-bike-770c-upright-bike',
          'cybex-exercise-bike-625c-upright-bike',
        ]),
      }),
      Object.freeze({
        id: 'strength',
        title: 'Strength',
        keys: Object.freeze([
          'cybex-chest-press-eagle-chest-press',
          'cybex-lat-pulldown-eagle-lat-pull',
          'cybex-leg-press-eagle-leg-press',
          'cybex-chest-press-vr1-strength-chest-press',
          'cybex-leg-press-vr1-strength-leg-press',
          'cybex-chest-press-vr3-strength-chest-press',
          'cybex-leg-press-plate-loaded-leg-press',
          'cybex-rack-smith-machine-plate-loaded-smith-machine',
        ]),
      }),
    ]),
    modelBlurbs: Object.freeze({
      'cybex-treadmill-770t-treadmill': 'Commercial Cybex 770T treadmill from the later cardio range.',
      'cybex-treadmill-750t-treadmill': 'Cybex 750T treadmill for buyers comparing facility treadmills.',
      'cybex-cross-trainer-770at-total-body-arc-trainer': (
        '770AT Total Body Arc Trainer — Cybex’s well-known commercial elliptical platform.'
      ),
      'cybex-cross-trainer-630a-arc-trainer': '630A Arc Trainer for buyers comparing earlier Arc models.',
      'cybex-exercise-bike-770c-upright-bike': '770C upright bike from Cybex’s commercial bike line.',
      'cybex-exercise-bike-625c-upright-bike': '625C upright bike for buyers comparing mid-range Cybex bikes.',
      'cybex-chest-press-eagle-chest-press': 'Eagle Chest Press from Cybex’s selectorised Eagle strength line.',
      'cybex-lat-pulldown-eagle-lat-pull': 'Eagle Lat Pull for back training on the Eagle platform.',
      'cybex-leg-press-eagle-leg-press': 'Eagle Leg Press from the Eagle commercial strength range.',
      'cybex-chest-press-vr1-strength-chest-press': 'VR1 Strength Chest Press from Cybex’s VR1 selectorised series.',
      'cybex-leg-press-vr1-strength-leg-press': 'VR1 Strength Leg Press for lower-body VR1 stations.',
      'cybex-chest-press-vr3-strength-chest-press': 'VR3 Strength Chest Press from the VR3 strength series.',
      'cybex-leg-press-plate-loaded-leg-press': 'Plate-loaded Cybex leg press for free-weight commercial floors.',
      'cybex-rack-smith-machine-plate-loaded-smith-machine': (
        'Cybex plate-loaded Smith machine for commercial strength rooms.'
      ),
    }),
    buyingGuide: Object.freeze({
      title: 'What to check when buying used Cybex equipment',
      checkpoints: Object.freeze([
        Object.freeze({
          title: 'Series & usage history',
          body: (
            'Identify the series and model clearly — Cybex cardio (treadmills, Arc Trainers, bikes) '
            + 'and strength (Eagle, VR1, VR3, plate-loaded) wear differently. Ask whether the machine '
            + 'came from a commercial floor and how intensively it was used.'
          ),
        }),
        Object.freeze({
          title: 'Cardio checks',
          body: (
            'On cardio, power the console, walk or ride through speed/incline or resistance ranges, '
            + 'and listen for belt, deck, ramp or drivetrain noise. Confirm safety stops and displays respond.'
          ),
        }),
        Object.freeze({
          title: 'Strength station checks',
          body: (
            'On strength stations, check pads and upholstery, cables or plate carriages, adjustment pins, '
            + 'and that the movement path feels smooth and complete through the range of motion.'
          ),
        }),
        Object.freeze({
          title: 'Transport & access',
          body: (
            'Commercial Cybex frames are heavy. Confirm access, dismantling needs and collection or '
            + 'delivery arrangements before paying through Equipd, and photograph serial plates for your records.'
          ),
        }),
      ]),
      paragraphs: Object.freeze([
        (
          'Identify the series and model clearly — Cybex cardio (treadmills, Arc Trainers, bikes) '
          + 'and strength (Eagle, VR1, VR3, plate-loaded) wear differently. Ask whether the machine '
          + 'came from a commercial floor and how intensively it was used.'
        ),
        (
          'On cardio, power the console, walk or ride through speed/incline or resistance ranges, '
          + 'and listen for belt, deck, ramp or drivetrain noise. Confirm safety stops and displays respond.'
        ),
        (
          'On strength stations, check pads and upholstery, cables or plate carriages, adjustment pins, '
          + 'and that the movement path feels smooth and complete through the range of motion.'
        ),
        (
          'Commercial Cybex frames are heavy. Confirm access, dismantling needs and collection or '
          + 'delivery arrangements before paying through Equipd, and photograph serial plates for your records.'
        ),
      ]),
    }),
    valuesHeading: 'Research Cybex equipment values',
    valuesLede: (
      'Open a model value guide to research original RRP, production information and '
      + 'estimated used values in context — live asking prices on marketplace listings above '
      + 'may differ from guide ranges.'
    ),
    about: Object.freeze({
      title: 'About used Cybex equipment on Equipd',
      paragraphs: Object.freeze([
        (
          'Cybex is a commercial fitness brand spanning cardio and strength — including treadmills, '
          + 'Arc Trainers, bikes, Eagle/VR selectorised lines and plate-loaded stations. On Equipd you '
          + 'can browse used Cybex equipment for sale, explore the catalogue by series, and use value guides.'
        ),
        (
          'Equipd estimates used values from original RRP baselines, production years, condition and '
          + 'console options where mapped — then links you to live marketplace listings when sellers '
          + 'have Cybex equipment listed.'
        ),
      ]),
    }),
    categoryLinks: Object.freeze([
      { to: '/used-commercial-treadmills', label: 'Used commercial treadmills' },
      { to: '/used-commercial-cross-trainers', label: 'Used commercial cross trainers' },
      { to: '/used-commercial-exercise-bikes', label: 'Used commercial exercise bikes' },
      { to: '/used-pin-loaded-machines', label: 'Used pin-loaded machines' },
      { to: '/used-plate-loaded-machines', label: 'Used plate-loaded machines' },
      { to: LANDING_PATHS.commercialGym, label: 'Commercial gym equipment' },
      { to: LANDING_PATHS.buy, label: 'Buy used gym equipment' },
    ]),
    faqItems: Object.freeze([
      {
        question: 'Can I buy used Cybex equipment on Equipd?',
        answer: (
          'Yes. Equipd is a UK marketplace where sellers list used Cybex cardio and strength equipment. '
          + 'When listings are live they appear on this page and in brand-filtered browse results.'
        ),
      },
      {
        question: 'What Cybex equipment does Equipd cover?',
        answer: (
          'The catalogue includes Cybex treadmills, Arc Trainers, upright and recumbent bikes, '
          + 'Eagle and VR strength lines, and plate-loaded stations — each model page has its own value guide.'
        ),
      },
      {
        question: 'What should I check on used Cybex commercial equipment?',
        answer: (
          'Confirm the series and model, test cardio consoles and resistance or speed ranges, and on '
          + 'strength machines inspect pads, cables or plate paths and adjustment hardware. Ask about '
          + 'commercial usage and what is included with the sale.'
        ),
      },
      {
        question: 'How are Cybex equipment values estimated?',
        answer: (
          'Equipd estimates used values from original RRP, manufacture year, condition and configuration '
          + 'where mapped. Marketplace asking prices may differ from typical value-guide ranges.'
        ),
      },
      {
        question: 'Can I sell Cybex equipment on Equipd?',
        answer: (
          'Yes. List from a valuation or the sell flow. Equipd supports secure offers, handover tracking '
          + 'and seller payouts for eligible equipment.'
        ),
      },
    ]),
    collectionPageName: 'Used Cybex Equipment for Sale',
  }),

  'life-fitness': Object.freeze({
    slug: 'life-fitness',
    intent: 'buyer',
    h1: 'Used Life Fitness Equipment for Sale',
    metaTitle: 'Used Life Fitness Equipment for Sale',
    metaDescription: (
      'Browse used Life Fitness equipment for sale on Equipd — treadmills, cross trainers, '
      + 'bikes and strength machines. Check live UK marketplace listings and model value guides.'
    ),
    lede: (
      'Find used Life Fitness equipment from UK sellers and research commercial cardio and '
      + 'strength models before you buy.'
    ),
    heroCta: Object.freeze({
      label: 'Browse Life Fitness for sale',
    }),
    heroSecondaryCta: Object.freeze({
      label: 'Explore Life Fitness values',
    }),
    searchPlaceholder: 'Search Life Fitness equipment and models...',
    heroContextBody: (
      'Compare Life Fitness models, research values and buy with confidence from UK sellers on Equipd.'
    ),
    marketplaceHeading: 'Used Life Fitness equipment for sale',
    marketplaceHeadingEmpty: 'Looking for used Life Fitness equipment?',
    marketplaceLede: 'Live Life Fitness listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Life Fitness listings right now. Browse related commercial cardio '
      + 'and strength equipment, or request Life Fitness kit — new stock appears as sellers list it.'
    ),
    modelsHeading: 'Explore Life Fitness equipment',
    modelsLede: (
      'Life Fitness has deep catalogue coverage on Equipd. Below is a curated set of commonly '
      + 'searched cardio and strength platforms — use search and the full catalogue for the wider range.'
    ),
    modelGroups: Object.freeze([
      Object.freeze({
        id: 'cardio',
        title: 'Cardio',
        keys: Object.freeze([
          'life-fitness-treadmill-integrity-series-treadmill',
          'life-fitness-treadmill-elevation-treadmill',
          'life-fitness-treadmill-silver-line-95ti',
          'life-fitness-cross-trainer-integrity-series-crosstrainer',
          'life-fitness-cross-trainer-elevation-crosstrainer',
          'life-fitness-exercise-bike-indoor-bikes-ic7',
          'life-fitness-exercise-bike-integrity-series-bike',
        ]),
      }),
      Object.freeze({
        id: 'strength',
        title: 'Strength',
        keys: Object.freeze([
          'life-fitness-chest-press-insignia-chest-press',
          'life-fitness-chest-press-signature-chest-press',
          'life-fitness-leg-press-signature-leg-press',
          'life-fitness-chest-press-optima-chest-press',
          'life-fitness-leg-press-optima-leg-press',
          'life-fitness-chest-press-pro-1-chest-press',
          'life-fitness-leg-press-pro-1-leg-press',
          'life-fitness-lat-pulldown-pro-1-lat-pulldown',
        ]),
      }),
    ]),
    modelBlurbs: Object.freeze({
      'life-fitness-treadmill-integrity-series-treadmill': (
        'Integrity Series treadmill — a core commercial Life Fitness cardio platform.'
      ),
      'life-fitness-treadmill-elevation-treadmill': (
        'Elevation Series treadmill, widely used on UK commercial floors.'
      ),
      'life-fitness-treadmill-silver-line-95ti': (
        'Silver Line 95Ti treadmill for buyers comparing earlier commercial decks.'
      ),
      'life-fitness-cross-trainer-integrity-series-crosstrainer': (
        'Integrity Series crosstrainer for facility elliptical stations.'
      ),
      'life-fitness-cross-trainer-elevation-crosstrainer': (
        'Elevation Series crosstrainer paired with Elevation cardio floors.'
      ),
      'life-fitness-exercise-bike-indoor-bikes-ic7': (
        'IC7 indoor cycle from the Life Fitness indoor bike range.'
      ),
      'life-fitness-exercise-bike-integrity-series-bike': (
        'Integrity Series upright bike for commercial cardio rooms.'
      ),
      'life-fitness-chest-press-insignia-chest-press': 'Insignia Chest Press from the Insignia strength line.',
      'life-fitness-chest-press-signature-chest-press': 'Signature Chest Press from Signature selectorised strength.',
      'life-fitness-leg-press-signature-leg-press': 'Signature Leg Press for lower-body Signature stations.',
      'life-fitness-chest-press-optima-chest-press': 'Optima Chest Press from the Optima strength series.',
      'life-fitness-leg-press-optima-leg-press': 'Optima Leg Press for Optima commercial strength floors.',
      'life-fitness-chest-press-pro-1-chest-press': 'Pro 1 Chest Press from the Pro 1 plate-loaded / strength range.',
      'life-fitness-leg-press-pro-1-leg-press': 'Pro 1 Leg Press for Pro 1 strength rooms.',
      'life-fitness-lat-pulldown-pro-1-lat-pulldown': 'Pro 1 Lat Pulldown for back training on Pro 1.',
    }),
    buyingGuide: Object.freeze({
      title: 'What to check when buying used Life Fitness equipment',
      checkpoints: Object.freeze([
        Object.freeze({
          title: 'Series & console',
          body: (
            'Life Fitness spans commercial cardio (Integrity, Elevation, Silver Line, indoor cycles) and '
            + 'multiple strength families (Insignia, Signature, Optima, Pro). Confirm the exact series and '
            + 'model from badges and consoles before you compare prices.'
          ),
        }),
        Object.freeze({
          title: 'Cardio checks',
          body: (
            'On treadmills and cross trainers, test the console, belt or pedals through speed and incline '
            + 'or resistance, and listen for deck, roller or drive noise. Note console type — it often affects value.'
          ),
        }),
        Object.freeze({
          title: 'Strength station checks',
          body: (
            'On strength machines, inspect upholstery, cables or plate paths, selector pins and frame welds. '
            + 'Move through the full range and check that adjustments lock firmly.'
          ),
        }),
        Object.freeze({
          title: 'Usage history & transport',
          body: (
            'Ask about commercial-use history and parts completeness. For large stations, plan access and '
            + 'transport carefully and only pay through Equipd once collection or delivery terms are agreed.'
          ),
        }),
      ]),
      paragraphs: Object.freeze([
        (
          'Life Fitness spans commercial cardio (Integrity, Elevation, Silver Line, indoor cycles) and '
          + 'multiple strength families (Insignia, Signature, Optima, Pro). Confirm the exact series and '
          + 'model from badges and consoles before you compare prices.'
        ),
        (
          'On treadmills and cross trainers, test the console, belt or pedals through speed and incline '
          + 'or resistance, and listen for deck, roller or drive noise. Note console type — it often affects value.'
        ),
        (
          'On strength machines, inspect upholstery, cables or plate paths, selector pins and frame welds. '
          + 'Move through the full range and check that adjustments lock firmly.'
        ),
        (
          'Ask about commercial-use history and parts completeness. For large stations, plan access and '
          + 'transport carefully and only pay through Equipd once collection or delivery terms are agreed.'
        ),
      ]),
    }),
    valuesHeading: 'Research Life Fitness equipment values',
    valuesLede: (
      'Open a model value guide to research original RRP, production information and '
      + 'estimated used values in context — live asking prices on marketplace listings above '
      + 'may differ from guide ranges.'
    ),
    about: Object.freeze({
      title: 'About used Life Fitness equipment on Equipd',
      paragraphs: Object.freeze([
        (
          'Life Fitness is one of the most common commercial brands on UK gym floors. Equipd lists used '
          + 'Life Fitness cardio and strength for sale, with a deep catalogue of model value guides from '
          + 'Integrity and Elevation cardio through Insignia, Signature, Optima and Pro strength lines.'
        ),
        (
          'Equipd estimates used values from original RRP baselines, production years, condition and '
          + 'console options where mapped — then links you to live marketplace listings when sellers '
          + 'have Life Fitness equipment listed. Named models keep their own /equipment/… pages for '
          + 'model-level and value searches.'
        ),
      ]),
    }),
    categoryLinks: Object.freeze([
      { to: '/used-commercial-treadmills', label: 'Used commercial treadmills' },
      { to: '/used-commercial-cross-trainers', label: 'Used commercial cross trainers' },
      { to: '/used-commercial-exercise-bikes', label: 'Used commercial exercise bikes' },
      { to: '/used-commercial-indoor-cycles', label: 'Used commercial indoor cycles' },
      { to: '/used-pin-loaded-machines', label: 'Used pin-loaded machines' },
      { to: LANDING_PATHS.commercialCardio, label: 'Commercial cardio equipment' },
      { to: LANDING_PATHS.commercialStrength, label: 'Commercial strength equipment' },
      { to: LANDING_PATHS.buy, label: 'Buy used gym equipment' },
    ]),
    faqItems: Object.freeze([
      {
        question: 'Can I buy used Life Fitness equipment on Equipd?',
        answer: (
          'Yes. Equipd regularly lists used Life Fitness cardio and strength from UK sellers. Live '
          + 'listings appear on this page and in browse results filtered by Life Fitness.'
        ),
      },
      {
        question: 'What Life Fitness ranges can I research on Equipd?',
        answer: (
          'The catalogue covers commercial cardio such as Integrity, Elevation and Silver Line, indoor '
          + 'cycles, and strength families including Insignia, Signature, Optima and Pro — each with '
          + 'model pages and value guides.'
        ),
      },
      {
        question: 'Should I use this page or a specific Life Fitness model page?',
        answer: (
          'Use this brand page for general used Life Fitness / for-sale searches. For a named model '
          + '(for example Life Fitness E5) or a model value query, use that model’s /equipment/… page.'
        ),
      },
      {
        question: 'What should I check on used Life Fitness machines?',
        answer: (
          'Confirm series and console, test cardio through speed/incline or resistance, and on strength '
          + 'stations inspect pads, cables or plate paths and adjustments. Ask about commercial usage history.'
        ),
      },
      {
        question: 'Can I sell Life Fitness equipment on Equipd?',
        answer: (
          'Yes. Create a listing from a valuation or the sell flow. Equipd supports secure offers, '
          + 'handover tracking and seller payouts for eligible equipment.'
        ),
      },
    ]),
    collectionPageName: 'Used Life Fitness Equipment for Sale',
  }),

  'hammer-strength': Object.freeze({
    slug: 'hammer-strength',
    intent: 'buyer',
    h1: 'Used Hammer Strength Equipment for Sale',
    metaTitle: 'Used Hammer Strength Equipment for Sale',
    metaDescription: (
      'Browse used Hammer Strength plate-loaded equipment for sale on Equipd. Compare commercial '
      + 'strength machines, check live UK marketplace listings and model value guides.'
    ),
    lede: (
      'Find used Hammer Strength plate-loaded equipment from UK sellers and research presses, '
      + 'rows, leg stations and racks before you buy.'
    ),
    heroCta: Object.freeze({
      label: 'Browse Hammer Strength for sale',
    }),
    heroSecondaryCta: Object.freeze({
      label: 'Explore Hammer Strength values',
    }),
    searchPlaceholder: 'Search Hammer Strength equipment and models...',
    heroContextBody: (
      'Compare Hammer Strength plate-loaded stations, research values and buy with confidence from UK sellers.'
    ),
    marketplaceHeading: 'Used Hammer Strength equipment for sale',
    marketplaceHeadingEmpty: 'Looking for used Hammer Strength equipment?',
    marketplaceLede: 'Live Hammer Strength listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Hammer Strength listings right now. Browse related plate-loaded and '
      + 'commercial strength equipment, or request Hammer Strength kit — new stock appears as sellers list it.'
    ),
    modelsHeading: 'Explore Hammer Strength equipment',
    modelsLede: (
      'Equipd’s Hammer Strength catalogue is plate-loaded commercial strength. Below are commonly '
      + 'searched stations — open the full catalogue for the complete plate-loaded range.'
    ),
    modelGroups: Object.freeze([
      Object.freeze({
        id: 'lower-body',
        title: 'Lower body',
        keys: Object.freeze([
          'hammer-strength-leg-press-plateloaded-iso-lateral-leg-press',
          'hammer-strength-leg-press-plateloaded-linear-hack-squat',
          'hammer-strength-leg-press-plateloaded-linear-leg-press',
          'hammer-strength-plateloaded-belt-squat',
        ]),
      }),
      Object.freeze({
        id: 'upper-body',
        title: 'Upper body & racks',
        keys: Object.freeze([
          'hammer-strength-chest-press-plateloaded-iso-lateral-incline-press',
          'hammer-strength-bench-plateloaded-iso-lateral-bench-press',
          'hammer-strength-shoulder-press-plateloaded-iso-lateral-shoulder-press',
          'hammer-strength-row-machine-plateloaded-iso-lateral-high-row',
          'hammer-strength-lat-pulldown-plateloaded-iso-lateral-front-pulldown',
          'hammer-strength-rack-smith-machine-plateloaded-vertical-smith-machine',
        ]),
      }),
    ]),
    modelBlurbs: Object.freeze({
      'hammer-strength-leg-press-plateloaded-iso-lateral-leg-press': (
        'Iso-Lateral Leg Press — a core Hammer Strength plate-loaded lower-body station.'
      ),
      'hammer-strength-leg-press-plateloaded-linear-hack-squat': (
        'Linear Hack Squat for buyers fitting plate-loaded squat/hack movements.'
      ),
      'hammer-strength-leg-press-plateloaded-linear-leg-press': (
        'Linear Leg Press from the Hammer Strength plate-loaded leg range.'
      ),
      'hammer-strength-plateloaded-belt-squat': (
        'Belt Squat for lower-body loading without a traditional bar path.'
      ),
      'hammer-strength-chest-press-plateloaded-iso-lateral-incline-press': (
        'Iso-Lateral Incline Press for upper-chest plate-loaded training.'
      ),
      'hammer-strength-bench-plateloaded-iso-lateral-bench-press': (
        'Iso-Lateral Bench Press for flat plate-loaded pressing.'
      ),
      'hammer-strength-shoulder-press-plateloaded-iso-lateral-shoulder-press': (
        'Iso-Lateral Shoulder Press for overhead plate-loaded work.'
      ),
      'hammer-strength-row-machine-plateloaded-iso-lateral-high-row': (
        'Iso-Lateral High Row for upper-back plate-loaded pulling.'
      ),
      'hammer-strength-lat-pulldown-plateloaded-iso-lateral-front-pulldown': (
        'Iso-Lateral Front Pulldown for lat-focused plate-loaded stations.'
      ),
      'hammer-strength-rack-smith-machine-plateloaded-vertical-smith-machine': (
        'Vertical Smith machine from the Hammer Strength plate-loaded rack range.'
      ),
    }),
    buyingGuide: Object.freeze({
      title: 'What to check when buying used Hammer Strength equipment',
      checkpoints: Object.freeze([
        Object.freeze({
          title: 'Confirm the station',
          body: (
            'Hammer Strength on Equipd is plate-loaded commercial strength. Confirm the exact station '
            + '(for example Iso-Lateral Leg Press versus Linear Hack Squat) from the frame badge and photos.'
          ),
        }),
        Object.freeze({
          title: 'Frame, pads & hardware',
          body: (
            'Inspect frames, welds and paint for cracks or heavy corrosion. Check upholstery and pads, '
            + 'guide rods or plate carriages, and that weight horns and storage pegs are straight and secure.'
          ),
        }),
        Object.freeze({
          title: 'Movement path',
          body: (
            'Move the machine through its full path. Listen for grinding, check that adjustments and seat '
            + 'positions lock, and look for bent linkages or missing hardware on Iso-Lateral arms.'
          ),
        }),
        Object.freeze({
          title: 'Transport & access',
          body: (
            'These machines are heavy and often need dismantling for stairs or tight access. Agree transport '
            + 'and what plates or accessories are included before paying through Equipd.'
          ),
        }),
      ]),
      paragraphs: Object.freeze([
        (
          'Hammer Strength on Equipd is plate-loaded commercial strength. Confirm the exact station '
          + '(for example Iso-Lateral Leg Press versus Linear Hack Squat) from the frame badge and photos.'
        ),
        (
          'Inspect frames, welds and paint for cracks or heavy corrosion. Check upholstery and pads, '
          + 'guide rods or plate carriages, and that weight horns and storage pegs are straight and secure.'
        ),
        (
          'Move the machine through its full path. Listen for grinding, check that adjustments and seat '
          + 'positions lock, and look for bent linkages or missing hardware on Iso-Lateral arms.'
        ),
        (
          'These machines are heavy and often need dismantling for stairs or tight access. Agree transport '
          + 'and what plates or accessories are included before paying through Equipd.'
        ),
      ]),
    }),
    valuesHeading: 'Research Hammer Strength equipment values',
    valuesLede: (
      'Open a model value guide to research original RRP, production information and '
      + 'estimated used values in context — live asking prices on marketplace listings above '
      + 'may differ from guide ranges.'
    ),
    about: Object.freeze({
      title: 'About used Hammer Strength equipment on Equipd',
      paragraphs: Object.freeze([
        (
          'Hammer Strength is known for plate-loaded commercial strength machines. On Equipd you can '
          + 'browse used Hammer Strength equipment for sale, compare Iso-Lateral and linear stations in '
          + 'the catalogue, and use value guides when comparing asking prices.'
        ),
        (
          'Equipd estimates used values from original RRP baselines, production years and condition — '
          + 'then links you to live marketplace listings when sellers have Hammer Strength equipment listed.'
        ),
      ]),
    }),
    categoryLinks: Object.freeze([
      { to: '/used-plate-loaded-machines', label: 'Used plate-loaded machines' },
      { to: '/used-leg-press-machines', label: 'Used leg press machines' },
      { to: '/used-smith-machines', label: 'Used smith machines' },
      { to: LANDING_PATHS.commercialStrength, label: 'Commercial strength equipment' },
      { to: LANDING_PATHS.commercialGym, label: 'Commercial gym equipment' },
      { to: LANDING_PATHS.buy, label: 'Buy used gym equipment' },
    ]),
    faqItems: Object.freeze([
      {
        question: 'Can I buy used Hammer Strength equipment on Equipd?',
        answer: (
          'Yes. Equipd lists used Hammer Strength plate-loaded commercial strength from UK sellers. '
          + 'When listings are live they appear on this page and in brand-filtered browse results.'
        ),
      },
      {
        question: 'What Hammer Strength equipment does Equipd cover?',
        answer: (
          'The catalogue focuses on plate-loaded stations — Iso-Lateral presses, rows and pulldowns, '
          + 'linear leg presses and hack squats, belt squat, Smith machine and related strength pieces — '
          + 'each with a model page and value guide.'
        ),
      },
      {
        question: 'What should I check on used Hammer Strength machines?',
        answer: (
          'Confirm the exact station, inspect frame and pads, test the full movement path, and check '
          + 'guide rods, horns and adjustment locks. Plan transport carefully — these machines are heavy.'
        ),
      },
      {
        question: 'How are Hammer Strength values estimated?',
        answer: (
          'Equipd estimates used values from original RRP, manufacture year and condition. Live marketplace '
          + 'asking prices may differ from typical value-guide ranges.'
        ),
      },
      {
        question: 'Can I sell Hammer Strength equipment on Equipd?',
        answer: (
          'Yes. Create a listing from a valuation or the sell flow. Equipd supports secure offers, '
          + 'handover tracking and seller payouts for eligible equipment.'
        ),
      },
    ]),
    collectionPageName: 'Used Hammer Strength Equipment for Sale',
  }),
})
