/**
 * Equipment landing page copy — one entry per equipment category landing page.
 * Node-safe (no DOM, no imports). Shared by the React pages and build-time prerender.
 *
 * Keys are page ids. Every entry is unique UK-English copy for a single machine
 * type: commercial pages are written for facility duty cycles, home pages for
 * domestic space, noise and power.
 */

export const EQUIPMENT_LANDING_COPY = Object.freeze({
  'used-commercial-treadmills': Object.freeze({
    eyebrow: 'Facility-grade running, without the new price',
    h1: 'Used Commercial Treadmills',
    lead: 'Compare used commercial treadmills listed by gyms, dealers and refurbishers across the UK. Equipd is the marketplace rather than the seller — pay securely by card, get Buyer Protection on eligible purchases, and check any model with a free Instant Valuation before you commit.',
    metaTitle: 'Used Commercial Treadmills for Sale UK | Equipd',
    metaDescription:
      'Buy used commercial treadmills from UK gyms, dealers and refurbishers. Compare hours, decks and consoles, then pay securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial treadmills',
    searchLabel: 'Search commercial treadmills',
    listingsHeading: 'Live commercial treadmill listings',
    listingsLead:
      'Ex-facility and refurbished commercial treadmills currently listed on Equipd, from single units to full banks being cleared during a gym refit.',
    listingsCta: 'Browse all commercial treadmills',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'Treadmills rarely go in on their own. Most operators balance the running line with bikes, cross trainers, rowers and climbers so the busiest stations are not the only stations.',
    brandLead:
      'Life Fitness, Technogym, Precor, Matrix, Star Trac and Woodway decks all appear regularly on the used market. Service coverage and parts availability vary more between generations than the badge on the console suggests, so it is worth checking both.',
    benefitsHeading: 'Why buy used commercial treadmills on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'ex-facility-supply',
        title: 'Ex-facility stock in one place',
        body: 'Gyms refitting a cardio line, dealers with trade-in decks and refurbishers with tested units all list on Equipd, so you can compare what is genuinely available in the UK rather than tracking half a dozen sites and auction alerts.',
      }),
      Object.freeze({
        id: 'specification-for-budget',
        title: 'More specification per pound',
        body: 'A used commercial deck usually costs a fraction of new list price, which is often the difference between a home-rated machine that will not survive a paying floor and a proper continuous-duty treadmill that will.',
      }),
      Object.freeze({
        id: 'buyer-protection',
        title: 'Buyer Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover. Eligible purchases then have a short protection window in which you can raise a significant issue with evidence, which matters on a machine with moving parts you cannot fully judge from photographs.',
      }),
      Object.freeze({
        id: 'valuation-first',
        title: 'Free valuation before you offer',
        body: 'Run the exact model through the free Instant Valuation to see a market range based on age and condition. It is a far better reference than the original list price of a deck that has since covered thousands of miles.',
      }),
    ]),
    valuationEyebrow: 'Replacing a running line?',
    valuationHeading: 'Value a commercial treadmill before you buy or sell',
    valuationCopy:
      'Treadmill values move quickly with hours, deck condition and console generation, so a headline asking price tells you very little on its own. The free Equipd valuation uses the model, year and condition to show what comparable commercial decks are actually achieving in the UK — useful whether you are negotiating on a purchase or pricing a bank of machines you are clearing.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the treadmill model and generation' }),
      Object.freeze({ label: 'Details', body: 'Add the year, console type and hours' }),
      Object.freeze({ label: 'Estimate', body: 'See the current UK market range' }),
      Object.freeze({ label: 'Decide', body: 'Offer, list or keep looking', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial treadmill buying guide',
    guideIntro:
      'Treadmills are the hardest-working machines on almost every gym floor and the first thing members complain about when one goes out of service. They are also where buying used saves the most money, because a well-maintained commercial deck has a long working life and the parts that wear are designed to be replaced. The risk sits in the detail: a glazed belt, a deck that has already been flipped twice, a discontinued console, or a bank of machines sharing a circuit that trips as soon as the floor gets busy. This guide covers specifying the right deck for your duty cycle, reading hours honestly, the faults that actually cost money, footprint and power, servicing and consumables, how the major brands differ on parts support, and how to handle transport and inspection so you find problems before you pay rather than afterwards.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'specifying',
        heading: 'Specifying a commercial treadmill for your duty cycle',
        paragraphs: Object.freeze([
          'Start with the motor. Commercial treadmills are rated in continuous-duty horsepower rather than peak output, and a genuine facility machine will typically sit around 3hp continuous or above. Larger AC motors are the traditional choice for high-throughput sites because they run cooler under sustained load, while DC motors are quieter and cheaper to replace. Either can be right; what matters is that the rating suits how many hours a day the machine will actually run.',
          'Then look at the deck and belt. Running surface length drives who can use the machine comfortably — a shorter deck is fine for walking programmes but taller members sprinting will run out of belt. Most commercial decks are reversible and multi-layered, and better machines suspend them on elastomer or spring systems to reduce joint loading. Ask what the running surface measures on the specific model rather than assuming a family specification applies.',
          'Incline and speed range should match your programming. A standard commercial deck will reach around 20-25 km/h with incline to roughly 15%, which covers general membership use. If you run performance testing, sled-push or rehab protocols, you may want decline capability, a higher incline range or a slat-belt machine — all of which command a premium used and are worth paying for only if you will genuinely programme them.',
          'Finally, be honest about console requirements. Entertainment touchscreens look impressive but they are the most expensive part to replace, may rely on a platform the manufacturer has since retired, and often need network configuration nobody at the site has time for. A simple LED console on a mechanically excellent deck is frequently the better buy for a busy floor.',
        ]),
      }),
      Object.freeze({
        id: 'hours-and-lifespan',
        heading: 'Hours, mileage and realistic remaining life',
        paragraphs: Object.freeze([
          'Hours matter far more than the year of manufacture. A treadmill from a quiet hotel gym can be a decade old with modest use, while one from a 24-hour city club can be three years old and thoroughly worked. Almost every commercial console will show hours or accumulated distance in a service or engineer menu, so ask the seller to photograph that screen.',
          'As a rough frame of reference, a quality commercial deck is engineered for many thousands of hours of running, with the belt, deck surface and rollers treated as consumables along the way. The frame, motor and incline mechanism usually outlast several sets of consumables, which is exactly why a high-hour machine with a documented service history can be a safer purchase than a low-hour one that has sat in a damp store since a gym closed.',
          'Ask where the machine lived. Hotels, corporate gyms, schools and rehab clinics are generally gentler environments than budget chains and university sports centres. That context tells you more about the remaining life than any single number, and a serious commercial seller will be able to answer it without hesitation.',
          'Treat vagueness as pricing information. If nobody can say where a deck came from, roughly what it has done, or when it was last serviced, you are carrying more risk and the price should reflect that. Use the free valuation to establish the range for the model in good order, then adjust downwards for the unknowns.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults on used commercial treadmills',
        paragraphs: Object.freeze([
          'Belt and deck wear is the most common issue and the easiest to miss in photographs. Run your hand along the belt surface: a glazed, shiny patch in the walking zone means the belt is worn and the deck underneath probably is too. Ask directly whether the deck has already been flipped, because a twice-used deck has no life left and replacement is a meaningful cost on some models.',
          'Slipping and tracking problems point to tension, roller or drive-belt issues. Have someone walk on the belt at speed while you watch whether it hesitates under foot strike and whether it drifts towards one side. Minor tracking drift is an adjustment; a belt that repeatedly wanders after adjustment usually means a worn roller or a frame that has been knocked out of alignment during a previous move.',
          'Listen to the machine at several speeds and on incline. A rhythmic slap often indicates a belt joint or a flat-spotted roller, grinding suggests roller or motor bearings, and a squeal frequently comes from the drive belt. Incline faults are their own category — run the incline through its full range and back, since a lift motor that stalls or a jammed incline frame is a common reason machines get retired early.',
          'Electronics and corrosion are the quiet problems. Sweat is corrosive, so look under the console shroud, around the base and behind side covers for green or white residue on connectors. Surface rust on a frame is cosmetic; corrosion around electrical connections, the incline motor or the control board is a genuine warning sign and often explains an intermittent fault the seller describes as "just needs resetting".',
        ]),
      }),
      Object.freeze({
        id: 'space-and-power',
        heading: 'Footprint, run-off space and electrical supply',
        paragraphs: Object.freeze([
          'Get the exact dimensions for the specific model and remember that the manufacturer footprint is not the usable footprint. A commercial deck is typically around 2.1m long and 0.9m wide, but you also need clear run-off behind the machine for safety, plus enough side clearance for members to mount and dismount without colliding with the next station. Squeezing the gaps is the most common layout mistake on a refit.',
          'Measure the whole route in before you buy. Doorway widths, corridor turns, stair angles, lift dimensions and lift weight limits all matter, and the tightest point decides whether the machine arrives — it is rarely the front door. Ask what comes off for transit, because consoles, uprights and handrails are often removable and a deck that will not fit assembled frequently will once it is partly stripped.',
          'Think about floor loading and matting, particularly above ground level. A row of commercial treadmills at 180-230kg each is a serious point load, and a mezzanine or upper-floor installation sometimes warrants a structural opinion. Proper matting protects the floor, reduces vibration transfer and cuts the noise that travels into rooms below.',
          'Power is where treadmill projects go wrong. Commercial decks draw meaningful current under load, and several on one shared circuit will trip breakers exactly when the floor is busiest. Confirm the requirement for each model, plan socket positions before delivery rather than after, and have an electrician confirm the load if you are adding a bank of machines. Trailing extension leads across a gym floor are both a trip hazard and a compliance problem.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Servicing, consumables and running costs',
        paragraphs: Object.freeze([
          'Build a treadmill into your maintenance schedule from day one. Belt tension and tracking, deck condition, drive-belt inspection, roller bearings, motor cleaning and electrical testing are the routine items, and doing them on a planned cycle is dramatically cheaper than reacting to failures during peak hours.',
          'Keep the machine clean, and not just cosmetically. Dust and carpet fibres pulled in under the belt accelerate deck wear, and a motor compartment packed with debris runs hot. Vacuuming under the motor cover and around the deck at planned intervals is one of the highest-value maintenance jobs on any treadmill.',
          'Know which consumables you are responsible for. Belts, decks, rollers and drive belts wear out by design; some models specify deck lubrication and others use permanently lubricated surfaces where adding lubricant causes problems, so follow the manufacturer specification for that model rather than a general rule.',
          'Line up a service relationship before you buy, not after the first breakdown. Whether that is the manufacturer, a national service company or a local independent engineer, knowing who will attend and roughly what a call-out and common parts cost should shape what you are prepared to pay. Budgeting a first service straight after installation is the cheapest way to find problems while you still have options.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-parts',
        heading: 'Brand differences and parts availability',
        paragraphs: Object.freeze([
          'The main commercial names differ less in headline quality than in how they are supported. Life Fitness and Precor decks are widely serviced in the UK with strong independent parts supply, Technogym machines are excellently built but more often routed through official channels, and Matrix and Star Trac sit in between with good availability on recent generations.',
          'Specialist decks are a separate decision. Slat-belt machines such as Woodway are exceptionally durable and popular for performance work, but they are heavy, expensive used and serviced by a smaller pool of engineers. That is a fair trade for a performance facility and a poor one for a small studio that just needs three reliable stations.',
          'Check parts for the exact generation rather than the brand. Manufacturers support equipment for years but individual console and control-board revisions do get discontinued, and a five-minute call to a parts supplier will tell you whether the belt, deck, roller and board for that specific unit are still stocked.',
          'Where possible, favour the brands your local engineers already carry parts for. A slightly less prestigious deck that can be back in service the same week usually beats a premium machine waiting three weeks for a board from overseas, especially if it is one of only a few treadmills on your floor.',
        ]),
      }),
      Object.freeze({
        id: 'transport-refurb-inspection',
        heading: 'Refurbished or as-seen, transport, and inspecting before you pay',
        paragraphs: Object.freeze([
          'Decide early whether you want refurbished or as-seen. Refurbished should mean a technician has replaced consumables, corrected faults, cleaned and tested the machine — but the word is not regulated, so ask for the list of parts replaced and any test report and keep that detail in Equipd messages alongside the listing. As-seen suits buyers with an engineer available who can price a belt and a bearing honestly.',
          'Plan transport before payment. Equipd does not run a delivery fleet, so collection, seller delivery or a buyer-arranged courier is agreed directly between buyer and seller. Commercial treadmills are heavy, top-heavy once tilted and easy to damage, so specialist gym equipment movers with the right trolleys and straps are usually worth the cost. Agree who dismantles, who reassembles and who keeps the fixings.',
          'Inspect in person wherever the value justifies the trip. Photographs will not reveal a bearing rumble, a belt that hesitates under load or a console that resets on incline. Run the machine for several minutes with someone on the belt, take it through the full speed and incline range, and test the emergency stop and safety key rather than assuming they work.',
          'Work through a consistent checklist and photograph what you find: console and key function, emergency stop, belt tracking and tension, belt surface condition, deck flip status, noise at speed and on incline, motor and incline response, frame corrosion, missing covers or bolts, and the serial plate. If you cannot attend, ask for a video of the machine running with the console and serial number visible — a confident seller will not object.',
          'Only confirm handover once you are satisfied. Confirmation is what starts the post-handover Buyer Protection window on eligible purchases, so inspect first and confirm second, never the other way round because a driver is waiting.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Practical answers on hours, decks, consoles, power supply, delivery and Buyer Protection when buying a used commercial treadmill through Equipd.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'How many hours is too many on a used commercial treadmill?',
        answer:
          'There is no single cut-off, because commercial decks are designed around replaceable consumables. A high-hour machine with documented servicing and a recently replaced belt and deck is often a better buy than a low-hour one with no history. Ask for the hours reading from the console service menu, then judge it alongside the service record and the condition of the belt, deck and rollers.',
      }),
      Object.freeze({
        question: 'What does it mean if the deck has already been flipped?',
        answer:
          'Most commercial treadmill decks are reversible, so when one side wears the engineer turns it over to use the fresh face. A flipped deck means roughly half the deck life has gone; a twice-flipped deck needs replacing. Always ask directly, because it is not visible in photographs and deck replacement is a significant cost on some models.',
      }),
      Object.freeze({
        question: 'Do commercial treadmills need a dedicated electrical circuit?',
        answer:
          'They draw far more current than any other cardio machine and several on a shared circuit will trip breakers during busy periods. Confirm the stated power requirement for the specific model and have an electrician assess your supply before installing a bank of decks. Plan socket positions in advance, as retro-fitting them once machines are in place is disruptive and more expensive.',
      }),
      Object.freeze({
        question: 'Is an AC or DC motor better on a used commercial treadmill?',
        answer:
          'Both are used in genuine commercial machines. Larger AC motors traditionally suit the highest-throughput sites because they run cool under sustained load, while DC motors are quieter and generally cheaper to replace. What matters more is the continuous-duty rating, the condition of the motor and whether replacement parts are still available for that generation.',
      }),
      Object.freeze({
        question: 'How much space does a commercial treadmill actually need?',
        answer:
          'Allow for the machine footprint, which is commonly around 2.1m by 0.9m, plus clear run-off space behind it and side clearance for mounting and dismounting. Also check ceiling height for taller members using incline, and measure doorways, corridor turns, stairs and lifts on the route in, since the tightest point decides whether delivery is possible.',
      }),
      Object.freeze({
        question: 'Can I put a commercial treadmill in a home or garage gym?',
        answer:
          'Yes, and many people do because the build quality is far higher than home machines at the same price. The obstacles are practical: weight of 180kg or more, an awkward route in, floor loading upstairs, and a power draw that needs checking against your consumer unit. If space and access are tight, a home-rated folding treadmill may suit better.',
      }),
      Object.freeze({
        question: 'What noises should make me walk away from a treadmill?',
        answer:
          'Persistent grinding usually means roller or motor bearings, a rhythmic slap points to a belt joint or flat-spotted roller, and a stalling or clunking incline mechanism is a common reason machines are retired. Any of these can be repaired, but they should be priced in before you buy rather than discovered after delivery.',
      }),
      Object.freeze({
        question: 'Is a touchscreen console worth paying extra for on a used deck?',
        answer:
          'Only if you will genuinely use it. Entertainment consoles are the most expensive component to replace, may depend on streaming or TV platforms the manufacturer has since retired, and often need network configuration. Confirm exactly what still works today rather than what worked when the machine was new, and price a replacement console before you commit.',
      }),
      Object.freeze({
        question: 'How should a used commercial treadmill be transported?',
        answer:
          'Use movers experienced with gym equipment. Commercial decks are heavy and become top-heavy when tilted for stairs, which is how frames get twisted and consoles get cracked. Agree in advance who dismantles at the seller end, who reassembles at yours and who is responsible for the fixings, because half-finished handovers are a frequent source of disputes.',
      }),
      Object.freeze({
        question: 'Does Buyer Protection cover a treadmill that develops a fault later?',
        answer:
          'Buyer Protection is a short window after you confirm handover in which you can raise a significant issue with supporting evidence for Equipd to review on eligible purchases. It is not a warranty against future wear. That is why you should run the machine thoroughly before confirming, and get any seller warranty terms in writing since those are agreements directly with that seller.',
      }),
    ]),
    midCtaHeading: 'Ready to compare commercial treadmills?',
    midCtaLead:
      'See what UK gyms, dealers and refurbishers are listing right now, from single decks to complete running lines.',
    midCtaLabel: 'Browse Commercial Treadmills',
    exploreLead:
      'Keep going with related commercial cardio categories, brand pages and the marketplace guides that explain how buying and selling on Equipd works.',
    heroTrustItems: Object.freeze([
      'Ex-facility and refurbished stock',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-commercial-exercise-bikes': Object.freeze({
    eyebrow: 'The quiet workhorses of a cardio floor',
    h1: 'Used Commercial Exercise Bikes',
    lead: 'Browse used commercial upright and recumbent exercise bikes from gyms, dealers and refurbishers across the UK. Equipd hosts the marketplace — secure card payment, Buyer Protection on eligible purchases, and a free Instant Valuation so you know what a model is really worth.',
    metaTitle: 'Used Commercial Exercise Bikes for Sale | Equipd',
    metaDescription:
      'Used commercial upright and recumbent exercise bikes from UK sellers. Compare condition and consoles, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial exercise bikes',
    searchLabel: 'Search commercial exercise bikes',
    listingsHeading: 'Live commercial exercise bike listings',
    listingsLead:
      'Upright and recumbent commercial bikes listed on Equipd by UK gyms, leisure operators, dealers and refurbishers, often in matched groups from a single floor.',
    listingsCta: 'Browse all commercial exercise bikes',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'Bikes are the lowest-maintenance stations on most floors. Pair them with treadmills, cross trainers and rowers to spread demand and give members a low-impact option when the running line is full.',
    brandLead:
      'Life Fitness Lifecycle, Technogym, Precor, Matrix and Cybex bikes dominate the UK used market. Frames and drives are broadly similar in quality across the group, so upholstery condition, console generation and parts support usually decide which is the better buy.',
    benefitsHeading: 'Why buy used commercial exercise bikes on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'matched-groups',
        title: 'Matched groups from single floors',
        body: 'Because operators tend to replace bikes as a set, Equipd listings often include several identical units. Buying a matched group keeps a floor looking deliberate and means one set of spares and one service procedure covers every station.',
      }),
      Object.freeze({
        id: 'low-running-cost',
        title: 'The cheapest commercial cardio to run',
        body: 'Bikes have far fewer wear parts than treadmills, and most commercial models are self-powered so they need no socket at all. Lower maintenance and no electrical work makes them the easiest way to add reliable stations to a floor.',
      }),
      Object.freeze({
        id: 'secure-payment',
        title: 'Secure payment, not a bank transfer',
        body: 'Pay by card through Equipd with Stripe handling the transaction, so funds are held until handover is confirmed. Eligible purchases carry Buyer Protection, which is reassurance you simply do not get transferring money to an unknown seller.',
      }),
      Object.freeze({
        id: 'price-check',
        title: 'Check the asking price in minutes',
        body: 'Used bike prices vary widely with console generation and upholstery condition. The free Instant Valuation gives you a market range for the specific model so you can tell a fair price from an optimistic one before you make an offer.',
      }),
    ]),
    valuationEyebrow: 'Rotating a bike fleet?',
    valuationHeading: 'Value commercial exercise bikes before you trade',
    valuationCopy:
      'A group of bikes coming off a floor is often worth more than operators expect, and individual units are often listed for less than they should be. Use the free Equipd valuation on the exact model to see the current UK range based on year and condition, then price a whole group with confidence or negotiate a single purchase from a defensible position.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Pick the upright or recumbent model' }),
      Object.freeze({ label: 'Details', body: 'Note the year, console and upholstery' }),
      Object.freeze({ label: 'Estimate', body: 'See what comparable bikes achieve' }),
      Object.freeze({ label: 'Decide', body: 'Buy the group or list your own', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial exercise bike buying guide',
    guideIntro:
      'Commercial exercise bikes are the most forgiving used purchase on a cardio floor. There is no belt to glaze, no deck to flip and usually no mains supply to worry about, so a bike that has been looked after can go straight back into service for years. That does not make them risk-free: split upholstery, a seized seat carriage on a recumbent, a failed generator or a resistance system that no longer changes under load will all irritate members every single session. This guide covers choosing between upright and recumbent, judging condition and remaining life, the faults that actually appear on used bikes, footprint and placement, maintenance and consumables, how brands differ on parts and comfort, and how to inspect and move bikes so you are not repairing them the week they land.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'upright-or-recumbent',
        heading: 'Choosing between upright and recumbent bikes',
        paragraphs: Object.freeze([
          'Upright bikes suit general membership use. They take up less floor space, feel familiar to anyone who has ridden a bicycle, and work well in a bank alongside treadmills and cross trainers. They are also the easier sell to members who want a quick twenty minutes rather than a structured session.',
          'Recumbent bikes earn their larger footprint through accessibility. The supported back, step-through frame and seated position suit older members, people returning from injury, larger users and anyone who finds a standard saddle uncomfortable. If you have a physiotherapy relationship, a GP referral scheme or an older membership profile, recumbents will be among the busiest stations you own.',
          'Note that neither is a studio bike. Upright and recumbent commercial bikes use enclosed magnetic or eddy-current resistance and a moderate flywheel, designed for steady seated work and programmed intervals rather than standing out of the saddle. If you want group cycling with a heavy flywheel and out-of-saddle riding, indoor cycles are a different category and should be bought as such.',
          'A sensible mix for a general gym is roughly two-thirds upright and one-third recumbent, adjusted from your own usage data. Buying a couple of each and watching which fill first is a legitimate strategy on the used market, because the outlay is low enough to correct without pain.',
        ]),
      }),
      Object.freeze({
        id: 'condition-and-life',
        heading: 'Judging condition and remaining life',
        paragraphs: Object.freeze([
          'Commercial bikes are long-lived because the drive is simple: a belt, a flywheel, sealed bearings and a resistance unit with no contact wear. The frame will often outlast two or three sets of upholstery, which means the parts you can see are usually the best guide to how the machine has been treated.',
          'Look at the saddle, backrest and grips first. Split vinyl, compressed foam and worn handlebar grips tell you the bike has done real work, and they are also the parts members judge you on. Replacement pads and saddles are available for major brands and are not expensive, but on a group of ten bikes the cost adds up and should be reflected in what you pay.',
          'Check the console generation for parts and batteries. Many self-powered commercial bikes run the display from a generator with a backup battery, and a console that only wakes when you pedal hard is often a tired battery rather than a failed board. Confirm what the display shows, whether the resistance keys respond and whether heart-rate contacts read anything sensible.',
          'Ask about the environment as well as the age. Bikes in a spin studio or a poorly ventilated room take a sweat beating that dry, air-conditioned floors do not, and sweat corrosion around the seat post, frame welds and console fixings is the main thing that ages a bike prematurely.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults on used commercial bikes',
        paragraphs: Object.freeze([
          'Resistance that does not change is the fault that matters most. Cycle through the full resistance range while pedalling and confirm you can feel each step. If nothing changes, the cause is usually the resistance unit, its control cable or wiring, or the console itself — all repairable, but worth pricing before you buy.',
          'Seat and post problems are extremely common. On uprights, check that the seat post slides freely and locks solidly, since a seized or scored post is a daily annoyance and a wobbly one is a safety issue. On recumbents, the seat carriage runs on rollers and a rail — slide it through its whole range listening for grinding and looking for scoring, because a sticky carriage puts members off the machine entirely.',
          'Turn the pedals slowly by hand and then ride the bike. Bearing rumble, a knocking bottom bracket, lateral play in the crank arms and worn pedal threads are all findable in a minute. Pedals and straps are cheap consumables; a damaged crank thread or a failing bottom bracket is a proper repair.',
          'Finally, look for the cosmetic damage that never gets fixed: cracked shrouds, missing covers, scuffed frame paint and broken bottle holders. None of it stops the bike working, but a floor of visibly tired machines undermines the impression the rest of your investment is trying to create, and it is legitimate negotiating material.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-placement',
        heading: 'Footprint, placement and access',
        paragraphs: Object.freeze([
          'Uprights are compact — commonly around 1.1m long by 0.6m wide — which is why they are the easiest cardio to fit into an awkward corner or a narrow mezzanine. Recumbents are considerably longer, often approaching 1.7m, and need clear space at the front for the step-through entry to be usable rather than theoretical.',
          'Leave real access space between units. Members need to mount, adjust the seat and dismount without knocking the next bike, and staff need to get round to clean and service. A row packed at the minimum spacing looks efficient on a plan and feels cramped in use.',
          'Because most commercial bikes are self-powered, placement is genuinely flexible. No socket means you can put them along a window wall, in a studio corner or upstairs without any electrical work, which is a real advantage over treadmills when you are working around a fixed building.',
          'Access in is rarely the problem it is with larger cardio. Bikes are lighter and narrower than treadmills, often with removable seats or pedals, and most will go through a standard doorway and up a staircase with two people. Still measure lift dimensions if you are going to an upper floor with a group of them, since it is the number of trips rather than the size that catches people out.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance, consumables and upholstery',
        paragraphs: Object.freeze([
          'Routine bike maintenance is modest: keep the frame and console clean with a non-abrasive cleaner, check pedal and crank tightness, inspect the drive belt tension, test resistance through its range and confirm seat adjustment operates smoothly. Doing that on a monthly cycle will catch nearly everything before it becomes a fault.',
          'Sweat is the enemy, so cleaning is maintenance rather than presentation. Wipe down the frame, seat post and console area daily, and pay attention to the areas members do not — under the saddle, around the seat clamp and behind the console — where corrosion starts.',
          'Treat upholstery as a planned consumable. Recovering or replacing saddles and backrests every few years keeps a used fleet looking current for a fraction of the cost of replacing machines, and it is the single most effective thing you can do to make ex-facility bikes look like a deliberate purchase.',
          'Keep a small spares stock if you run a group of identical bikes: pedals, straps, a saddle, console batteries and a drive belt. Because commercial bikes fail rarely but always at an inconvenient moment, a shelf of common parts turns a week out of service into an hour.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-parts',
        heading: 'Brand differences and what parts support looks like',
        paragraphs: Object.freeze([
          'Life Fitness Lifecycle bikes are probably the most common commercial units in the UK, which is an advantage on the used market: engineers know them, parts are widely stocked and there is a deep supply of both uprights and recumbents to compare.',
          'Technogym bikes are beautifully finished with excellent ergonomics and hold value well, though parts and console support are more often routed through official channels. Precor is particularly well regarded for recumbent comfort and biomechanics, and its bikes are usually well supported by independent engineers.',
          'Matrix and Cybex offer strong value used, with sensible mechanical design and reasonable parts availability on recent generations. Older units from any brand can hit obsolete console revisions, so it is worth checking the specific generation rather than trusting the badge.',
          'Because bikes are mechanically simple, brand matters less here than on treadmills or climbers. Prioritise physical condition, upholstery, a working resistance system and available consumables over the badge, and favour whatever your local engineer can already get parts for.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-transport',
        heading: 'Inspecting, refurbishing and getting bikes delivered',
        paragraphs: Object.freeze([
          'Ride every bike before you agree a price. Two minutes per machine through the full resistance range, standing and seated, with the console watched throughout, will find almost every fault worth knowing about. Check the emergency behaviour too: the machine should coast down predictably rather than lock up.',
          'Use a consistent checklist across a group: console wakes and holds a display, resistance steps are all felt, no bearing noise or crank play, pedals and straps sound, seat post or carriage moves and locks, upholstery condition, shrouds intact, frame free of corrosion, and the serial plate present. Photograph each unit individually so there is no confusion about which bike was which after delivery.',
          'Refurbished bikes typically arrive with new upholstery, replaced pedals and a serviced drive, which is often excellent value given how much of a bike buyer\'s impression comes from those parts. Ask specifically what was done, since "refurbished" applied to a bike sometimes means little more than a thorough clean.',
          'Transport is straightforward but plan it anyway. Fulfilment on Equipd is agreed between buyer and seller — collection, seller delivery or a buyer-arranged courier — and bikes travel well on a van with blankets and straps. Confirm whether pedals or seats have been removed and that the fixings are bagged, then inspect on arrival and only confirm handover once you have ridden the machines, because confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Answers on choosing between upright and recumbent bikes, checking resistance and upholstery, and how payment and Buyer Protection work on Equipd.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What is the difference between an upright and a recumbent exercise bike?',
        answer:
          'An upright bike puts the rider over the pedals in a conventional cycling position and takes up little floor space. A recumbent seats the rider in a supported, reclined position with the pedals in front, which suits older members, rehab clients and larger users. Recumbents need considerably more length, commonly approaching 1.7m plus entry space.',
      }),
      Object.freeze({
        question: 'Are commercial exercise bikes the same as spin bikes?',
        answer:
          'No. Upright and recumbent commercial bikes use enclosed magnetic or eddy-current resistance for seated, programmed work. Indoor cycles, often called spin or studio bikes, have a heavy flywheel and are designed for out-of-saddle group riding. If you are equipping a studio for classes, buy indoor cycles rather than uprights.',
      }),
      Object.freeze({
        question: 'Do commercial exercise bikes need to be plugged in?',
        answer:
          'Most commercial uprights and recumbents are self-powered, generating console power from the rider, so they need no socket at all. Some models with entertainment screens or always-on displays do require mains power. Check the specific unit, because self-powered machines are far easier to place and need no electrical work.',
      }),
      Object.freeze({
        question: 'How do I test the resistance on a used commercial bike?',
        answer:
          'Pedal the bike and step through the whole resistance range, confirming that each level feels different and that the change happens promptly. If resistance does not respond, the cause is usually the resistance unit, its wiring or the console. Also ride it under load for a minute or two, as some faults only appear once the generator is working properly.',
      }),
      Object.freeze({
        question: 'Is worn upholstery a reason to reject a used bike?',
        answer:
          'Not usually, but it should affect the price. Saddles, backrests and grips are consumables and replacements are available for the main commercial brands. On a single bike it is a minor cost; across a group of ten it is significant, so quote it in your offer rather than absorbing it after delivery.',
      }),
      Object.freeze({
        question: 'What should I check on a recumbent bike specifically?',
        answer:
          'Slide the seat carriage through its full travel listening for grinding and looking for scored rails or flat-spotted rollers, then confirm it locks firmly at each position. Also check the step-through frame is undamaged and the backrest adjustment works, since a stiff or noisy carriage is the most common reason members avoid a particular recumbent.',
      }),
      Object.freeze({
        question: 'How long do commercial exercise bikes last?',
        answer:
          'Longer than most cardio, because the drive has few contact-wear parts. Frames and resistance units commonly outlast several sets of upholstery, pedals and drive belts. Sweat corrosion and console obsolescence tend to retire a commercial bike before the mechanics do, which is why cleaning history matters more than headline age.',
      }),
      Object.freeze({
        question: 'Can I buy a matched set of bikes from one gym?',
        answer:
          'Often yes. Operators usually replace bikes as a fleet, so Equipd listings frequently cover several identical units from the same floor. Buying a matched group simplifies spares and servicing and gives a more coherent look, and sellers clearing a floor are often more flexible on price for the whole group.',
      }),
      Object.freeze({
        question: 'What spares should I keep for a used bike fleet?',
        answer:
          'For a group of identical machines, a spare pair of pedals and straps, one saddle or seat pad, console batteries and a drive belt will cover the majority of unplanned issues. Bikes rarely fail, but when one does the spare shelf is the difference between an hour out of service and a fortnight waiting for a part.',
      }),
      Object.freeze({
        question: 'How does payment work when buying several bikes at once?',
        answer:
          'You agree the order with the seller and pay by card through Equipd, with funds held until handover is confirmed. Inspect and ride every machine before confirming, because confirmation is what starts the Buyer Protection window on eligible purchases. Keep the specification of what was agreed, including any upholstery work, in Equipd messages.',
      }),
    ]),
    midCtaHeading: 'Looking for commercial bikes?',
    midCtaLead:
      'Compare upright and recumbent commercial exercise bikes listed by UK gyms, dealers and refurbishers, including matched groups from single floors.',
    midCtaLabel: 'Browse Commercial Exercise Bikes',
    exploreLead:
      'Carry on into related cardio categories, the brands behind most UK bike fleets, and guides on how buying, selling and valuing works on Equipd.',
    heroTrustItems: Object.freeze([
      'Upright and recumbent stock',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-commercial-cross-trainers': Object.freeze({
    eyebrow: 'Low impact, high throughput',
    h1: 'Used Commercial Cross Trainers',
    lead: 'Find used commercial cross trainers and ellipticals from gyms, dealers and refurbishers throughout the UK. Equipd runs the marketplace, with secure payments, Buyer Protection on eligible purchases and a free Instant Valuation to sense-check any asking price.',
    metaTitle: 'Used Commercial Cross Trainers for Sale | Equipd',
    metaDescription:
      'Used commercial cross trainers and ellipticals from UK gyms and dealers. Check ramps and rollers, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial cross trainers and ellipticals',
    searchLabel: 'Search commercial cross trainers',
    listingsHeading: 'Live commercial cross trainer listings',
    listingsLead:
      'Commercial ellipticals and cross trainers listed on Equipd by UK operators, dealers and refurbishers, from single stations to whole rows coming off a refit.',
    listingsCta: 'Browse all commercial cross trainers',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'Cross trainers pull members away from a busy running line. Balance them with treadmills, bikes, rowers and climbers so no single machine type becomes the bottleneck at peak times.',
    brandLead:
      'Precor, Life Fitness, Technogym, Matrix and Cybex all build ellipticals with distinctly different feels. Stride path and ramp design vary far more between these brands than between treadmills, so it is worth trying a machine before you commit to a row of them.',
    benefitsHeading: 'Why buy used commercial cross trainers on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'compare-feel',
        title: 'Compare brands, not just prices',
        body: 'Ellipticals differ enormously in stride feel. Because Equipd brings ex-facility and dealer stock together, you can compare a Precor against a Life Fitness or Technogym at used money instead of committing to whichever one a single supplier happens to hold.',
      }),
      Object.freeze({
        id: 'durable-mechanics',
        title: 'Mechanically simple, built to last',
        body: 'With no belt or deck to wear, a commercial elliptical\'s life is largely a matter of ramps, rollers, bearings and bushings — all replaceable parts. A well-serviced used machine can give many more years of member use.',
      }),
      Object.freeze({
        id: 'buyer-protection',
        title: 'Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with a Buyer Protection window afterwards on eligible orders. Useful on a machine where a worn roller or a tired pivot is easy to hide in a static photograph.',
      }),
      Object.freeze({
        id: 'valuation',
        title: 'Know the market range first',
        body: 'The free Instant Valuation shows what comparable ellipticals are achieving in the UK by model, year and condition, so you can judge whether an asking price reflects the machine in front of you.',
      }),
    ]),
    valuationEyebrow: 'Clearing older ellipticals?',
    valuationHeading: 'Value cross trainers before you list or offer',
    valuationCopy:
      'Cross trainer values depend heavily on generation, ramp and roller condition and console type, which is why two apparently similar machines can be worth very different money. Run the model through the free Equipd valuation to see a market range built from the year and condition, then use it to price a group you are clearing or to support an offer on one you want.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the elliptical model and generation' }),
      Object.freeze({ label: 'Details', body: 'Add year, console and ramp condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the comparable UK range' }),
      Object.freeze({ label: 'Decide', body: 'Negotiate, list or move on', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial cross trainer buying guide',
    guideIntro:
      'Cross trainers are the low-impact option that keeps a cardio floor working when the treadmills are full, and on the used market they are one of the better value purchases in the category. There is no belt to glaze and no deck to flip, so a machine that has been properly maintained can go straight back into service. The wear that matters is subtler: ramps and rollers that have gone slightly out of shape, pivot bushings with a few millimetres of play, and articulating footplates that creak on every stride. None of that shows in a photograph, and all of it is what members notice. This guide covers stride path and specification, the faults worth hunting for, footprint and headroom, servicing, how brands genuinely differ, remaining life and refurbishment, and how to inspect and move a machine that is heavier and more awkward than it looks.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'stride-and-spec',
        heading: 'Stride path, drive position and specification',
        paragraphs: Object.freeze([
          'The single biggest difference between ellipticals is the stride path, and it is the thing members feel immediately. Stride length on commercial machines typically sits around 50 to 56cm, and a machine at the short end will feel cramped to taller users while an unusually long stride can feel awkward for shorter ones. If you can only buy one row, choose a path that suits the widest range of members rather than the most impressive on paper.',
          'Drive position changes the feel and the maintenance. Rear-drive machines tend to give a flatter, more natural stride and put the flywheel behind the user; front-drive machines are usually more compact and often use a ramp and roller arrangement that becomes the primary wear point. Centre-drive designs shorten the footprint further. All three are legitimate; know which you are buying and where its wear will appear.',
          'Consider adjustable versus fixed geometry. Some commercial machines offer an adjustable incline ramp, which changes muscle emphasis and adds genuine programming variety, at the cost of an extra motor and mechanism to maintain. Cross trainers with fixed geometry have less to go wrong and are often the more sensible used buy for a small site.',
          'Decide whether you need moving handlebars. Dual-action machines with moving upper handles suit members who want whole-body work, while fixed-handle machines simplify the mechanism and reduce the number of pivots that can develop play. Also check that resistance covers a useful range, since a machine that tops out too easily will not satisfy fitter members.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults on used ellipticals',
        paragraphs: Object.freeze([
          'Ramps and rollers are the classic wear point on front-drive machines. Look along the ramp surface for grooving and uneven wear, then inspect the rollers for flat spots, scoring and play. Worn rollers produce a bumpy, ticking stride that no amount of cleaning fixes, and although replacement rollers are usually affordable, ramp replacement can be a much larger job.',
          'Pivot bushings and linkage play are next. With the machine stationary, grasp the pedal arms and handlebars and try to move them laterally. A few millimetres of play becomes an audible knock under a heavy user and will only get worse. Bushings are consumable, but a machine with play at every pivot needs a comprehensive rebuild rather than a single part.',
          'Creaks and clicks deserve attention because they are the number one member complaint on ellipticals. Ride the machine hard, at high and low resistance, standing tall and leaning forward, and listen. Some noise is a dry pivot that a service will cure; a persistent creak under load can indicate a cracked weld or a loose frame joint, which is a different conversation entirely.',
          'Check the resistance and generator behaviour too. Many commercial ellipticals are self-powered, so the console should come up within a few strides and hold steady. Resistance should change perceptibly across its full range. Add the usual sweat-corrosion inspection around the console, base and pedal arm fixings, plus footplate pads which are cheap to replace but look terrible when worn through.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-headroom',
        heading: 'Footprint, swing clearance and ceiling height',
        paragraphs: Object.freeze([
          'Commercial ellipticals are long. Many sit around 2m in length and 0.8m wide, and rear-drive machines are longer still. You also need swing clearance for the moving handlebars and space behind for the user to step off safely, so the plan-view footprint understates what the station really occupies.',
          'Ceiling height is the constraint people forget. A cross trainer raises the user 20 to 25cm above floor level before they start reaching upward, so a room that comfortably takes treadmills can leave a tall member ducking under a beam or a light fitting. Measure from the pedal at its highest point and add the tallest likely user, then check for ducting, sprinklers and lighting.',
          'Plan the route in carefully, because ellipticals are heavier and less cooperative than they look — often 150 to 220kg with an awkward centre of gravity. Ask what dismantles: consoles, uprights, handlebars and sometimes pedal arms usually come off, which can be the difference between a machine that fits through a doorway and one that does not.',
          'Since most commercial ellipticals are self-powered, siting is flexible and you can put them where the space works rather than where the sockets are. Do still allow service access around and behind the machine — a row pushed tight to a wall makes ramp and roller work far more difficult than it needs to be.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Servicing, lubrication and wear parts',
        paragraphs: Object.freeze([
          'Elliptical maintenance is mostly about pivots and rollers. A planned service should check and lubricate pivot points to manufacturer specification, inspect rollers and ramps for wear, check the drive belt, confirm fixings are torqued and test resistance across the range. Done regularly, this keeps a used machine feeling tight for years.',
          'Cleaning matters more than it appears. Dust and grit on a ramp accelerate roller wear dramatically, so wiping the ramp surfaces and rollers is a genuine mechanical maintenance task rather than presentation. Sweat around pedal arm pivots and console fixings is the other thing to stay ahead of.',
          'Treat rollers, bushings, footplate pads and grips as planned consumables and keep a small stock if you run several identical machines. Replacing a set of rollers before they flat-spot is far cheaper than replacing a ramp they have chewed, and it prevents the gradual decline in feel that pushes members onto other stations.',
          'Get a first service done after installation on any high-hour machine. It gives you a documented baseline, catches anything the inspection missed while it is still fresh, and means the row starts its life on your floor properly set up rather than carrying faults inherited from the previous site.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'How the brands genuinely differ',
        paragraphs: Object.freeze([
          'Precor built its reputation on elliptical biomechanics, and its machines with an adjustable ramp remain among the most sought-after used ellipticals in the UK. They tend to hold value accordingly, and parts support is generally good.',
          'Life Fitness ellipticals are extremely common in UK facilities, which makes them a practical used buy: familiar to engineers, well supplied with parts and available in enough volume to compare several examples before choosing. Technogym machines are superbly finished with excellent ergonomics but usually sit at the top of the used price range.',
          'Cybex takes a different approach with its arc-style motion, which some members strongly prefer and others do not get on with at all. It is worth trying rather than assuming, because it is the one design in this category where member reaction is genuinely divided.',
          'Matrix offers good value used with sound mechanical design and reasonable parts availability on recent generations. Across all brands, the practical test is whether ramps, rollers, bushings and console parts are still obtainable for that specific generation — check before you buy rather than after a roller fails.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-refurb',
        heading: 'Remaining life, refurbished versus as-seen',
        paragraphs: Object.freeze([
          'A commercial elliptical frame will typically outlast multiple sets of rollers, bushings and pads, so remaining life is best judged by whether those consumables are available and what state they are in. That makes the category unusually forgiving to used buyers who know what to inspect.',
          'Refurbished ellipticals should come with rollers and bushings replaced, pivots serviced, footplate pads and grips renewed and the machine tested under load. Ask for the actual list of parts, because on this equipment the difference between a genuine refurbishment and a deep clean is enormous and completely invisible in photographs.',
          'As-seen machines can be excellent value if you have engineering support. A set of rollers and bushings is a modest parts bill and a straightforward job for someone who has done it before, so a mechanically sound machine with tired consumables is often the smartest purchase on the page.',
          'Where a seller offers their own warranty, get the terms in writing through Equipd messages. Any such warranty is an agreement between you and that seller rather than something Equipd provides, so the detail — duration, what it covers, who attends — needs to be explicit before you pay.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-transport',
        heading: 'Inspecting and moving a cross trainer',
        paragraphs: Object.freeze([
          'Ride every machine for several minutes rather than a token thirty seconds. Vary resistance, ramp position if fitted, and your posture, because roller and pivot faults often only announce themselves under a particular load or stride. Have a second person watch the pedal arms and ramp while you ride, as movement is easier to see than to feel.',
          'Use a consistent checklist: console powers up and holds, resistance changes across the range, ramp surface and rollers, pedal arm and handlebar play, noise under load, footplate pads and grips, upholstery and shroud condition, frame corrosion, fixings present, serial plate visible. Photograph each machine and note which is which before delivery day.',
          'Plan transport with the awkwardness in mind. Fulfilment is arranged directly between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier — and ellipticals are top-heavy, long and easy to bend if dragged. Specialist gym movers with proper trolleys and straps are cheap insurance on a machine worth several thousand pounds.',
          'Agree who strips and who rebuilds. Removing consoles, uprights and handlebars is normal for transit, but the fixings must arrive with the machine and someone needs to reassemble and align it properly. Inspect on arrival, run each machine before the vehicle leaves if you can, and confirm handover only when you are satisfied — that confirmation is what opens the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'What to check on ramps, rollers and pivots, how much space and headroom a station needs, and how buying safely works on Equipd.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What stride length should a commercial cross trainer have?',
        answer:
          'Commercial machines typically offer around 50 to 56cm of stride. Shorter strides feel cramped to taller members and unusually long ones can feel awkward for shorter users, so if you are buying a row for general membership use, favour a path that suits the widest range of heights rather than the largest number on the specification sheet.',
      }),
      Object.freeze({
        question: 'How do I tell if the rollers on a used elliptical are worn?',
        answer:
          'Inspect each roller for flat spots, scoring and side-to-side play, and look along the ramp for grooving or uneven wear. Then ride the machine and feel for a ticking or bumpy stride. Rollers are relatively inexpensive consumables, but if they have been left long enough to damage the ramp the repair becomes much more expensive.',
      }),
      Object.freeze({
        question: 'Why do used cross trainers creak, and does it matter?',
        answer:
          'Creaking usually comes from dry or worn pivot bushings and is often cured by a service and new bushings. It matters because it is the complaint members raise most about ellipticals. A creak that persists under load after servicing can indicate a loose frame joint or cracked weld, which is a reason to walk away rather than negotiate.',
      }),
      Object.freeze({
        question: 'How much ceiling height does a cross trainer need?',
        answer:
          'More than most people allow for. The machine raises the user roughly 20 to 25cm above the floor before they stand upright, so measure from the pedal at its highest point and add your tallest likely member, then check for beams, ducting, sprinklers and light fittings. Rooms that suit treadmills can still be too low for ellipticals.',
      }),
      Object.freeze({
        question: 'Do commercial cross trainers need a power supply?',
        answer:
          'Most are self-powered, generating console power from the user, which makes them easy to place anywhere on a floor without electrical work. Machines with entertainment screens or powered incline ramps may need mains power, so confirm the requirement for the specific model before planning the layout.',
      }),
      Object.freeze({
        question: 'Is a rear-drive or front-drive elliptical better?',
        answer:
          'Both work well in commercial use. Rear-drive machines often give a flatter, more natural stride, while front-drive designs are typically more compact and use a ramp-and-roller arrangement that becomes the main wear point. Choose on how the machine feels to your members and on parts availability rather than on drive position alone.',
      }),
      Object.freeze({
        question: 'How heavy are commercial ellipticals to move?',
        answer:
          'Commonly between 150 and 220kg, with a long, top-heavy shape that makes them awkward on stairs and through doorways. Consoles, uprights and handlebars usually come off for transit, which often makes the difference on a tight route. For anything beyond a straightforward ground-floor delivery, specialist gym equipment movers are worth the cost.',
      }),
      Object.freeze({
        question: 'What should a proper elliptical refurbishment include?',
        answer:
          'Replaced rollers and bushings, serviced and lubricated pivots, new footplate pads and grips, attention to any ramp wear, plus cleaning and testing under load. Ask for the specific list of parts replaced, because on ellipticals the gap between a genuine refurbishment and a thorough clean is large and impossible to see in photographs.',
      }),
      Object.freeze({
        question: 'Are Cybex arc-style machines the same as a normal cross trainer?',
        answer:
          'No, the motion is deliberately different and member reaction tends to be divided — some strongly prefer it, others do not get on with it. If you are considering one, try it yourself and ideally let a few members try it before committing to several, rather than assuming it will substitute directly for a conventional elliptical.',
      }),
      Object.freeze({
        question: 'What do I need to do before confirming handover on Equipd?',
        answer:
          'Inspect and ride the machine, check it against the listing description and photograph its condition. Confirmation of handover is what starts the Buyer Protection window on eligible purchases, so it should come after you are satisfied rather than before. Keep any agreements about refurbishment work or seller warranties in Equipd messages.',
      }),
    ]),
    midCtaHeading: 'Compare commercial cross trainers now',
    midCtaLead:
      'Browse used commercial ellipticals from UK gyms, dealers and refurbishers, and compare stride, condition and price side by side.',
    midCtaLabel: 'Browse Commercial Cross Trainers',
    exploreLead:
      'Continue into the rest of the commercial cardio range, the brands behind most UK elliptical fleets, and the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Facility-grade ellipticals',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-commercial-rowing-machines': Object.freeze({
    eyebrow: 'Full-body conditioning, minimal floor space',
    h1: 'Used Commercial Rowing Machines',
    lead: 'Buy used commercial rowing machines from gyms, studios, dealers and refurbishers across the UK. Equipd provides the marketplace and the payment protection — secure card payment, Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Commercial Rowing Machines UK | Equipd',
    metaDescription:
      'Used commercial rowing machines from UK gyms, studios and dealers. Check chains, rails and monitors, then buy securely with Buyer Protection on eligible purchases.',
    schemaAbout: 'Used commercial rowing machines',
    searchLabel: 'Search commercial rowing machines',
    listingsHeading: 'Live commercial rower listings',
    listingsLead:
      'Air, magnetic and water rowers listed on Equipd by UK gyms, studios, dealers and refurbishers — frequently in batches from a class studio or functional area.',
    listingsCta: 'Browse all commercial rowing machines',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'Rowers are the cheapest way to add conditioning stations. Combine them with treadmills, bikes, cross trainers and climbers to cover both steady-state and interval programming.',
    brandLead:
      'Concept2 dominates commercial rowing for good reason, with Technogym, Life Fitness and WaterRower each offering machines with a different feel. Parts availability is unusually good across this category, which is what makes used rowers such a dependable purchase.',
    benefitsHeading: 'Why buy used commercial rowers on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'batch-availability',
        title: 'Batches from studios and functional areas',
        body: 'Class studios buy rowers in numbers and replace them together, so Equipd listings often cover four, six or eight matching machines. That is an efficient way to equip a group training space in one transaction.',
      }),
      Object.freeze({
        id: 'parts-forever',
        title: 'Parts that stay available for years',
        body: 'Rowers are the most repairable cardio you can buy. Chains, seat rollers, handles, shock cords and monitors are all obtainable for the main commercial models, which means age matters far less here than in any other cardio category.',
      }),
      Object.freeze({
        id: 'space-efficient',
        title: 'Low cost per station',
        body: 'A rower gives full-body conditioning for a fraction of the price of a treadmill, needs no mains supply and can usually be stored upright between sessions — the best value per square metre on most floors.',
      }),
      Object.freeze({
        id: 'protected-purchase',
        title: 'Protected, valued purchases',
        body: 'Pay by card through Equipd with funds held until handover is confirmed, Buyer Protection on eligible purchases, and a free Instant Valuation so you can check a batch price before agreeing it.',
      }),
    ]),
    valuationEyebrow: 'Selling a studio\'s rowers?',
    valuationHeading: 'Value rowing machines before you agree a price',
    valuationCopy:
      'Commercial rowers hold their value unusually well, which cuts both ways: sellers often under-price tired machines and buyers often over-pay for older monitors. Use the free Equipd valuation on the specific model to see the UK range by year and condition, then price a batch properly or negotiate a single machine from an informed position.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Choose the rower model' }),
      Object.freeze({ label: 'Details', body: 'Add the monitor version and metres rowed' }),
      Object.freeze({ label: 'Estimate', body: 'See the current UK range' }),
      Object.freeze({ label: 'Decide', body: 'Buy the batch or list yours', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial rowing machine buying guide',
    guideIntro:
      'Rowing machines are the safest used purchase in commercial cardio. They are mechanically simple, almost everything that wears is a cheap and available part, and a decade-old machine with a fresh chain, rollers and shock cord can perform exactly like a new one. The things that go wrong are specific and easy to check: a stretched or dry chain, flat-spotted seat rollers on a scored rail, a slack shock cord that will not return the handle, a clogged flywheel enclosure and a monitor that has lost its memory or its battery contacts. This guide covers choosing between air, magnetic and water resistance, understanding monitors and metre counts, the faults to look for, space and storage, maintenance you can do yourself, brand differences, and how to buy and move a batch of machines sensibly.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'resistance-type',
        heading: 'Air, magnetic or water resistance',
        paragraphs: Object.freeze([
          'Air resistance is the commercial default. A fan flywheel with an adjustable damper gives resistance proportional to effort, which is why air rowers are used for testing, competition and class programming — the numbers are comparable between machines and sessions. The trade-off is noise: a bank of air rowers under class conditions is genuinely loud, which matters if there is a studio or office next door.',
          'Magnetic rowers are much quieter and give a smooth, consistent pull at a set resistance level. They suit hotel gyms, rehab settings, quiet corners of a floor and any site with noise-sensitive neighbours. They are less popular for group conditioning because the feel does not respond to effort in the same way, and split times are not directly comparable with air machines.',
          'Water rowers use paddles in a tank to produce a smooth catch and a distinctive swishing sound that many users prefer to fan noise. They tend to look far better in a boutique studio or a members\' lounge, need occasional water treatment, and are heavier to move when full. Some also combine air and magnetic resistance in a hybrid, which is worth trying rather than assuming.',
          'Match the choice to the programme. If you run benchmark testing or class-based intervals where members compare scores, buy air. If quiet operation or aesthetics is the priority, magnetic or water will serve you better. Buying a mixed batch is usually a mistake for class use, because the machines will not feel or score alike.',
        ]),
      }),
      Object.freeze({
        id: 'monitors-and-metres',
        heading: 'Monitors, metre counts and data',
        paragraphs: Object.freeze([
          'The monitor is the part of a used rower most likely to date the machine. Successive generations added memory, wireless heart rate, connectivity to apps and USB or Bluetooth data transfer, and on some models a newer monitor can be retro-fitted to an older frame. That is worth knowing, because it means an older machine with a good frame is upgradeable rather than obsolete.',
          'Ask for the lifetime metre count from the monitor. It is the equivalent of a treadmill hours reading and gives you a genuine sense of use — a studio machine can accumulate very large totals while a hotel rower may barely have been touched. Frame condition and roller wear should broadly corroborate whatever number you are told.',
          'Check the monitor actually works properly rather than just lighting up. Confirm it registers strokes and displays split, stroke rate and distance, that the buttons all respond, and that it holds settings when switched off. Monitors are commonly powered by batteries with a generator top-up, so a dim display is often a cheap fix rather than a fault.',
          'If you intend to run classes with leaderboards or connected programming, verify compatibility before you buy rather than assuming. Older monitors may not talk to modern software at all, and the cost of upgrading several machines is a real budget item that should form part of the purchase decision.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults on used rowers',
        paragraphs: Object.freeze([
          'Seat rollers and the rail are the first things to check. Sit on the seat and slide it the full length of the rail, listening for grinding and feeling for bumps. Flat-spotted rollers and a scored or dented rail will annoy every user, and while rollers are inexpensive, a badly damaged rail is a bigger job. Look for dents from dropped weights if the machine has lived in a functional area.',
          'Inspect the chain or belt closely. A dry, rusty or stretched chain is common on machines that have never been oiled, and a chain that has visibly stretched should simply be replaced. On belt-drive machines look for fraying or glazing. Pull the handle to full extension repeatedly and watch that it returns smoothly and completely.',
          'A handle that returns slowly or not at all means the shock cord has stretched or the cord tension needs adjusting. It is a cheap and easy fix on most commercial rowers but it makes a machine unusable, so it is worth using as negotiating material rather than a reason to reject an otherwise good frame.',
          'Open or look into the flywheel housing where you can. Air rowers pull dust, hair and carpet fibre into the enclosure, and a heavily clogged flywheel changes the feel and stresses the bearings. Also check the damper slides freely across its range, the footplates and straps are intact, the frame fixings and any folding mechanism are sound, and the whole machine is free of the sweat corrosion that collects under the seat and around the monitor arm.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-storage',
        heading: 'Space, storage and where rowers can go',
        paragraphs: Object.freeze([
          'A commercial rower needs around 2.4m of length and roughly 0.6m of width in use, plus clear space behind the flywheel and enough room at the seat end for the user to get on and off. In practice, allow closer to 3m of clear length per machine so the rail end is not against a wall.',
          'Storage is what makes rowers so space-efficient. Most commercial models separate or tilt to stand vertically, which turns a 2.4m machine into a footprint under half a square metre between sessions. Check the ceiling height for upright storage and confirm the machine you are buying has whatever pins, catches or wheels the storage method requires.',
          'Think about noise placement for air rowers. Fan noise carries, and a row of air machines directly beneath an office or next to a mind-body studio causes complaints. Rubber matting and sensible positioning help, but the honest answer is to put air rowers where noise is expected and magnetic ones where it is not.',
          'Access in is the easiest of any cardio category. Rowers are light — typically 25 to 40kg — and most split into two pieces, so a single person can carry one upstairs and through a standard door. That is a genuine advantage when equipping an upper-floor studio or a site with no lift.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance you can do without an engineer',
        paragraphs: Object.freeze([
          'Rowers are the one category where in-house maintenance is realistic for almost any operator. Oiling the chain on schedule, wiping the rail, cleaning the seat rollers and checking the footplate straps takes a few minutes per machine and prevents most of the wear that devalues a rower.',
          'Clean the flywheel enclosure periodically on air machines. Removing accumulated dust from the fan housing restores the feel, keeps the bearings happier and is usually a straightforward job with the covers off. Sites with carpet or high foot traffic need this more often than they expect.',
          'Keep a small spares kit for a batch: seat rollers, a chain, a shock cord, footplate straps and monitor batteries. All are inexpensive and all are things you will eventually need, and having them on a shelf means a machine is never out of service for more than an evening.',
          'Water rowers have their own routine — the tank needs treatment to stay clear, and the manufacturer will specify a purification schedule. Ask the seller when it was last treated and factor a fresh fill and treatment into the handover if the water looks anything other than clean.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and why Concept2 dominates',
        paragraphs: Object.freeze([
          'Concept2 is the benchmark in commercial rowing and the reason the used market in this category is so reliable. The machines have changed relatively little in fundamentals over successive generations, spares are available for very old units, and monitors can often be upgraded, which means an older machine is a serviceable asset rather than a liability.',
          'Technogym and Life Fitness both build commercial rowers aimed at class and floor use, often with more integrated design and connectivity than a standard air rower. They are excellent machines, though parts and monitor support are more likely to run through official channels than an open spares market.',
          'WaterRower and similar water machines are chosen partly for feel and partly for appearance, and are a common sight in boutique studios and hotel gyms. They are well built and repairable, but heavier to move and dependent on tank maintenance, so they suit sites where the aesthetic justifies the extra care.',
          'For batch buying, matching matters more than badge. A set of eight identical machines from one brand means one spares kit, one maintenance routine and comparable numbers across your class leaderboard. Mixed batches cause exactly the friction you would expect the first time you run a benchmark session.',
        ]),
      }),
      Object.freeze({
        id: 'buying-batches',
        heading: 'Buying batches, transport and inspection',
        paragraphs: Object.freeze([
          'When you buy several rowers, inspect each one individually rather than sampling. Machines from the same studio can be in noticeably different condition depending on where they sat in the room, and it is not unusual for one or two in a batch to need rollers and a chain while the others are fine.',
          'Row every machine for a minute. Take several hard strokes at both a low and a high damper setting, watch the monitor register properly, feel the seat travel and listen to the flywheel. A quick row finds nearly every fault on a rower, which is why this category so rarely produces post-sale surprises.',
          'Use a simple checklist per unit: monitor function and lifetime metres, chain or belt condition, handle return, seat roller and rail condition, damper movement, footplates and straps, flywheel housing cleanliness, frame and folding mechanism, corrosion, and the serial number. Photograph each machine and label which is which for delivery.',
          'For transport, remember fulfilment is agreed directly between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier. Rowers usually split into two parts, travel well and rarely need specialist movers, so collection in a van is often the cheapest route for a batch. Confirm the fixings and any monitor arms travel with the right machine, then inspect on arrival and only confirm handover once you are satisfied, since that is what starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'How air, magnetic and water rowers differ, what to check on chains, rails and monitors, and how buying a batch through Equipd works.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Which resistance type is best for a commercial gym rower?',
        answer:
          'Air resistance is the commercial standard because effort translates directly into resistance and scores are comparable between machines, which suits testing and class programming. Magnetic rowers are much quieter and better for noise-sensitive sites, and water rowers offer a smooth feel and studio-friendly looks. Choose based on programming and noise rather than price alone.',
      }),
      Object.freeze({
        question: 'Does a high lifetime metre count mean a rower is worn out?',
        answer:
          'Not usually. Metres are the rowing equivalent of treadmill hours, but almost everything that wears on a rower is a cheap, available part. A machine with millions of metres but a new chain, rollers and shock cord can perform like new. Judge the metre count alongside the rail, roller and chain condition rather than on its own.',
      }),
      Object.freeze({
        question: 'Why does the handle not return properly on a used rower?',
        answer:
          'That is almost always a stretched shock cord or a cord that needs re-tensioning, which is an inexpensive and straightforward fix on most commercial rowers. It makes the machine unusable in the meantime, so treat it as negotiating material on an otherwise sound frame rather than a reason to reject the machine.',
      }),
      Object.freeze({
        question: 'Can an old rower monitor be upgraded?',
        answer:
          'On several commercial models, yes — newer monitors can be fitted to older frames, adding memory, wireless heart rate and app connectivity. Check compatibility for the specific model and generation before buying, and include the cost across the whole batch if you intend to run connected classes or leaderboards.',
      }),
      Object.freeze({
        question: 'How much space does a rowing machine need?',
        answer:
          'Around 2.4m of length and 0.6m of width in use, and in practice closer to 3m of clear length so the rail end is not against a wall. Most commercial rowers store vertically, reducing the stored footprint to well under half a square metre, so check ceiling height if you plan to stand them up between sessions.',
      }),
      Object.freeze({
        question: 'Are air rowers too loud for a shared building?',
        answer:
          'They can be. A bank of air rowers in a class produces significant fan noise that carries into adjacent rooms and floors below. Matting and thoughtful placement help, but if you have an office, treatment room or mind-body studio nearby, magnetic or water rowers are a more practical choice.',
      }),
      Object.freeze({
        question: 'What maintenance do commercial rowers need?',
        answer:
          'Oil the chain on the manufacturer schedule, wipe the rail and clean the seat rollers, check footplate straps, and periodically clear dust from the flywheel housing on air machines. It is realistic to do all of this in-house, which is why rowers have the lowest running cost of any commercial cardio.',
      }),
      Object.freeze({
        question: 'Should I buy a matched batch or mix models?',
        answer:
          'Buy matched machines if they will be used for classes or benchmark testing, because feel and scores differ between models and resistance types. A matched batch also means a single spares kit and one maintenance routine. Mixing is only sensible when machines will be used individually on a general floor.',
      }),
      Object.freeze({
        question: 'Do I need specialist movers for rowing machines?',
        answer:
          'Rarely. Most commercial rowers weigh 25 to 40kg and split into two sections, so they fit in a van and can be carried upstairs by one or two people. Water rowers are heavier and should be drained before moving. Fulfilment is agreed between buyer and seller, so collection is often the cheapest option for a batch.',
      }),
      Object.freeze({
        question: 'What should I check on arrival before confirming handover?',
        answer:
          'Row each machine, confirm the monitor reads correctly, check the seat travel and handle return, and make sure every unit matches the condition described in the listing. Confirm handover only once you are satisfied, as confirmation starts the Buyer Protection window on eligible purchases and it applies per order rather than per machine.',
      }),
    ]),
    midCtaHeading: 'Find commercial rowing machines',
    midCtaLead:
      'Browse air, magnetic and water rowers listed by UK gyms, studios, dealers and refurbishers — singles and matched batches.',
    midCtaLabel: 'Browse Commercial Rowers',
    exploreLead:
      'Explore the rest of the commercial cardio range, the brands behind most UK rowing fleets, and the Equipd guides to buying, selling and valuation.',
    heroTrustItems: Object.freeze([
      'Matched studio batches',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-commercial-stair-climbers': Object.freeze({
    eyebrow: 'The hardest station on the floor',
    h1: 'Used Commercial Stair Climbers',
    lead: 'Source used commercial stair climbers and stepmills from UK gyms, dealers and refurbishers on Equipd. We host the marketplace and the secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Commercial Stair Climbers & Stepmills | Equipd',
    metaDescription:
      'Buy used commercial stair climbers and stepmills from UK sellers. Check step chains and treads, then pay securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial stair climbers and stepmills',
    searchLabel: 'Search commercial stair climbers',
    listingsHeading: 'Live stair climber and stepmill listings',
    listingsLead:
      'Revolving stepmills and stepper-style climbers listed on Equipd by UK operators, dealers and refurbishers — a category where availability comes and goes quickly.',
    listingsCta: 'Browse all commercial stair climbers',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'Climbers are a specialist station rather than a floor filler. Most operators run one or two alongside a full complement of treadmills, bikes, cross trainers and rowers.',
    brandLead:
      'StairMaster effectively defined this category and its stepmills remain the most sought-after used climbers in the UK, with Life Fitness, Matrix and Technogym also building capable machines. Parts and engineer familiarity vary noticeably, so check support before committing.',
    benefitsHeading: 'Why buy used commercial stair climbers on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'access-to-a-scarce-category',
        title: 'Access to a scarce category',
        body: 'Stepmills are expensive new and rarely sold in volume, so used stock is limited and moves quickly. Equipd brings ex-facility and refurbished climbers from across the UK into one place, which is the practical way to find one.',
      }),
      Object.freeze({
        id: 'big-saving-on-list',
        title: 'The biggest saving in cardio',
        body: 'Because new stepmills sit at the top of the cardio price list, buying used typically saves more in absolute terms here than on any other machine — often enough to fund the servicing and matting the installation needs.',
      }),
      Object.freeze({
        id: 'member-demand',
        title: 'A station members actively queue for',
        body: 'Climbers have a devoted following and are frequently the busiest single machine on a floor relative to how many you own, which makes a used purchase unusually easy to justify against membership retention.',
      }),
      Object.freeze({
        id: 'protection-and-valuation',
        title: 'Secure payment and valuation',
        body: 'Pay by card through Equipd with funds held until handover is confirmed and Buyer Protection on eligible purchases, and use the free Instant Valuation to check an asking price on a machine type where values vary widely.',
      }),
    ]),
    valuationEyebrow: 'Retiring an older stepmill?',
    valuationHeading: 'Value a stair climber before you commit',
    valuationCopy:
      'Stair climbers are the hardest cardio category to price by instinct, because condition, generation and drive type make an enormous difference and comparable listings are thin on the ground. The free Equipd valuation gives you a market range based on the model, year and condition, which is far more useful than guessing from the one other machine currently for sale.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Identify the climber or stepmill model' }),
      Object.freeze({ label: 'Details', body: 'Add the year, hours and console type' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK range for the model' }),
      Object.freeze({ label: 'Decide', body: 'Offer, list or wait for better stock', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial stair climber buying guide',
    guideIntro:
      'Stair climbers are the most demanding cardio machines to own and among the most rewarding to have on a floor. A revolving stepmill runs a heavy step chain under continuous load with a user\'s entire body weight driving it, which produces wear patterns unlike anything else in the gym. Get the purchase right and you own the station members queue for; get it wrong and you own a very heavy object that will not fit through your door and that no local engineer wants to touch. This guide covers the difference between stepmills and stepper-style climbers, the faults specific to step chains and drives, the ceiling height and access problems that catch almost everyone, servicing expectations, how brands and parts support differ, realistic lifespan and refurbishment, and how to inspect and move a machine of this size.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'stepmill-or-stepper',
        heading: 'Stepmills versus stepper-style climbers',
        paragraphs: Object.freeze([
          'A stepmill uses a revolving staircase of real steps that rotate under the user, which reproduces genuine stair climbing and is why members find it so demanding. It is the machine most people mean by "the stairs", and it is the more mechanically complex of the two designs because it runs a driven step chain under continuous load.',
          'Stepper-style climbers use two independent pedals moving up and down against hydraulic or magnetic resistance. They are lighter, shorter, considerably cheaper to buy used and much simpler to maintain, and they suit sites that want the movement pattern without the mass, cost and ceiling height of a stepmill.',
          'The feel is genuinely different and members notice. Steppers allow the user to set their own range of movement and cheat by leaning on the handles; a stepmill dictates the step height and keeps coming, which is exactly why the more committed users prefer it. If your goal is a signature conditioning station, a stepmill is what you want.',
          'Budget and building usually decide. A stepmill is the more expensive purchase, needs more headroom, weighs more, and demands a better service arrangement. If the room or the maintenance plan cannot support that, a good stepper is a far better outcome than a stepmill nobody can service.',
        ]),
      }),
      Object.freeze({
        id: 'step-chains-and-drives',
        heading: 'Step chains, treads and drive systems',
        paragraphs: Object.freeze([
          'The step chain is the defining wear part on a stepmill. It runs constantly under the user\'s full weight and stretches over time, which shows up as uneven step spacing, a chattering or clunking rhythm and steps that do not sit level as they come round. Chain replacement is a substantial job on this equipment, so establishing chain condition is the single most important part of any inspection.',
          'Check every step tread individually rather than glancing at the staircase. Treads wear unevenly because most users favour the same portion of the step, and worn or cracked treads are both a safety issue and a visible sign of a machine that has done very heavy work. Confirm treads are still available for that model, because a stepmill with unobtainable treads has a limited future.',
          'Run the machine at low and high speed and listen to the drive. A stepmill uses a drive belt, gearbox or motor arrangement together with a braking or alternator system, and grinding, slipping under load or a speed that surges rather than holding steady all point to expensive components. Stand on it and climb properly, because faults in this category typically only appear under real load.',
          'On stepper-style machines the equivalent checks are the hydraulic cylinders or magnetic resistance unit, the pedal arm pivots and the drive linkage. Cylinders lose their damping with age and produce a soft, inconsistent stroke, and mismatched resistance between left and right pedals is a common giveaway that one side is worn or failing.',
        ]),
      }),
      Object.freeze({
        id: 'height-and-access',
        heading: 'Ceiling height, footprint and getting it in',
        paragraphs: Object.freeze([
          'Ceiling height is the constraint that stops most stepmill purchases, and people discover it too late. The machine itself commonly stands around 2.3 to 2.4m tall, and the user then stands on a step part way up it, so a room needs meaningful clearance above the machine height for the tallest likely member. Measure to the lowest obstruction, not the ceiling — ducting, sprinkler heads, lighting and beams all count.',
          'The footprint is more modest than the height suggests, often around 1.4m long by 0.9m wide, but you need clear space behind and to the sides for safe dismounting and for service access to the rear panels. Do not tuck a climber into a corner where an engineer cannot get behind it.',
          'Weight is the other serious factor. A commercial stepmill can weigh 180 to 250kg or more, concentrated on a small footprint, which makes floor loading a genuine question above ground level and matting essential. On upper floors or mezzanines, take a structural opinion rather than assuming the floor is fine because it takes treadmills.',
          'Plan the route in obsessively. Measure doorway heights as well as widths, check stair headroom, lift internal height and weight limit, and any low soffits along the way. Ask precisely what dismantles for transit — handrails, consoles and top sections often come off — and confirm the seller has the fixings and ideally the manual, because reassembling a stepmill without documentation is a bad afternoon.',
        ]),
      }),
      Object.freeze({
        id: 'servicing',
        heading: 'Servicing, power and running costs',
        paragraphs: Object.freeze([
          'Stair climbers need more maintenance than any other cardio machine and should be budgeted accordingly. A planned service covers step chain tension and condition, tread inspection, drive belt and bearing checks, lubrication to manufacturer specification, brake or alternator function and electrical testing. Skipping it does not save money; it converts routine adjustment into chain and drive replacement.',
          'Confirm the electrical requirement for the specific model before delivery. Unlike bikes and rowers, climbers are not self-powered, and some models have particular supply requirements. Plan the socket position in advance, since the machine is not something you will be sliding across the floor afterwards to reach a different outlet.',
          'Make sure you have an engineer who will actually work on it. Stepmills are a specialist machine and not every general gym-equipment engineer is comfortable with a step chain job. Establish who will service it and roughly what a chain or drive repair costs before you buy — that figure should influence what you are willing to pay for the machine.',
          'Keep the machine clean underneath and behind, not just on the visible surfaces. Dust, grit and sweat get into the chain path and the drive area, and a climber that looks immaculate from the front can be neglected where it matters. Ask to see behind the covers during inspection.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brands, parts and engineer familiarity',
        paragraphs: Object.freeze([
          'StairMaster is the name most associated with this category, and its stepmills are the machines most UK buyers are looking for on the used market. That popularity is practical rather than sentimental: engineers know them, parts are comparatively obtainable, and there is enough history in the market to know which generations are strong.',
          'Life Fitness and Matrix both build well-regarded climbers that are common in larger UK facilities, with parts routes through established service networks. Technogym climbers are excellently made and finished but sit at the premium end used, with support more often through official channels.',
          'Whatever the badge, check parts for the specific generation before you commit. Step chains, treads, drive belts, boards and consoles are all model-specific, and this is the one cardio category where a discontinued part can effectively end the machine\'s working life. A quick call to a parts supplier is time extremely well spent.',
          'Weigh engineer familiarity heavily. A slightly less prestigious climber that your existing service provider maintains routinely is a much better asset than a premium machine that requires a specialist visit from another part of the country every time the chain needs attention.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-refurb',
        heading: 'Lifespan, refurbished versus as-seen',
        paragraphs: Object.freeze([
          'The frame, drive and structure of a commercial climber will last a very long time; the step chain, treads, bearings and brake components are the elements that define remaining life. Judge a machine on those rather than on its year, and treat a documented recent chain replacement as a significant part of the value.',
          'Refurbished climbers are worth serious consideration in this category specifically because the work is expensive to do yourself. A proper refurbishment should include chain assessment or replacement, new or good treads, serviced drive and bearings, tested electronics and a full clean. Ask for the itemised list, and be sceptical of a low price attached to the word "refurbished".',
          'As-seen climbers can be a bargain if you have specialist support and are buying with your eyes open. The failure mode to avoid is buying a cheap machine with a stretched chain and unobtainable treads, then discovering the repair costs more than a good example would have. Price the work before you bid, not after.',
          'If a seller offers a warranty, get the terms in writing in Equipd messages, including duration, what is covered and who attends. Seller warranties are agreements between you and that seller, and on a machine this expensive to repair the detail genuinely matters.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-transport',
        heading: 'Inspecting and transporting a climber',
        paragraphs: Object.freeze([
          'Inspect in person on this category almost without exception. The value, the cost of the parts that wear and the difficulty of moving the machine all mean the trip is justified. Climb it yourself for several minutes at more than one speed, because a step chain fault under a 90kg user is not the same as a chain that looks fine while the staircase idles.',
          'Work through a checklist and photograph everything: step chain tension and step spacing, condition of every tread, noise and behaviour under load at multiple speeds, console and key function, emergency stop, handrail condition and security, drive area and covers, corrosion behind panels, frame and welds, hours reading, and the serial plate. Ask the seller to remove covers so you can see the chain path.',
          'Plan transport as a project rather than a delivery. Fulfilment is arranged between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier — and for a 200kg-plus machine with a high centre of gravity, specialist gym-equipment movers with stair-climbing equipment are the sensible choice. Agree who dismantles, who reassembles and where the fixings live.',
          'Have the destination ready before the machine arrives: space cleared, matting down, the correct socket live and someone available to run the machine before the movers leave. Inspect on arrival, run it under load, and only then confirm handover — confirmation is what starts the Buyer Protection window on eligible purchases, so it should never happen while a machine is still on a tail lift.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'What differs between stepmills and steppers, how to judge a step chain, and the ceiling, floor and access questions to answer before buying.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What is the difference between a stepmill and a stair stepper?',
        answer:
          'A stepmill has a revolving staircase of real steps rotating under the user, reproducing genuine stair climbing. A stepper uses two independent pedals moving against hydraulic or magnetic resistance. Stepmills are more demanding, more expensive and taller; steppers are lighter, cheaper and far simpler to maintain.',
      }),
      Object.freeze({
        question: 'How do I check the step chain on a used stepmill?',
        answer:
          'Watch the step spacing as the staircase rotates and listen for chattering or clunking, then climb the machine under your full weight at more than one speed. Uneven spacing, steps that do not sit level and a rhythmic knock all suggest a stretched chain. Ask to see behind the covers, since chain replacement is a major cost on this equipment.',
      }),
      Object.freeze({
        question: 'How much ceiling height does a stepmill need?',
        answer:
          'The machine alone commonly stands 2.3 to 2.4m tall, and the user then stands part way up it, so you need substantial clearance above that for your tallest members. Measure to the lowest obstruction rather than the ceiling itself, allowing for ducting, sprinklers, lighting and beams.',
      }),
      Object.freeze({
        question: 'Can a stair climber go on an upper floor?',
        answer:
          'Sometimes, but it needs checking rather than assuming. Commercial climbers can weigh 180 to 250kg or more on a small footprint, which concentrates load, and you also have to get it up there — measure stair headroom, lift internal height and weight limits. On mezzanines and upper floors, take a structural opinion.',
      }),
      Object.freeze({
        question: 'Do stair climbers need mains power?',
        answer:
          'Yes. Unlike most commercial bikes, rowers and cross trainers, climbers are not self-powered and require a mains supply, with some models having specific requirements. Confirm the specification for the exact model and have the socket in the right place before delivery, because repositioning the machine afterwards is a significant job.',
      }),
      Object.freeze({
        question: 'Why are used stair climbers harder to find than other cardio?',
        answer:
          'Most facilities own only one or two, they are expensive new so they are kept longer, and they are usually replaced individually rather than as a fleet. That means stock appears sporadically and sells quickly, so it is worth checking listings regularly and being ready to move when a good example comes up.',
      }),
      Object.freeze({
        question: 'How much maintenance does a stepmill need?',
        answer:
          'More than any other cardio machine. Plan regular checks of step chain tension, tread condition, drive belt and bearings, lubrication to specification, brake or alternator function and electrical safety. Budget for this properly, because deferred maintenance on a climber turns cheap adjustments into chain and drive replacement.',
      }),
      Object.freeze({
        question: 'Are treads and parts still available for older climbers?',
        answer:
          'It depends entirely on the model and generation, and this is the cardio category where it matters most. Step chains, treads, drive components and consoles are model-specific, and a machine with unobtainable treads has a limited life. Check with a parts supplier for that exact generation before committing.',
      }),
      Object.freeze({
        question: 'Is a refurbished stair climber worth the premium?',
        answer:
          'Often yes, because the work involved is expensive and specialist. A genuine refurbishment should cover chain assessment or replacement, good treads, a serviced drive and bearings, tested electronics and a full clean. Ask for the itemised list of what was done and be wary of a very low price attached to the word refurbished.',
      }),
      Object.freeze({
        question: 'Who should move a used stepmill?',
        answer:
          'Specialist gym equipment movers with the right stair equipment and experience of top-heavy machines. Fulfilment is agreed directly between buyer and seller on Equipd, so settle collection or delivery before payment, agree who dismantles and reassembles, and have the space, matting and power ready so you can test the machine before confirming handover.',
      }),
    ]),
    midCtaHeading: 'Looking for a stair climber?',
    midCtaLead:
      'See the stepmills and stair climbers currently listed by UK gyms, dealers and refurbishers — stock in this category does not stay long.',
    midCtaLabel: 'Browse Stair Climbers',
    exploreLead:
      'Look at the rest of the commercial cardio range, the brands that build most UK climbers, and the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Ex-facility stepmills',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-commercial-indoor-cycles': Object.freeze({
    eyebrow: 'Studio bikes, studio quantities',
    h1: 'Used Commercial Indoor Cycles',
    lead: 'Buy used indoor cycles and studio spin bikes from UK gyms, boutique studios, dealers and refurbishers through Equipd. We provide the marketplace, secure Stripe payments and Buyer Protection on eligible purchases, plus a free Instant Valuation on every model.',
    metaTitle: 'Used Indoor Cycles & Spin Bikes for Sale | Equipd',
    metaDescription:
      'Used commercial indoor cycles and studio spin bikes from UK sellers. Check bearings and frames, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial indoor cycles and studio spin bikes',
    searchLabel: 'Search indoor cycles',
    listingsHeading: 'Live indoor cycle listings',
    listingsLead:
      'Studio spin bikes listed on Equipd by UK gyms, boutique operators, dealers and refurbishers — usually in the batches of eight, twelve or twenty that studios actually replace.',
    listingsCta: 'Browse all indoor cycles',
    categoryHeading: 'Other commercial cardio to consider',
    categoryLead:
      'A cycling studio is only part of the offer. Look at treadmills, upright and recumbent bikes, cross trainers and rowers for the main floor alongside your class programme.',
    brandLead:
      'Keiser, Schwinn, Life Fitness, Technogym, Stages and Wattbike all appear on the UK used market with very different resistance systems and maintenance profiles. The difference between magnetic and friction resistance matters more here than the brand name.',
    benefitsHeading: 'Why buy used indoor cycles on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'studio-batches',
        title: 'Whole studios in one listing',
        body: 'Cycling studios replace bikes as a set, so Equipd regularly carries batches of eight, twelve or twenty matched machines. Buying a complete studio in one transaction is far simpler than assembling one bike at a time.',
      }),
      Object.freeze({
        id: 'cost-per-bike',
        title: 'Fill a studio for a fraction of new',
        body: 'Kitting out a class studio with new bikes is one of the largest single costs in opening a facility. Used studio cycles bring that within reach, which is why so many boutique operators start with ex-facility bikes and reinvest the difference in the room.',
      }),
      Object.freeze({
        id: 'simple-mechanics',
        title: 'Simple machines, straightforward repairs',
        body: 'An indoor cycle is a frame, a flywheel, a drive and a resistance system. Bearings, pads, pedals and posts are all replaceable, so a tired but structurally sound batch can be brought back to a high standard economically.',
      }),
      Object.freeze({
        id: 'buyer-protection',
        title: 'Secure payment on a large order',
        body: 'Paying for twenty bikes by bank transfer to a seller you have not met is a leap of faith. Pay through Equipd instead, with funds held until handover is confirmed and Buyer Protection on eligible purchases.',
      }),
    ]),
    valuationEyebrow: 'Refreshing a cycling studio?',
    valuationHeading: 'Value a batch of indoor cycles',
    valuationCopy:
      'Indoor cycle values swing widely between resistance types, generations and how much sweat corrosion a studio has put into the frames, so per-bike pricing is easy to get wrong at scale. Use the free Equipd valuation on the exact model to see a market range from the year and condition, then multiply with confidence when you are pricing or negotiating an entire studio.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Select the indoor cycle model' }),
      Object.freeze({ label: 'Details', body: 'Add year, resistance type and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a per-bike market range' }),
      Object.freeze({ label: 'Decide', body: 'Price the batch or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used indoor cycle buying guide',
    guideIntro:
      'Indoor cycles live a harder life than almost any other gym equipment. They spend their working lives in hot, humid rooms with riders sweating directly onto the frame, stem and bottom bracket, ridden out of the saddle by people pulling on the bars, and they are cleaned by whoever is available rather than by a technician. That combination means condition varies enormously between studios that bought identical bikes on the same day. The good news is that everything which wears is replaceable and comparatively cheap, so a structurally sound batch can be restored to a high standard. This guide covers magnetic versus friction resistance, what to check on frames, bearings and posts, studio layout and floor considerations, maintenance for a batch, brand and power-meter differences, realistic lifespan, and how to inspect and move twenty bikes without unpleasant surprises.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'resistance-and-drive',
        heading: 'Magnetic or friction resistance, belt or chain drive',
        paragraphs: Object.freeze([
          'Magnetic resistance is the modern commercial standard and the better used buy in most cases. There is no contact wear, so nothing needs replacing as riders use it, resistance is consistent and repeatable across a class, and adjustment is precise enough for instructors to call specific levels. Magnetic bikes generally command higher used prices and deserve to.',
          'Friction resistance uses a felt or leather pad pressing on the flywheel. It gives a distinctive road-like feel that some instructors genuinely prefer, and the pads are inexpensive, but they are a consumable that needs regular replacement and they can squeal or grab when worn or damp. On a batch of twenty bikes, pad replacement becomes a recurring task rather than an occasional one.',
          'Drive type matters for noise and maintenance. Belt drives are quieter, cleaner and need no lubrication, which suits studios where the instructor\'s music and voice are the experience. Chain drives are robust and give a more mechanical feel, but they need oiling and eventually tensioning or replacing.',
          'Flywheel weight and position affect the ride. Heavier flywheels carry more momentum and feel smoother out of the saddle; rear-mounted flywheels keep sweat off the mechanism, which is a genuine durability advantage in a hot studio. If you have the choice within your budget, a rear-flywheel magnetic bike with a belt drive is the lowest-maintenance combination available used.',
        ]),
      }),
      Object.freeze({
        id: 'frames-bearings-posts',
        heading: 'Frames, bottom brackets and adjustment posts',
        paragraphs: Object.freeze([
          'Sweat corrosion is the defining problem with used studio bikes and the first thing to inspect. Look under the handlebar stem, around the seat post collar, at the frame welds beneath the saddle and anywhere fasteners meet the frame. Surface marks are cosmetic; flaking, bubbling paint and seized fasteners tell you the bike has spent years being sweated on and rinsed rather than properly dried.',
          'Test the bottom bracket on every bike. Hold a crank arm and rock it laterally, then spin the cranks slowly and listen. Play or a gritty rumble means bearings, which is a known and manageable repair on commercial bikes but multiplies quickly across a batch. A knocking bottom bracket under a standing rider is the fault most likely to take a bike out of a class.',
          'Work the seat and handlebar posts through their full range on each machine. Seized or scored posts are extremely common because that is exactly where sweat runs, and a bike that cannot be adjusted quickly between riders is a real problem in a class environment. Check the adjustment knobs, pop-pins and collars are all present and functional — small missing parts are a frequent issue on ex-studio bikes.',
          'Finally, check pedals, cages and crank threads. Pedals are cheap consumables and often need replacing anyway, but a stripped or damaged crank thread from someone over-tightening a pedal is a proper repair. Confirm the pedal type suits your members, since clipless, cage and dual-sided pedals all change how accessible a class feels.',
        ]),
      }),
      Object.freeze({
        id: 'studio-layout',
        heading: 'Studio layout, flooring and ventilation',
        paragraphs: Object.freeze([
          'Indoor cycles have a small footprint — commonly around 1.2m long by 0.5m wide — but a studio needs far more than the sum of those. Riders need space to mount, dismount and stand out of the saddle without clashing bars, and the instructor needs sight lines to every bike. Cramming an extra row in is the fastest way to make a studio feel unpleasant.',
          'Flooring should be chosen for sweat as much as for impact. A sealed, non-slip surface that can be mopped daily protects the subfloor and keeps the room hygienic, and rubber matting under each bike prevents corrosion of the floor and reduces movement during hard efforts. Ex-studio bikes will arrive having taught you exactly why this matters.',
          'Ventilation is equipment maintenance, not just member comfort. Hot, still, humid rooms destroy bikes from the outside in, and the difference in condition between machines from a well-ventilated studio and a basement room with no airflow is stark. If you are buying used bikes for a room with poor airflow, budget for shorter component life.',
          'Because indoor cycles are self-contained and mostly need no mains power, siting is flexible — though bikes with integrated consoles or power meters may use batteries or a socket. That freedom is a genuine advantage when converting an awkward room, since you can lay out for sight lines and airflow rather than around electrical points.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance-at-scale',
        heading: 'Maintaining a batch of studio bikes',
        paragraphs: Object.freeze([
          'The single most valuable maintenance habit is drying, not cleaning. Wiping every bike down after each class with a cloth that removes moisture rather than spreading it, paying attention to the stem, post collar and bottom bracket area, will add years to a batch. Harsh cleaning sprays applied daily accelerate corrosion on some finishes, so follow the manufacturer guidance.',
          'Set a monthly routine per bike: check bottom bracket play, pedal tightness, post adjustment and locking, resistance function across the range, drive tension on chain bikes, brake pad thickness on friction bikes, and all fasteners. On a studio of twenty machines it is a straightforward morning\'s work and it prevents most in-class failures.',
          'Keep a spares box sized for the batch. Pedals, pop-pins and knobs, seat and handlebar collars, friction pads if applicable, saddles, and bottom bracket bearings for the common model will cover the vast majority of issues. Because all your bikes are the same, one spares stock serves the whole studio.',
          'Track each bike individually. Numbering machines and keeping a simple record of what has been done means you can spot the bike that keeps needing attention, which is usually the one in the hottest corner or the one the strongest riders always choose. That knowledge is what stops a batch degrading unevenly.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-data',
        heading: 'Brands, power meters and class technology',
        paragraphs: Object.freeze([
          'Keiser bikes are among the most durable studio cycles on the used market, with magnetic resistance and a rear-mounted flywheel that keeps sweat away from the mechanism. They are consistently in demand used and priced accordingly. Schwinn indoor cycles are extremely common in UK studios and represent good value, with plentiful parts and engineer familiarity.',
          'Life Fitness and Technogym studio bikes are well built with strong finish quality and integrated console options, generally sitting at the upper end of used pricing. Stages and Wattbike are chosen primarily for their measurement accuracy, which makes them the choice for performance-focused programming and cycling-specific training rather than general classes.',
          'Power and cadence measurement is where these bikes differ most in practice. If you run leaderboard classes or performance programming, you need bikes with reliable power output and, ideally, calibration you can trust across the studio. Confirm what each bike reports, whether the displays are consistent between machines and whether calibration is possible on that model.',
          'Consoles and batteries are a practical detail at scale. Many studio bike computers run on standard batteries and simply need a fresh set, but obsolete or failing displays across a batch can be an expensive line item. Test every console rather than sampling a few, and confirm replacements are still available for that generation.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-refurb',
        heading: 'Lifespan, refurbished batches and as-seen studios',
        paragraphs: Object.freeze([
          'A good commercial indoor cycle frame will outlast several sets of bearings, pedals, saddles and pads. What ends a studio bike\'s life is usually corrosion in the frame and fasteners rather than mechanical wear, which is why environment history matters more than age in this category.',
          'Refurbished batches from dealers typically arrive with bearings replaced, new pedals and saddles, resistance systems serviced and frames cleaned and touched in. For an operator opening a studio on a fixed timetable, that is often worth the premium — twenty bikes that all work on day one is a very different proposition from twenty bikes that mostly work.',
          'As-seen studio clearances are where the value is, provided you inspect properly and price the work. A batch that needs bearings on half the bikes and new pedals throughout can still be an excellent deal if you have the time and a bike mechanic, and this equipment is well within the capability of a competent local cycle technician.',
          'Be realistic about what you are taking on with a very cheap batch. Twenty bikes each needing a bottom bracket, a post and a saddle is a project measured in weeks, not an afternoon. Use the free valuation to establish what the bikes are worth in good order, subtract the honest cost of the work, and let that set your offer.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-logistics',
        heading: 'Inspecting and collecting a studio of bikes',
        paragraphs: Object.freeze([
          'Inspect every single bike. This is the category where sampling fails most often, because a studio\'s bikes wear unevenly depending on position in the room and which machines riders favoured. Ride each one, standing and seated, through the full resistance range, and rock the cranks to check the bottom bracket.',
          'Use a numbered checklist so you know which bike is which: frame and fastener corrosion, bottom bracket play or noise, crank and pedal condition, seat and handlebar post movement and locking, all knobs and pins present, resistance function, drive noise and tension, saddle and grip condition, console function, and any cracks or repairs to the frame. Photograph each bike against its number.',
          'Agree the logistics before payment, because volume is the challenge rather than weight. Individual bikes are typically 25 to 60kg and go through a standard door easily, but twenty of them need a suitable van, several trips or a proper load plan, and enough hands at both ends. Fulfilment on Equipd is agreed directly between buyer and seller.',
          'Confirm what travels with the bikes: pedals, seats, handlebars, pop-pins, weight collars and any spares the studio holds. Missing small parts across a batch is the most common post-purchase irritation in this category. Inspect on arrival, count the bikes and the parts, and only confirm handover once you are satisfied, since confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Magnetic against friction resistance, checking bottom brackets and corrosion, and how buying a whole studio of bikes through Equipd works.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Are indoor cycles the same as commercial exercise bikes?',
        answer:
          'No. Indoor cycles, also called spin or studio bikes, have a heavy flywheel and a road-style position designed for out-of-saddle group riding. Commercial upright and recumbent exercise bikes use enclosed resistance and consoles for seated, programmed work on the main floor. Buy indoor cycles for classes and uprights for the gym floor.',
      }),
      Object.freeze({
        question: 'Is magnetic or friction resistance better for a studio?',
        answer:
          'Magnetic resistance is generally the better commercial choice because there is no contact wear, resistance is consistent and repeatable for instructor cues, and there are no pads to replace. Friction bikes give a feel some instructors prefer and use cheap pads, but pad replacement becomes a recurring job across a whole studio.',
      }),
      Object.freeze({
        question: 'What is the biggest problem with ex-studio spin bikes?',
        answer:
          'Sweat corrosion. Bikes live in hot, humid rooms with riders sweating onto the stem, post collar and bottom bracket area, so check under the handlebar stem, around the seat collar and at frame welds. Flaking paint and seized fasteners indicate a bike that was rinsed rather than dried, and that history predicts future problems.',
      }),
      Object.freeze({
        question: 'How do I check the bottom bracket on a used indoor cycle?',
        answer:
          'Hold one crank arm and try to rock it side to side, then spin the cranks slowly and listen for a gritty rumble. Any lateral play or grinding means the bearings need replacing. It is a routine repair on commercial bikes, but across a batch of twenty it becomes a significant cost, so check every machine.',
      }),
      Object.freeze({
        question: 'How many bikes fit in a cycling studio?',
        answer:
          'Each bike occupies roughly 1.2m by 0.5m, but you need space around it for riders to mount, dismount and ride out of the saddle without clashing handlebars, plus instructor sight lines to every position. Work back from a comfortable rider experience rather than the maximum the floor area allows.',
      }),
      Object.freeze({
        question: 'Do indoor cycles need power or a data connection?',
        answer:
          'Most need neither — the bike is self-contained and any computer usually runs on batteries. Models with integrated consoles, connected leaderboards or mains-powered displays are the exception, so confirm the specification for that model. Freedom from sockets is one reason indoor cycles suit converted rooms so well.',
      }),
      Object.freeze({
        question: 'Should I care about power meters on used studio bikes?',
        answer:
          'Only if you run performance or leaderboard programming. If you do, you need consistent, calibratable power output across every bike, which is why brands built around measurement command a premium. For general classes based on cadence and perceived effort, a durable magnetic bike matters far more than power accuracy.',
      }),
      Object.freeze({
        question: 'Is it better to buy a refurbished batch or an as-seen studio clearance?',
        answer:
          'Refurbished batches cost more but arrive with bearings, pedals and saddles sorted so the studio works on opening day. As-seen clearances offer better value if you have time and a competent bike mechanic. The mistake to avoid is buying very cheap bikes that each need a bottom bracket, post and saddle without budgeting the labour.',
      }),
      Object.freeze({
        question: 'What spares should I hold for a studio of used bikes?',
        answer:
          'Pedals, pop-pins and adjustment knobs, seat and handlebar collars, saddles, friction pads if your bikes use them, and bottom bracket bearings for your model. Because a studio batch is identical, one spares box covers every machine, which is a strong argument for buying matched bikes rather than mixing models.',
      }),
      Object.freeze({
        question: 'How do I move twenty indoor cycles?',
        answer:
          'The challenge is volume, not weight — bikes are typically 25 to 60kg and pass through standard doorways. Plan van capacity, trips and hands at both ends, and confirm that pedals, seats and small fixings travel with the machines. Fulfilment is arranged between buyer and seller, so agree collection or delivery before paying.',
      }),
    ]),
    midCtaHeading: 'Kitting out a cycling studio?',
    midCtaLead:
      'Browse used indoor cycles from UK gyms, boutique studios, dealers and refurbishers, including complete matched batches.',
    midCtaLabel: 'Browse Indoor Cycles',
    exploreLead:
      'Keep exploring the commercial cardio range, the brands behind most UK cycling studios, and the Equipd guides to buying, selling and valuing kit.',
    heroTrustItems: Object.freeze([
      'Complete studio batches',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-functional-trainers': Object.freeze({
    eyebrow: 'One frame, most of the gym',
    h1: 'Used Functional Trainers',
    lead: 'Compare used commercial functional trainers and dual adjustable pulleys from gyms, dealers and refurbishers across the UK. Equipd is the marketplace — pay securely by card, get Buyer Protection on eligible purchases and check the model with a free Instant Valuation.',
    metaTitle: 'Used Functional Trainers for Sale UK | Equipd',
    metaDescription:
      'Buy used commercial functional trainers and dual pulley machines from UK sellers. Check cables, pulleys and ceiling height, then buy securely with Buyer Protection.',
    schemaAbout: 'Used commercial functional trainers',
    searchLabel: 'Search functional trainers',
    listingsHeading: 'Live functional trainer listings',
    listingsLead:
      'Dual adjustable pulleys, cable crossovers and functional training rigs listed on Equipd by UK gyms, dealers and refurbishers.',
    listingsCta: 'Browse all functional trainers',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'A functional trainer covers an enormous amount of ground, but most floors still need racks, benches, free weights and a few fixed-path machines around it.',
    brandLead:
      'Life Fitness, Technogym, Precor, Matrix and Keiser all build functional trainers with different cable ratios, weight stacks and attachment systems. Cable length and pulley design vary more than the marketing suggests, so check the specification of the exact model.',
    benefitsHeading: 'Why buy used functional trainers on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'versatility-per-square-metre',
        title: 'The most exercises per square metre',
        body: 'A single dual adjustable pulley covers pressing, pulling, rotation and cable work for one or two users, which is why it is often the first machine into a small studio or PT space and the last one an operator would part with.',
      }),
      Object.freeze({
        id: 'used-value',
        title: 'A premium machine at used money',
        body: 'Functional trainers are expensive new, and commercial units are built around frames and weight stacks that barely age. Buying used typically brings a full-specification machine into the budget of a mid-range new one.',
      }),
      Object.freeze({
        id: 'inspect-and-protect',
        title: 'Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with Buyer Protection on eligible purchases afterwards. Useful on a machine where cable and pulley condition is not obvious from listing photographs.',
      }),
      Object.freeze({
        id: 'valuation',
        title: 'Free valuation on the exact model',
        body: 'Functional trainer values vary widely with stack size, cable ratio and attachment sets. The free Instant Valuation shows the UK range for the specific model so you can judge an asking price properly.',
      }),
    ]),
    valuationEyebrow: 'Replacing a functional area?',
    valuationHeading: 'Value a functional trainer before you deal',
    valuationCopy:
      'Two functional trainers that look similar can be worth very different money depending on stack weight, cable ratio, condition of the pulleys and whether the original attachments are still with the machine. The free Equipd valuation uses the model, year and condition to show a market range, which is the quickest way to sanity-check an asking price or set your own.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the functional trainer model' }),
      Object.freeze({ label: 'Details', body: 'Add stack weight, year and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK market range' }),
      Object.freeze({ label: 'Decide', body: 'Offer, list or keep looking', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used functional trainer buying guide',
    guideIntro:
      'A functional trainer is the most useful single piece of strength equipment most facilities own, and one of the more technical to buy used. Almost everything that matters is hidden: the state of the cables inside the frame, the wear in the pulley grooves, whether the carriages still slide freely on their guide rods, and whether the attachments that make the machine versatile are still with it. The frame and weight stacks, meanwhile, are effectively permanent. That combination means a used functional trainer is either a very good purchase or a frustrating one, decided entirely by how carefully you inspect it. This guide covers specification and cable ratios, the wear points that matter, ceiling height and footprint, cable replacement and maintenance, attachments, brand differences, and how to inspect and install one properly.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'specification',
        heading: 'Cable ratio, stack weight and what the numbers mean',
        paragraphs: Object.freeze([
          'The first thing to establish is the cable ratio, because it determines what the weight stack actually feels like. Many commercial functional trainers use a 2:1 arrangement, where selecting 100kg on the stack delivers roughly 50kg at the handle. Others run 1:1. Neither is better, but they are not comparable, and a buyer expecting 1:1 will find a 2:1 machine surprisingly light.',
          'Stack weight follows from that. A pair of stacks around 80 to 100kg each on a 2:1 machine gives a usable range for the majority of members while still allowing precise small increments for rehab and accessory work. If you train strong athletes on cable movements, check the maximum resistance at the handle rather than the number on the shroud.',
          'Cable travel and pulley adjustment range determine what the machine can do. Long cable travel allows full-range movements and rope work from a low position; a generous number of pulley positions makes it genuinely adjustable rather than a crossover with three settings. Count the positions on the carriage and check the travel at the top and bottom of the range.',
          'Then consider integrated features. Many commercial functional trainers include a chin-up bar, plate storage or a bench, and some come as a half-rack hybrid. Extras are useful in a space-constrained studio but they also add height and width, so confirm they suit the room rather than assuming more is better.',
        ]),
      }),
      Object.freeze({
        id: 'cables-and-pulleys',
        heading: 'Cables, pulleys and carriages — the parts that wear',
        paragraphs: Object.freeze([
          'Cables are the primary consumable and the main risk in a used purchase. Run the whole length of each cable through your fingers where you can reach it, feeling for broken strands, kinks, flat spots and rust. Any fraying at all means the cable needs replacing, and a snapped cable under load is both a safety incident and an out-of-service machine.',
          'Look at the swaged ends and stops, since that is where cables fail most often. Check the crimped fittings for distortion and the cable stops for wear, and pull each handle through its full travel watching the cable enter and leave every pulley cleanly rather than rubbing on a shroud or a frame edge.',
          'Inspect the pulleys themselves. Spin each one and listen for bearing noise, then look into the groove for scoring, a widened channel or a lip that has worn to a sharp edge. A worn pulley groove will chew through a brand-new cable, so replacing cables without replacing bad pulleys is a false economy that people make regularly.',
          'Finally, test the adjustable carriages. Slide each one over the full range of positions and check it moves smoothly and locks positively at every setting. Sticky or notchy travel usually means worn liners or scored guide rods, both fixable but both jobs. Also confirm the selector pins and stack pins are present and undamaged, as replacements are model-specific.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-height',
        heading: 'Ceiling height, footprint and fixings',
        paragraphs: Object.freeze([
          'Ceiling height is the constraint that stops more functional trainer purchases than any other. Commercial units commonly stand somewhere between 2.1 and 2.3m tall, and if there is a chin-up bar the user needs clearance above that. Measure to the lowest obstruction — pipework, lighting and ducting all count — and get the exact overall height of the specific model before you buy.',
          'The frame footprint is typically 1.5 to 2.2m wide and around 1.2m deep, but the usable footprint is much larger. Cable work needs clear space in front and to the sides so a member can step back into a row or a press without meeting a bench, and crossover movements need genuine width. Allow at least a couple of metres of clear working space in front.',
          'Check whether the machine is designed to be bolted down or stands freestanding. Many commercial functional trainers are stable enough freestanding, particularly with loaded stacks, but some specify fixing to the floor or wall and any chin-up bar use makes that more important. Confirm the requirement and whether your floor allows it.',
          'Plan the route in properly. Functional trainers are tall, wide and heavy — often 300kg or more with the stacks — and they usually come apart into a frame, stacks and shrouds for transit. Ask what dismantles and whether the fixings and shroud hardware are complete, because reassembling one of these without the missing bolts is a genuine problem.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance, cable replacement and running costs',
        paragraphs: Object.freeze([
          'Functional trainer maintenance is mostly inspection. Check the cables monthly along their accessible length, look at the pulleys and swages, wipe the guide rods and apply the manufacturer-specified lubricant, and confirm the carriages lock properly. Ten minutes a month will prevent most failures.',
          'Plan cable replacement as an expected cost rather than a fault. Cables have a finite life under commercial use and replacing them on schedule is cheaper and safer than replacing them after a failure. Get a price for a full cable set for the model before you buy, and check availability for that specific generation.',
          'Keep the guide rods and pulley areas clean. Chalk dust and grit are the enemies here — they embed in liners and accelerate wear on both rods and cables. Facilities that allow chalk near a functional trainer should expect to service the carriages more often than those that do not.',
          'Watch the upholstery and attachments too. Handles, ropes, bars and straps wear out through use and disappear through borrowing, and their absence quietly reduces what the machine can do. A small labelled storage rack next to the trainer solves a surprising amount of that.',
        ]),
      }),
      Object.freeze({
        id: 'attachments',
        heading: 'Attachments and what should come with the machine',
        paragraphs: Object.freeze([
          'Attachments are what make a functional trainer functional, and they are frequently missing on used machines. A usable set includes single handles, a rope, a straight or lat bar, an ankle strap and ideally a short bar for rows and presses. Without them the machine is a frame with two cables.',
          'Confirm exactly what is included in writing through Equipd messages before you pay. "With attachments" can mean two handles or a full set, and the difference is real money. Photograph or list the items agreed so there is no ambiguity at handover.',
          'Check attachment compatibility with the cable ends. Commercial machines generally use standard carabiners or clips, but some manufacturers use proprietary fittings, and a machine with proprietary ends and no attachments is more expensive to bring into service than the price suggests.',
          'Consider buying a small stock of good aftermarket attachments regardless. They are inexpensive, they wear out, and having spares means the machine is never limited by a missing rope. It also lets you standardise attachments across several machines if you own more than one.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and parts availability',
        paragraphs: Object.freeze([
          'Life Fitness dual adjustable pulleys are among the most common commercial functional trainers in the UK, which makes them a straightforward used buy: familiar to engineers, well supplied with cables and pulleys and available in enough numbers to compare examples.',
          'Technogym machines including its cable-based functional systems are beautifully engineered and hold value strongly, with parts more often supplied through official channels. Precor and Matrix both offer solid, serviceable functional trainers that represent good value used, with reasonable parts routes on recent generations.',
          'Keiser takes a different approach with pneumatic resistance rather than a weight stack, which gives very light starting resistance and fast changes, making it popular for rehab and speed work. It is a different machine with different maintenance — an air system rather than cables and stacks — so evaluate it on its own terms.',
          'Whatever the brand, the decisive question is whether cables, pulleys, liners and pins are still available for that exact generation. Frames last decades; consumables are what keep the machine in service, so a five-minute call to a parts supplier should be part of every purchase decision.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-refurb-transport',
        heading: 'Refurbished or as-seen, transport and inspection',
        paragraphs: Object.freeze([
          'Refurbished functional trainers should arrive with a new cable set, replaced pulleys where worn, serviced carriages, renewed upholstery and a full attachment set. That is exactly the work most buyers cannot easily do themselves, so the premium is often justified. Ask for the itemised list and keep it in Equipd messages.',
          'As-seen machines suit buyers who can price and carry out cable work. A structurally excellent trainer with tired cables and a couple of worn pulleys is often the best value on the page, provided you have quoted the parts and labour honestly before offering.',
          'Inspect in person given the value and the hidden wear. Work the machine properly: every pulley position on both sides, full cable travel, all stack increments, chin-up bar security if fitted, and listen throughout. Photograph the cables at the swages, the pulley grooves and the guide rods, along with the serial plate.',
          'For transport, fulfilment is agreed directly between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier. These machines are heavy and tall, and the stacks are usually removed for transit, so specialist movers and a clear plan for who dismantles and reassembles are worth arranging in advance.',
          'On arrival, reassemble, load the stacks and test every position before confirming handover. Confirmation is what starts the Buyer Protection window on eligible purchases, so it belongs after you have run the machine, not while a van is still being unloaded.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Cable ratios, hidden wear points, ceiling height and attachments — the questions worth answering before buying a used functional trainer.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What does a 2:1 cable ratio mean on a functional trainer?',
        answer:
          'It means the resistance at the handle is roughly half the weight selected on the stack, so 100kg selected feels like about 50kg in your hands. Many commercial machines use this arrangement to give smoother, finer increments. Always check the ratio before comparing two machines, because their stack numbers are not equivalent.',
      }),
      Object.freeze({
        question: 'How do I know if the cables need replacing?',
        answer:
          'Run your hands along every accessible section feeling for broken strands, kinks, flat spots or rust, and inspect the crimped ends and stops closely. Any fraying means replacement. Also check the pulley grooves, because a worn groove will destroy a new cable, so cables and bad pulleys should be replaced together.',
      }),
      Object.freeze({
        question: 'How much ceiling height does a functional trainer need?',
        answer:
          'Commercial units are commonly 2.1 to 2.3m tall, and you need clearance above that if there is a chin-up bar in use. Measure to the lowest obstruction rather than the ceiling — pipework, lighting and ducting all reduce usable height — and get the exact overall height for the specific model before committing.',
      }),
      Object.freeze({
        question: 'Does a functional trainer need to be bolted to the floor?',
        answer:
          'It depends on the model. Many commercial machines are stable freestanding, especially with loaded stacks, while others specify floor or wall fixing, and chin-up bar use makes fixing more important. Check the manufacturer requirement and confirm your floor construction allows it before delivery day.',
      }),
      Object.freeze({
        question: 'What attachments should come with a used functional trainer?',
        answer:
          'A workable set is two single handles, a rope, a straight or lat bar, an ankle strap and a short bar. Attachments are often missing on used machines, so confirm exactly what is included in Equipd messages before paying — the difference between two handles and a full set is real money.',
      }),
      Object.freeze({
        question: 'How much space do I need around the machine?',
        answer:
          'The frame is typically 1.5 to 2.2m wide and around 1.2m deep, but allow a couple of metres of clear working space in front and to the sides. Cable rows, presses and crossover movements all require the user to step away from the frame, so the usable footprint is much larger than the machine itself.',
      }),
      Object.freeze({
        question: 'How often do commercial functional trainer cables need replacing?',
        answer:
          'It varies with usage, but cables are a finite consumable in commercial service and should be inspected monthly and replaced on condition rather than after failure. Get a price and availability for a full cable set for that generation before you buy, so the cost is part of your purchase decision.',
      }),
      Object.freeze({
        question: 'Why do the pulley carriages feel stiff on some used machines?',
        answer:
          'Usually worn liners or scored guide rods, often accelerated by chalk dust and grit. Both are repairable, but a machine that is notchy through its whole range needs work rather than a wipe down. Test every pulley position on both sides during inspection, as stiffness is often only at certain heights.',
      }),
      Object.freeze({
        question: 'Is a pneumatic trainer a good alternative to a cable machine?',
        answer:
          'It can be. Pneumatic functional trainers offer very light starting resistance and fast changes, which suits rehab, older members and speed-focused work. Maintenance is an air system rather than cables and stacks, so judge it on its own terms and on local support rather than comparing it directly with a weight-stack machine.',
      }),
      Object.freeze({
        question: 'What should I test before confirming handover?',
        answer:
          'Reassemble the machine, load the stacks and work both sides through every pulley position and the full range of stack increments, checking cable travel, carriage locking and any chin-up bar. Confirm handover only when you are satisfied, since that is what starts the Buyer Protection window on eligible purchases.',
      }),
    ]),
    midCtaHeading: 'Ready to compare functional trainers?',
    midCtaLead:
      'Browse used commercial functional trainers and dual adjustable pulleys listed by UK gyms, dealers and refurbishers.',
    midCtaLabel: 'Browse Functional Trainers',
    exploreLead:
      'Continue into the rest of the commercial strength range, the brands behind most UK functional areas, and the Equipd guides to buying and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Commercial-grade frames',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-smith-machines': Object.freeze({
    eyebrow: 'Guided lifting, commercial build',
    h1: 'Used Smith Machines',
    lead: 'Browse used commercial Smith machines from gyms, dealers and refurbishers across the UK. Equipd hosts the marketplace and the secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Smith Machines for Sale UK | Equipd',
    metaDescription:
      'Buy used commercial Smith machines from UK gyms and dealers. Check bearings and guide rods, then pay securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial Smith machines',
    searchLabel: 'Search Smith machines',
    listingsHeading: 'Live Smith machine listings',
    listingsLead:
      'Commercial Smith machines listed on Equipd by UK gyms, dealers and refurbishers, including angled and vertical bar-path units and rack combinations.',
    listingsCta: 'Browse all Smith machines',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'A Smith machine works best alongside free-weight provision. Look at power racks, benches, plate-loaded machines and dumbbells to build a complete strength offer.',
    brandLead:
      'Hammer Strength, Life Fitness, Technogym, Matrix, Cybex and Atlantis all build commercial Smith machines. The differences that matter are bar path angle, whether the carriage runs on bushings or linear bearings, and how the safety catches work.',
    benefitsHeading: 'Why buy used Smith machines on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'built-to-outlast',
        title: 'Steel that outlives the gym it came from',
        body: 'A commercial Smith machine is a heavy welded frame, two guide rods and a carriage. There is very little to fail, which is why well-made units come out of closing gyms after fifteen years still entirely serviceable.',
      }),
      Object.freeze({
        id: 'confidence-for-members',
        title: 'The station less confident members use',
        body: 'Guided pressing and squatting lets members train heavy without a spotter, which makes a Smith machine one of the busiest pieces of strength kit in general-membership gyms and an easy purchase to justify.',
      }),
      Object.freeze({
        id: 'strong-used-value',
        title: 'Substantial savings on new',
        body: 'Because the frame is the product and the frame barely ages, used Smith machines offer some of the best value in commercial strength — often a fraction of new price for a machine with decades of life left.',
      }),
      Object.freeze({
        id: 'secure-purchase',
        title: 'Secure payment and protection',
        body: 'Pay by card through Equipd with funds held until handover is confirmed, and Buyer Protection on eligible purchases. Sensible on kit that usually needs collection from a site you have never visited.',
      }),
    ]),
    valuationEyebrow: 'Clearing a strength floor?',
    valuationHeading: 'Value a Smith machine before you agree terms',
    valuationCopy:
      'Smith machine values depend on the brand, the bar path, whether the carriage runs on linear bearings, and how much the upholstery and finish have suffered. Use the free Equipd valuation on the specific model to see a UK market range from the year and condition, so you can price a clearance realistically or make an offer you can defend.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the Smith machine model' }),
      Object.freeze({ label: 'Details', body: 'Add year, bar path and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the current UK range' }),
      Object.freeze({ label: 'Decide', body: 'Buy, list or negotiate', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used Smith machine buying guide',
    guideIntro:
      'The Smith machine is one of the most durable purchases in commercial strength equipment and one of the least understood. Buyers tend to focus on the badge and the finish when the things that actually determine how the machine feels are the bar path angle, the type of carriage bearing and whether the guide rods have been kept clean and true. A Smith machine with pitted rods and dry bushings feels gritty and sticky no matter how good the paint looks; one with smooth linear bearings and straight rods glides for another twenty years. Add the practical considerations — 200kg-plus of welded steel that has to get through your door, and safety catches that members will rely on when a set goes wrong — and you have a purchase worth doing properly. This guide covers bar path and carriage design, faults and safety checks, dimensions and installation, maintenance, brand differences, lifespan and refurbishment, and how to inspect and move one.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'bar-path-and-carriage',
        heading: 'Bar path, carriage design and how the machine feels',
        paragraphs: Object.freeze([
          'The first thing to establish is whether the bar path is vertical or angled. Vertical Smith machines run the bar straight up and down, which suits pressing and machine-style work. Angled machines, typically leaning back around seven degrees, follow a path closer to a natural squat or press groove and are generally preferred by lifters. Neither is wrong, but they train differently and members will have opinions.',
          'Next, find out how the carriage runs. Cheaper and older machines use nylon or bronze bushings sliding on steel rods, which are serviceable but can feel gritty as they wear. Better commercial machines use linear or roller bearings, which glide noticeably more smoothly and stay that way for far longer. Push and pull the empty bar through its full travel — the difference is immediately obvious.',
          'Check the counterbalance and starting weight. Some Smith machines counterbalance the carriage so the empty bar feels light, others do not and the bar itself may weigh 20kg or more before you add a plate. That matters for programming and for members starting light, so establish the empty bar weight rather than assuming.',
          'Then look at what else the frame offers. Many commercial Smith machines include plate storage, some integrate a half rack or pull-up bar, and some are part of a combination unit. Extra features are useful in a tight space but add width and height, so check the overall dimensions against your floor plan rather than the machine\'s core footprint.',
        ]),
      }),
      Object.freeze({
        id: 'faults-and-safety',
        heading: 'Common faults and the safety checks that matter',
        paragraphs: Object.freeze([
          'Inspect the guide rods along their whole length. Run a hand up each one feeling for pitting, rust, scoring or a slight bend, and look along them from one end to check they are true. Pitted or bent rods make the carriage bind and cannot be polished out; replacing them is possible on some models and impractical on others, so treat this as a primary check.',
          'Test the carriage travel with the bar unloaded and then with a moderate load. It should move smoothly through the full range with no sticking points, no side-to-side slop and no grinding. Worn bushings show as play and a rough feel; a seized or notchy linear bearing usually means contamination or a failed bearing that needs replacing.',
          'The safety catches are the most important part of the machine and the part most often abused. Check the hooks, pins or rotating catches engage positively at every position, that the bar cannot slip past them, and that nothing is bent from a dropped load. A Smith machine with damaged catches is not safe to put on a floor until they are repaired or replaced.',
          'Finish with the frame and fittings. Look for cracked or repaired welds, particularly at the base and where the uprights meet the frame, since a machine that has been dropped or dragged during a previous move can be subtly distorted. Then check the bar sleeves for wear, the plate storage horns for bending, the upholstery on any integrated bench, and the feet and any bolt-down points.',
        ]),
      }),
      Object.freeze({
        id: 'dimensions-and-install',
        heading: 'Dimensions, ceiling height and installation',
        paragraphs: Object.freeze([
          'A commercial Smith machine typically stands 2.2m tall or more and occupies roughly 2.1m by 1.5m, though combination units with plate storage or an integrated rack are wider. You then need working space in front of the bar for the user and space at the sides for loading plates, so allow considerably more than the frame footprint on your plan.',
          'Check ceiling height against the machine height plus the bar at full extension. Overhead pressing inside a Smith machine puts the bar near the top of the rods, and any pull-up bar on the frame needs head clearance above it. Measure to the lowest obstruction in the intended position rather than the highest point of the ceiling.',
          'Most commercial Smith machines specify bolting to the floor, and doing so is good practice regardless. It removes any rocking under heavy use, keeps the frame square so the carriage runs true and is often a requirement of the manufacturer instructions. Confirm your floor construction allows fixing and that you have or can obtain suitable anchors.',
          'Plan the route in with the weight in mind, because these machines run from around 180kg to well over 300kg. They usually break down into uprights, cross members and the carriage assembly, which makes them manageable, but only if all the fixings arrive with the machine and someone knows the order of assembly. Ask whether the manual is available.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance, rods and long-term care',
        paragraphs: Object.freeze([
          'Almost all Smith machine maintenance is about the guide rods. Keep them clean and lightly lubricated to the manufacturer specification, wiping off chalk dust and grit which is what actually damages bushings and bearings. A machine on a floor where chalk is used needs this attention more often.',
          'Check fixings periodically. Heavy use and repeated loading gradually loosen bolts on any welded and bolted frame, and a Smith machine that has developed a slight rock will feel unpleasant and will wear its carriage unevenly. A quarterly check with a torque wrench takes minutes.',
          'Inspect the safety catches and bar stops as a routine item rather than only when something looks wrong. These are the components that carry a failed lift, and they take impact loads that gradually deform hooks and pins. Any deformation should be addressed before the machine goes back into use.',
          'Look after the consumables around the machine: bench upholstery if there is an integrated pad, the bar sleeves, the feet and any pull-up grips. None affect safety directly, but they define whether the machine looks like a considered purchase or a cast-off, and they are cheap to renew.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and what you are paying for',
        paragraphs: Object.freeze([
          'Hammer Strength, part of the Life Fitness group, is the name most associated with serious commercial Smith machines in the UK. The frames are heavy, the bar paths are well judged and the machines are common enough on the used market to compare examples and find parts.',
          'Life Fitness, Matrix and Cybex all build capable commercial Smith machines that appear regularly on used listings, usually at more accessible prices than Hammer Strength for comparable build. Technogym units are superbly finished and often part of a coordinated range, which matters if you are matching an existing floor aesthetic.',
          'Specialist and boutique manufacturers, including UK builders such as Watson and continental names like Atlantis and Panatta, produce Smith machines with distinctive bar paths and very heavy construction. These hold value well used and are worth seeking out if the feel suits your members, though parts may come from a smaller supply chain.',
          'What you pay for across all of them is steel weight, bearing quality and bar path design. Since the frame is essentially permanent, the practical questions are whether guide rods, bearings, bushings and safety catch parts can still be sourced for that model, and whether the geometry suits the way your members lift.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-refurb',
        heading: 'Lifespan, refurbished versus as-seen',
        paragraphs: Object.freeze([
          'The realistic lifespan of a commercial Smith machine is measured in decades. The frame does not wear out in normal use, and the components that do — bushings or bearings, safety catch parts, upholstery and the bar itself — are replaceable. That makes this one of the strongest arguments for buying used strength equipment rather than new.',
          'Refurbishment on a Smith machine usually means new or polished guide rods, replaced bushings or bearings, repaired or replaced safety catches, new upholstery and a repaint or powder coat. A properly refurbished machine can be indistinguishable from new, and because the work is mostly labour it is often worth paying for.',
          'As-seen machines are a good buy if the rods are sound and the catches are undamaged, because everything else is cosmetic or straightforward. The purchases to avoid are those with pitted or bent rods, cracked welds or deformed safety catches, since those are the faults that are expensive or impossible to put right.',
          'Powder coating is worth mentioning separately. A tired-looking frame in sound mechanical condition can be stripped and recoated for a fraction of the price difference between a scruffy machine and a pristine one, which is a legitimate strategy for an operator with time before opening.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-transport',
        heading: 'Inspecting and moving a Smith machine',
        paragraphs: Object.freeze([
          'Inspect in person and take a couple of plates with you if you can, or ask the seller to have some available. An empty bar tells you far less than a loaded one, and carriage play, rod binding and frame movement all show up much more clearly under 60 or 80kg.',
          'Work through a checklist and photograph as you go: guide rod condition along the full length, carriage travel loaded and unloaded, side play, safety catch engagement at every position, bar sleeve wear, weld condition especially at the base, plate horn straightness, upholstery, feet and fixings, and the serial or model plate.',
          'Agree transport before payment. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and these machines are heavy enough that a proper plan matters. Confirm whether it will be dismantled, who is doing the dismantling, and that every bolt is bagged and labelled.',
          'Reassemble on site with the machine square and, ideally, bolted down before you load it. Then run the carriage through its travel loaded, test the catches, and only confirm handover once you are satisfied — confirmation is what starts the Buyer Protection window on eligible purchases, so it belongs after the machine is assembled and tested rather than at the kerbside.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Bar paths, bearings, safety catches and installation — what to check before buying a used commercial Smith machine on Equipd.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Should I buy an angled or vertical Smith machine?',
        answer:
          'Angled machines, usually leaning back around seven degrees, follow a path closer to a natural squat or press groove and are generally preferred by lifters. Vertical machines suit pressing and machine-style training. Both are legitimate commercial designs, so choose based on how your members train rather than assuming one is superior.',
      }),
      Object.freeze({
        question: 'What is the difference between bushings and linear bearings?',
        answer:
          'Bushings are sleeves sliding directly on the guide rods, and they can feel gritty as they wear. Linear or roller bearings glide far more smoothly and last much longer, which is why better commercial machines use them. Push the empty bar through its full travel on any machine you inspect — the difference is immediately noticeable.',
      }),
      Object.freeze({
        question: 'How do I check the guide rods on a used Smith machine?',
        answer:
          'Run a hand along the whole length of each rod feeling for pitting, rust and scoring, then sight along them to check they are straight. Pitted or bent rods make the carriage bind and cannot be polished out. Replacement is possible on some models and impractical on others, so treat rod condition as a deal-breaker check.',
      }),
      Object.freeze({
        question: 'How much does the bar weigh on a Smith machine?',
        answer:
          'It varies. Some machines counterbalance the carriage so the empty bar feels light, while others have a starting weight of 20kg or more before any plates. Establish the empty bar weight for the specific model, because it affects programming and matters to members who are starting with lighter loads.',
      }),
      Object.freeze({
        question: 'Do Smith machines have to be bolted to the floor?',
        answer:
          'Most commercial models specify it and it is good practice regardless. Bolting down eliminates rocking under heavy loads, keeps the frame square so the carriage runs true, and is often part of the manufacturer instructions. Confirm your floor construction supports anchoring before delivery.',
      }),
      Object.freeze({
        question: 'How much space does a Smith machine need?',
        answer:
          'Typically around 2.1m by 1.5m of frame footprint and 2.2m or more in height, with combination units wider. Add working space in front for the lifter and clear access at the sides for loading plates, and check ceiling height against the bar at full extension plus any pull-up bar on the frame.',
      }),
      Object.freeze({
        question: 'What should I check on the safety catches?',
        answer:
          'Confirm the hooks, pins or rotating catches engage positively at every position, that the bar cannot slip past them and that nothing is bent from a dropped load. These components carry failed lifts, so any deformation must be repaired or replaced before the machine goes into service.',
      }),
      Object.freeze({
        question: 'How heavy is a commercial Smith machine to move?',
        answer:
          'From around 180kg to well over 300kg depending on the model and whether plate storage is included. They generally dismantle into uprights, cross members and the carriage assembly, which makes transport manageable — but only if all the fixings arrive with the machine and someone knows the assembly sequence.',
      }),
      Object.freeze({
        question: 'Is it worth having a Smith machine powder coated?',
        answer:
          'Often yes. A mechanically sound machine with tired paint can be stripped and recoated for a fraction of the price difference between a scruffy unit and a pristine one. If you have time before opening, buying on mechanical condition and refinishing the frame is a sensible way to stretch a strength budget.',
      }),
      Object.freeze({
        question: 'What should I check once the machine is assembled?',
        answer:
          'Ideally bolt it down, load the bar with a moderate weight and run the carriage through its full travel checking for play or binding, then test the safety catches at several positions. Confirm handover only when satisfied, as that starts the Buyer Protection window on eligible purchases.',
      }),
    ]),
    midCtaHeading: 'Looking for a Smith machine?',
    midCtaLead:
      'Compare used commercial Smith machines from UK gyms, dealers and refurbishers, including angled and vertical bar paths.',
    midCtaLabel: 'Browse Smith Machines',
    exploreLead:
      'Explore more commercial strength categories, the brands that build most UK strength floors, and the Equipd guides to buying and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Heavy commercial frames',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-power-racks': Object.freeze({
    eyebrow: 'The backbone of a strength floor',
    h1: 'Used Commercial Power Racks',
    lead: 'Find used commercial power racks, squat racks and half racks from gyms, dealers and refurbishers across the UK. Equipd is the marketplace: pay securely by card, get Buyer Protection on eligible purchases and value any rack free before you buy.',
    metaTitle: 'Used Commercial Power Racks for Sale UK | Equipd',
    metaDescription:
      'Used commercial power racks, squat racks and half racks from UK gyms and dealers. Check uprights, J-cups and safeties, then buy securely with Buyer Protection.',
    schemaAbout: 'Used commercial power racks and squat racks',
    searchLabel: 'Search power racks',
    listingsHeading: 'Live power rack listings',
    listingsLead:
      'Full racks, half racks, squat stands and rigs listed on Equipd by UK gyms, strength facilities, dealers and refurbishers.',
    listingsCta: 'Browse all power racks',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'A rack needs a bar, plates and a bench to be useful. Look at commercial benches, dumbbells and plate-loaded machines to complete the strength area around it.',
    brandLead:
      'Hammer Strength, Eleiko, Rogue, Watson, Jordan and Escape all build commercial racks, with differences in upright size, steel gauge, hole spacing and attachment ecosystems that affect what you can bolt on later.',
    benefitsHeading: 'Why buy used commercial power racks on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'steel-doesnt-wear-out',
        title: 'Steel does not wear out',
        body: 'A commercial rack is welded steel with a handful of consumable liners and pins. Barring impact damage, a used rack from a closing gym is functionally identical to a new one at a fraction of the price.',
      }),
      Object.freeze({
        id: 'facility-grade-uprights',
        title: 'Facility-grade uprights within budget',
        body: 'Heavy 75mm uprights and thick-gauge steel cost real money new. Buying used is usually how a smaller studio or strength gym ends up with genuinely commercial racks instead of light-duty alternatives.',
      }),
      Object.freeze({
        id: 'complete-with-attachments',
        title: 'Often complete with attachments',
        body: 'Gyms clearing a floor tend to sell racks with the J-cups, safeties, dip bars and plate horns they came with, which is where a lot of the value sits — attachments bought separately add up quickly.',
      }),
      Object.freeze({
        id: 'protected-payment',
        title: 'Protected payment on collection deals',
        body: 'Racks are usually collected rather than delivered. Paying through Equipd means funds are held until handover is confirmed, with Buyer Protection on eligible purchases, instead of transferring money to a stranger in advance.',
      }),
    ]),
    valuationEyebrow: 'Clearing racks from a refit?',
    valuationHeading: 'Value a power rack before you buy or sell',
    valuationCopy:
      'Rack values depend far more on brand, upright size and included attachments than on age, which is why asking prices for apparently similar racks vary so widely. The free Equipd valuation gives you a market range for the specific model and condition, so you can price a clearance sensibly or judge whether a listing is a bargain or wishful thinking.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the rack model or brand' }),
      Object.freeze({ label: 'Details', body: 'Add upright size, year and attachments' }),
      Object.freeze({ label: 'Estimate', body: 'See what comparable racks fetch' }),
      Object.freeze({ label: 'Decide', body: 'Offer, list or keep watching', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial power rack buying guide',
    guideIntro:
      'Power racks are the most straightforward major purchase in commercial strength equipment and the one where used buying makes the most obvious sense. There is no motor, no cable, no upholstery and nothing to calibrate — a rack is welded steel with a set of liners and pins. What varies is the specification: upright dimensions, steel thickness, hole spacing and diameter, the attachment ecosystem, and whether the whole thing has been squared and bolted down or dragged around a gym for a decade. Those details decide whether a rack is a lifetime asset or a wobbling frustration, and they also determine whether you can buy attachments for it in three years. This guide covers rack types and specification, damage and safety inspection, footprint and fixing, maintenance, brand and attachment compatibility, lifespan and refinishing, and how to move a rack sensibly.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'rack-types',
        heading: 'Full racks, half racks, squat stands and rigs',
        paragraphs: Object.freeze([
          'A full power rack has four uprights and enclosed safety bars, which makes it the safest option for lifters training alone and the natural choice for a general-membership floor. It occupies the most space and needs clear access at the front, but it also does the most: squat, press, bench inside it, and pull up from the top bar.',
          'Half racks use two main uprights with a supporting rear structure, giving open access for squatting out and taking up less depth. They suit facilities where lifters are competent and coached, and they often carry more attachments and plate storage on the rear. Squat stands are simpler still, cheap to buy used and easy to move, but they offer the least safety margin.',
          'Rigs are multi-station structures, effectively several racks joined together with shared uprights. On the used market they are excellent value per station because sellers want the whole thing gone, but they are inflexible: you need the floor space and the ceiling height for the entire structure and you cannot easily use half of it.',
          'Match the type to your members. If people train unsupervised at heavy loads, full racks with proper safeties are the responsible choice. If you run coached strength sessions or have limited depth, half racks give more layout freedom. Buying two half racks rather than one full rack is often the better use of a small floor.',
        ]),
      }),
      Object.freeze({
        id: 'specification',
        heading: 'Upright size, steel gauge and hole spacing',
        paragraphs: Object.freeze([
          'Upright dimensions are the headline specification. Commercial racks commonly use 75mm square uprights, while lighter-duty racks use 60mm. The larger section is stiffer and feels more solid under heavy load, and it also determines which attachments will fit — a 75mm rack will not take 60mm accessories and vice versa.',
          'Steel thickness matters as much as the outside dimension. Two racks with identical 75mm uprights can have quite different wall thickness, and the thinner one will flex more and is more likely to deform around the holes over years of heavy J-cup use. If the specification is available for the model, check it; if not, the weight of the rack is a reasonable proxy.',
          'Hole spacing and diameter determine adjustability and compatibility. Closer spacing in the bench and squat range lets lifters find the exact height they want, which is a real quality-of-life difference. Hole diameter affects which pins and attachments fit, and mixed standards are the main reason people end up unable to buy accessories for an older rack.',
          'Check what safety system the rack uses. Pin-and-pipe safeties, flip-down safety bars and strap safeties all work, but they differ in how quickly they adjust and how much they punish a dropped bar. Straps are kinder to bars and floors; steel safeties are more robust and easier to keep track of. Whichever it is, the rack needs a complete, undamaged set.',
        ]),
      }),
      Object.freeze({
        id: 'damage-inspection',
        heading: 'Inspecting for damage that actually matters',
        paragraphs: Object.freeze([
          'Sight along every upright from top to bottom looking for bowing or bending. Uprights are usually damaged in one of two ways: repeated heavy loading on the safeties, or a rough dismantle and move. A visibly bent upright compromises the whole structure and is not something you should design a floor around.',
          'Examine the holes closely, particularly in the bench press and squat range where J-cups sit. Ovalled, deformed or torn holes indicate years of heavy use with metal-on-metal J-cups and they will let attachments move under load. Some deformation is cosmetic; holes that have visibly opened up are a genuine concern.',
          'Check the welds at the base, at every cross member and around any bolt plates. Cracked or hastily repaired welds are the most serious fault you can find on a rack, and given how many sound racks are available used there is no reason to take one on. Look for evidence of the frame having been forced back into shape.',
          'Then check what is bolted on. J-cups should have intact plastic or UHMW liners, since bare metal cups chew both bars and uprights. Safeties should be straight and complete, pull-up bars secure and knurling serviceable, pins present and undamaged, and plate horns straight rather than drooping. Surface rust on steel is cosmetic; deep pitting on a bar-contact surface is not.',
        ]),
      }),
      Object.freeze({
        id: 'footprint-and-fixing',
        heading: 'Footprint, ceiling height and bolting down',
        paragraphs: Object.freeze([
          'A full commercial rack typically occupies around 1.5m by 1.5m and stands 2.1 to 2.4m tall, though depth varies a lot with plate storage and attachments. The rack footprint is only the start: allow room to walk a bar out at the front, load plates at the sides, and use a bench inside or in front of it. In practice a rack station wants three metres of clear space in one direction.',
          'Ceiling height needs checking against the rack height plus overhead use. Pressing overhead inside a rack and using the pull-up bar both need clearance above the frame, and low ceilings are the most common reason a rack has to be positioned somewhere less convenient. Measure to the lowest obstruction in the intended spot.',
          'Bolting down is strongly preferred for commercial racks and essential for most half racks and rigs, which rely on floor fixing for stability when a bar is racked hard on one side. Confirm your floor construction and check the rack has undamaged base plates with usable holes — a rack whose base plates have been drilled several times in previous installations is worth a closer look.',
          'Think about flooring under and around the rack. Heavy rubber matting or a lifting platform protects the substrate, reduces noise transmission and stops plates chipping the floor. It is much easier to lay before the rack goes in than to work around afterwards.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and consumables',
        paragraphs: Object.freeze([
          'Racks need very little, but the little they need matters. Check the fixings periodically, particularly the base bolts and any bolted cross members, because repeated heavy loading loosens them and a rack that has developed movement will wear its holes faster.',
          'Treat J-cup liners as consumables. Once a liner has worn through to bare metal, the cup starts marking bars and the upright, so replacing liners is cheap protection for expensive bars. Keep spare liners for the model if you can, and check the fit is correct rather than approximate.',
          'Keep an eye on safeties and pins. Steel safeties take impact loads and will eventually bend; straps stretch and fray. Replace them when they show damage rather than waiting, because these are the components members trust when a lift fails.',
          'For appearance, surface rust responds well to light abrasion and touch-up paint, and a heavily used rack can be stripped and powder coated to look new. That is worth planning if you are buying an older rack for a customer-facing floor, and it is far cheaper than the price difference between a scruffy rack and a pristine one.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-attachments',
        heading: 'Brands, attachment ecosystems and compatibility',
        paragraphs: Object.freeze([
          'The practical difference between rack brands is less about steel quality than about the attachment ecosystem. Buying into a system where the manufacturer still sells J-cups, safeties, dip bars and landmines for your upright size and hole pattern means you can extend the rack for years. Buying an orphan rack means making do with what came with it.',
          'Hammer Strength racks are widespread in UK commercial gyms with heavy construction and good availability used. Eleiko and Watson sit at the premium end with exceptional build and strong resale, particularly among strength-focused facilities. Rogue is extremely well supported for accessories, and Jordan and Escape are common in UK gyms and leisure centres at more accessible prices.',
          'Whatever the badge, check the upright dimension and hole pattern before buying attachments, and ideally before buying the rack. Many aftermarket accessories are made for common standards, so a rack using a widespread upright size and hole spacing is easier and cheaper to live with than an unusual one.',
          'If you are buying multiple racks for a floor, standardise. One upright size, one hole pattern and one set of attachment types means J-cups and safeties are interchangeable across every station, which simplifies both spares and daily operation.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-transport',
        heading: 'Lifespan, transport and inspection before you pay',
        paragraphs: Object.freeze([
          'A commercial rack in sound condition has an effectively unlimited working life. Nothing wears out except liners, pins and finish, which is why the used market is full of racks from gyms that have closed or rebranded rather than from racks that have failed. Judge on damage rather than age.',
          'Refurbished racks usually mean a strip, powder coat and new liners and pins, which is largely cosmetic work but does produce a rack that looks new. As-seen racks are perfectly good if the uprights are straight, the holes are sound and the welds are clean, and they are where the value is.',
          'Transport is manageable because racks dismantle. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and most racks come apart into uprights, cross members and attachments that fit in a van. The critical detail is that every bolt, pin and attachment travels with the rack, so agree who dismantles and insist that hardware is bagged.',
          'Inspect before you pay, ideally with a bar and a couple of plates. Rack a bar in the J-cups, check they sit properly, load the safeties if the seller permits it, and try the pull-up bar. Photograph the uprights, the holes in the bench and squat range, the welds and the full set of attachments, then only confirm handover once the rack is on your floor and you are satisfied — confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Upright sizes, hole spacing, bolting down and attachment compatibility — the practical questions when buying used commercial racks.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What is the difference between a full rack and a half rack?',
        answer:
          'A full power rack has four uprights and enclosed safety bars, which is the safest option for lifters training alone. A half rack uses two main uprights with a rear support structure, giving open access and a smaller depth. Full racks suit unsupervised general-membership floors; half racks give more layout flexibility in tight spaces.',
      }),
      Object.freeze({
        question: 'Does upright size really matter on a commercial rack?',
        answer:
          'Yes, for two reasons. Larger 75mm uprights are stiffer under heavy load than 60mm sections, and upright size determines which attachments fit. A 75mm rack will not accept 60mm accessories, so the size you buy dictates your attachment options for the life of the rack.',
      }),
      Object.freeze({
        question: 'How can I tell if a used rack has been damaged?',
        answer:
          'Sight along each upright for bowing, examine the holes in the bench and squat range for ovalling or tearing, and check the welds at the base and cross members for cracks or repairs. Bent uprights and cracked welds are reasons to walk away; surface rust and worn liners are not.',
      }),
      Object.freeze({
        question: 'Do power racks need to be bolted to the floor?',
        answer:
          'It is strongly preferred on commercial full racks and effectively essential on half racks and rigs, which rely on floor fixing for stability when a bar is racked heavily on one side. Confirm your floor construction supports anchoring and check the base plates are undamaged with usable holes.',
      }),
      Object.freeze({
        question: 'How much space does a rack station need?',
        answer:
          'The rack itself is commonly around 1.5m by 1.5m and 2.1 to 2.4m tall, but a usable station needs room to walk a bar out, load plates at the sides and use a bench. Allow roughly three metres of clear space in one direction, and check ceiling height for overhead pressing and pull-ups.',
      }),
      Object.freeze({
        question: 'Why does hole spacing matter?',
        answer:
          'Closer spacing through the bench and squat range lets lifters set J-cups and safeties at exactly the right height, which is a noticeable quality difference in use. Hole diameter and pattern also determine which pins and attachments fit, and mismatched standards are the usual reason older racks cannot be extended.',
      }),
      Object.freeze({
        question: 'Are steel safety bars or strap safeties better?',
        answer:
          'Both work. Straps are gentler on bars and floors and absorb a dropped bar more kindly, while steel safeties are more robust and simpler to manage. What matters more is that the set is complete and undamaged, since these are the components a lifter relies on when a set goes wrong.',
      }),
      Object.freeze({
        question: 'Should I buy a rig or several separate racks?',
        answer:
          'Rigs offer excellent value per station used because sellers want the whole structure gone, but they are inflexible — you need the floor space and ceiling height for the entire thing and cannot easily use part of it. Separate racks cost more per station but let you lay out and expand the floor gradually.',
      }),
      Object.freeze({
        question: 'Can a scruffy rack be made to look new?',
        answer:
          'Yes. Stripping and powder coating a mechanically sound rack, along with new J-cup liners and pins, produces something close to new for far less than the price gap between a tired rack and a pristine one. If you have time before opening, buying on structural condition and refinishing is a sound strategy.',
      }),
      Object.freeze({
        question: 'What should I make sure comes with the rack?',
        answer:
          'J-cups with intact liners, a complete undamaged set of safeties, all pins, any dip bars, plate horns and the pull-up bar, plus every bolt from the dismantle. Attachments are a large part of a rack\'s value, so list what is included in Equipd messages and count everything before confirming handover.',
      }),
    ]),
    midCtaHeading: 'Ready to find a power rack?',
    midCtaLead:
      'Browse used commercial racks, half racks, squat stands and rigs listed by UK gyms, dealers and refurbishers.',
    midCtaLabel: 'Browse Power Racks',
    exploreLead:
      'Keep going through the commercial strength range, the brands behind most UK strength floors, and the Equipd guides to buying, selling and valuing kit.',
    heroTrustItems: Object.freeze([
      'Commercial 75mm uprights',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-cable-machines': Object.freeze({
    eyebrow: 'Smooth resistance, endless variations',
    h1: 'Used Commercial Cable Machines',
    lead: 'Buy used commercial cable machines — lat pulldowns, seated rows, crossovers and dual pulley stations — from UK gyms, dealers and refurbishers on Equipd. Secure card payment, Buyer Protection on eligible purchases and a free Instant Valuation on every model.',
    metaTitle: 'Used Commercial Cable Machines for Sale | Equipd',
    metaDescription:
      'Used commercial cable machines from UK gyms and dealers — pulldowns, rows and crossovers. Check cables and pulleys, then buy securely with Buyer Protection.',
    schemaAbout: 'Used commercial cable machines',
    searchLabel: 'Search cable machines',
    listingsHeading: 'Live cable machine listings',
    listingsLead:
      'Lat pulldowns, seated rows, cable crossovers and dual pulley stations listed on Equipd by UK gyms, dealers and refurbishers.',
    listingsCta: 'Browse all cable machines',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'Cable stations complement fixed-path machines and free weights rather than replacing them. Look at pin-loaded and plate-loaded machines, racks and benches to round out the floor.',
    brandLead:
      'Life Fitness, Technogym, Cybex, Precor, Matrix, Gym80 and Panatta all build commercial cable equipment. Pulley quality, cable routing and the availability of replacement cable assemblies are what separate them on the used market.',
    benefitsHeading: 'Why buy used commercial cable machines on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'accessible-strength',
        title: 'The most used stations on a floor',
        body: 'Cable machines suit every ability level, which is why pulldowns and rows are among the busiest stations in general-membership gyms. Buying used is the quickest way to add several of them without a new-equipment budget.',
      }),
      Object.freeze({
        id: 'long-frame-life',
        title: 'Frames and stacks that barely age',
        body: 'The frame, weight stack and guide rods on a commercial cable machine are effectively permanent. What wears — cables, pulleys, liners and upholstery — is replaceable, which makes used buying low risk if you inspect properly.',
      }),
      Object.freeze({
        id: 'compare-configurations',
        title: 'Compare configurations, not just prices',
        body: 'Equipd brings single stations, dual stacks and crossovers together, so you can work out whether two single machines or one dual station suits your floor better before you commit.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment and protection',
        body: 'Pay through Equipd with funds held until handover is confirmed, and Buyer Protection on eligible purchases — worth having when cable and pulley wear is invisible in listing photographs.',
      }),
    ]),
    valuationEyebrow: 'Selling surplus cable stations?',
    valuationHeading: 'Value cable machines before you commit',
    valuationCopy:
      'Cable machine prices vary with configuration, stack weight, upholstery condition and how much cable and pulley work a unit needs. The free Equipd valuation gives you a UK market range for the exact model based on year and condition, which is the fastest way to test whether an asking price reflects the state of the machine.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the cable station model' }),
      Object.freeze({ label: 'Details', body: 'Add stack weight, year and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK market range' }),
      Object.freeze({ label: 'Decide', body: 'Negotiate, buy or list yours', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial cable machine buying guide',
    guideIntro:
      'Cable machines are among the best value purchases in used commercial strength equipment, because the expensive parts do not wear and the parts that do wear are cheap. A twenty-year-old lat pulldown with a fresh cable, good pulleys and new upholstery works exactly as well as a new one, and it costs a small fraction of the price. The catch is that all the wear is hidden inside the frame and behind the shrouds, and a cable that has been running over a scored pulley for two years will fail whether or not you noticed it during your visit. This guide covers choosing configurations, understanding cables, pulleys and stacks, the faults that matter, footprint and installation, maintenance and cable replacement, brand and parts differences, and how to inspect, refurbish and transport a cable station.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'configurations',
        heading: 'Choosing configurations for your floor',
        paragraphs: Object.freeze([
          'Single-station machines — a dedicated lat pulldown or seated row — are simple, cheap used and always in demand with members. They are the right choice when you have space and want stations that need no explanation, and because they are so common you can usually find several examples to compare.',
          'Dual-station units combine two exercises around one or two stacks, typically pulldown and low row, and use floor space far more efficiently. The trade-off is that only one exercise can be performed at a time on some designs, which creates queues at peak hours on a busy floor.',
          'Cable crossovers and dual adjustable pulleys give the widest exercise range and are the most flexible stations you can buy, but they need the most space and the most ceiling height. If you are choosing between a crossover and two single machines, think about how your members actually train rather than how many exercises the brochure lists.',
          'Consider weight stack increments as well as maximum weight. Cable work often needs small jumps, and machines with 2.5kg or 5kg increments plus an add-on weight are far more useful for rehab and progression than ones with coarse steps. Also check whether the stack has an accessible top plate for add-on weights, which is a small but genuinely useful feature.',
        ]),
      }),
      Object.freeze({
        id: 'cables-and-pulleys',
        heading: 'Cables, swages and pulleys — where the risk sits',
        paragraphs: Object.freeze([
          'Commercial cable assemblies are steel wire rope with a nylon coating and crimped fittings at each end. They fail progressively: the coating splits, individual strands break, and the cable eventually parts. Any visible broken strand or split coating means replacement, and it means the machine should not be used until it is done.',
          'Check the swaged ends and the terminations at the stack and the handle. Most cable failures occur at or near the fittings, where the rope flexes repeatedly over a small radius. Look for rust weeping from a swage, distortion of the fitting, or a cable that has begun to unlay near the end.',
          'Inspect every pulley, not just the visible ones. Spin each wheel and listen for bearing noise or roughness, then look into the groove. A groove that has worn deeper or developed a sharp lip will cut a new cable quickly, which is why replacing cables without addressing worn pulleys is a common and expensive mistake.',
          'Follow the cable route through the machine, removing shrouds where the seller allows. Cables should run cleanly through every pulley without rubbing on a frame member, a shroud edge or another cable. Rubbing is a sign the machine has been reassembled incorrectly at some point, which is very common on equipment that has moved sites.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults beyond the cables',
        paragraphs: Object.freeze([
          'Weight stack guide rods are the next thing to check. Lift the stack by hand or with the selector pin high and watch how the plates travel — they should rise and fall smoothly and quietly. Notchy, gritty or noisy travel usually means dirty or dry rods, worn plate liners or slightly bent rods. Bent rods are the serious version and are worth walking away from.',
          'Check the selector pin and the holes in the plates. A worn pin, or plates whose holes have deformed from years of a slightly bent pin being forced in, cause the frustrating problem where a member cannot easily select a weight. Replacement pins are cheap and model-specific, so establish availability.',
          'Upholstery and pads make a bigger difference on cable machines than most buyers expect, because they are what the member touches. Split vinyl, compressed foam, sagging seats and worn chest pads on rows are all normal on ex-facility kit, and reupholstering is affordable but should be reflected in the price rather than absorbed afterwards.',
          'Finally, look at the frame and fittings. Check welds at the base and around the stack tower, look for corrosion behind shrouds and under seats, confirm all shrouds and covers are present, and check adjustment mechanisms — seat height, thigh pads, foot plates — move and lock properly. Missing shrouds are both a safety and appearance problem and are often unobtainable for older models.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-install',
        heading: 'Footprint, height and installation',
        paragraphs: Object.freeze([
          'Single cable stations are relatively compact — a lat pulldown often needs around 1.2m by 1.5m plus user space — but they are tall, typically 2.1m or more to the top pulley. Crossovers are the demanding ones, needing 3m or more of width and a top pulley height above 2.3m to work properly.',
          'Measure ceiling height in the intended position and remember the cable needs to run above the top pulley housing. A crossover in a room with insufficient height simply does not give the pulling angles it is designed for, which frustrates members and wastes the floor space it occupies.',
          'Allow generous working space in front of each station. Seated rows need room for the user\'s legs and for the seat travel; pulldowns need space for a member to get in and out of the thigh pads; crossovers need width for the full movement. Cramming stations is the most common mistake on cable-heavy floors.',
          'Check whether the machine specifies floor fixing. Many single stations with heavy stacks are stable freestanding, while crossovers and taller frames commonly require bolting down. Confirm the manufacturer requirement and your floor construction, and lay matting before installation rather than after.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance, cable replacement and consumables',
        paragraphs: Object.freeze([
          'Set a monthly cable inspection as a fixed routine. Check the full accessible length of every cable, the swaged ends, and the pulley grooves, and confirm nothing is rubbing. On a floor with several cable stations this is a short job that prevents the one failure that would otherwise take a station out during peak hours.',
          'Clean and lubricate the weight stack guide rods to the manufacturer specification, and keep chalk dust away from them where possible. Dust and chalk embed in plate liners and are the main cause of stacks that feel rough after a few years in an otherwise well-kept gym.',
          'Budget cable replacement as a planned cost. Cables have a finite service life under commercial use, and replacing them on schedule is far cheaper than the disruption of a failure. Before buying, get pricing and availability for a full cable set for that specific model and generation.',
          'Keep spare selector pins, plate liners and a set of common attachments. Pins go missing, liners wear, and handles walk off, and a small labelled stock next to the equipment prevents a fully functional machine sitting unusable because nobody can find a pin.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and parts availability',
        paragraphs: Object.freeze([
          'Life Fitness and Cybex cable equipment is extremely common in UK gyms, which is a practical advantage used: engineers know the machines, cable assemblies and pulleys are widely available, and there is enough stock to compare condition rather than take the first example you find.',
          'Technogym and Precor build excellent cable machines with strong ergonomics and finish, generally sitting higher on the used price scale, with parts more often supplied through official routes. Matrix offers good value with sound design and reasonable parts support on recent generations.',
          'European specialists such as Gym80 and Panatta are heavily built with very solid frames and are popular with strength-focused gyms. They hold value well used, though parts supply runs through a smaller network, so check before buying if you expect to need cables or pulleys quickly.',
          'The decisive question across all brands is whether cable assemblies, pulleys, liners, pins and shrouds are still available for the exact model. Frames last decades; a cable machine whose specific cable assembly is discontinued becomes a workshop project. One call to a parts supplier answers it.',
        ]),
      }),
      Object.freeze({
        id: 'refurb-and-transport',
        heading: 'Refurbished versus as-seen, transport and inspection',
        paragraphs: Object.freeze([
          'Refurbished cable machines should come with new cables throughout, replaced pulleys where worn, serviced guide rods, new upholstery and complete shrouds. That is a lot of labour, and because the work is exactly what most buyers cannot do easily, the premium is often good value for a facility opening to a deadline.',
          'As-seen machines are excellent value if you have someone who can fit cables and source pulleys. A structurally sound station with a tired cable and split upholstery is often the cheapest way to add a good machine to a floor, provided you have priced the parts and labour before offering rather than after delivery.',
          'Inspect thoroughly and use the stack. Select several different weights, perform full repetitions on every station, and listen throughout. Faults on cable machines are often revealed only under load and through the full range, particularly cables catching and stacks travelling roughly at the top or bottom.',
          'Plan transport with dismantling in mind. Fulfilment on Equipd is arranged between buyer and seller — collection, seller delivery or a buyer-arranged courier — and cable machines usually break down into a frame, stack and shrouds. The critical detail is that cables must be released and reinstalled correctly, so agree who dismantles and, if possible, have the same person or an experienced engineer reassemble.',
          'On arrival, reassemble, check cable routing carefully before loading, then run every station through its range before confirming handover. Confirmation is what starts the Buyer Protection window on eligible purchases, so it should follow a proper test rather than a signature at the door.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Cable wear, pulley grooves, stack travel and space requirements — what matters when buying used commercial cable equipment.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'How do I inspect the cables on a used commercial machine?',
        answer:
          'Check the full accessible length for split coating, broken strands, kinks and rust, then look closely at the crimped ends where most failures start. Also follow the cable route through every pulley to make sure nothing rubs on the frame or shrouds. Any broken strand means the cable must be replaced before use.',
      }),
      Object.freeze({
        question: 'Why do worn pulleys matter if I am replacing the cables anyway?',
        answer:
          'Because a pulley groove that has worn deeper or developed a sharp lip will cut through a new cable quickly. Replacing cables without addressing bad pulleys is a common and expensive mistake, so spin each pulley to check the bearing and inspect the groove during your inspection.',
      }),
      Object.freeze({
        question: 'What causes a weight stack to feel rough or notchy?',
        answer:
          'Usually dirty or dry guide rods, worn plate liners, or chalk dust embedded in the liners. All are straightforward to put right. The serious version is a slightly bent guide rod, which causes binding that cleaning will not fix, so watch the plates travel through the full range before you buy.',
      }),
      Object.freeze({
        question: 'Should I buy single stations or a dual cable machine?',
        answer:
          'Single stations are cheaper used, simpler and never queue-block each other. Dual stations use floor space more efficiently but on some designs only one exercise can be used at a time, which causes queues at peak hours. Decide based on your floor area and how busy your strength area gets.',
      }),
      Object.freeze({
        question: 'How much ceiling height does a cable crossover need?',
        answer:
          'A crossover needs its top pulleys well above 2.3m to give the pulling angles it is designed for, plus clearance for the cable and housing. Measure to the lowest obstruction in the intended position, because a crossover in a low room simply will not deliver the movements members expect from it.',
      }),
      Object.freeze({
        question: 'How often should commercial cables be replaced?',
        answer:
          'They are a finite consumable in commercial use and should be inspected monthly and replaced on condition rather than after failure. Get pricing and availability for a full cable set for the specific model before buying, so the cost is part of your decision rather than a surprise later.',
      }),
      Object.freeze({
        question: 'Is worn upholstery a problem on cable machines?',
        answer:
          'It affects value rather than function, but it matters more here than on most equipment because pads and seats are what members touch. Reupholstering is affordable and transforms how a used machine looks, so price it into your offer rather than absorbing the cost after delivery.',
      }),
      Object.freeze({
        question: 'Are missing shrouds and covers a serious issue?',
        answer:
          'Yes, more than people expect. Shrouds keep fingers away from moving stacks and cables and they make the machine look complete. They are also frequently unobtainable for older models, so check that every cover is present and undamaged before agreeing a price.',
      }),
      Object.freeze({
        question: 'Who should dismantle and reassemble a cable machine?',
        answer:
          'Ideally someone who has done it before, because cables must be released and rerouted correctly and incorrect routing causes rubbing and premature failure. Fulfilment is agreed between buyer and seller on Equipd, so settle who dismantles, who rebuilds and that every bolt and shroud fixing is bagged.',
      }),
      Object.freeze({
        question: 'What should I run through before accepting delivery?',
        answer:
          'Reassemble, check cable routing before loading, then work every station through its full range at several stack weights while listening for noise and watching the plates travel. Confirm handover only once you are satisfied, as confirmation starts the Buyer Protection window on eligible purchases.',
      }),
    ]),
    midCtaHeading: 'Find commercial cable machines',
    midCtaLead:
      'Browse used pulldowns, rows, crossovers and dual pulley stations listed by UK gyms, dealers and refurbishers.',
    midCtaLabel: 'Browse Cable Machines',
    exploreLead:
      'Continue through the commercial strength range, the brands behind most UK gym floors, and the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Facility-grade stations',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-leg-press-machines': Object.freeze({
    eyebrow: 'Heavy loading, no spotter needed',
    h1: 'Used Leg Press Machines',
    lead: 'Compare used commercial leg press machines — 45 degree, horizontal and hack squat combinations — from UK gyms, dealers and refurbishers on Equipd. Secure payments, Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Leg Press Machines for Sale UK | Equipd',
    metaDescription:
      'Buy used commercial leg press machines from UK gyms and dealers. Check rails and safety catches, then pay securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial leg press machines',
    searchLabel: 'Search leg press machines',
    listingsHeading: 'Live leg press listings',
    listingsLead:
      'Plate-loaded 45 degree presses, horizontal and seated presses, selectorised units and hack squat combinations listed on Equipd by UK sellers.',
    listingsCta: 'Browse all leg press machines',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'A leg press anchors a lower-body area. Add racks, plate-loaded machines, benches and free weights to give members a full range of options around it.',
    brandLead:
      'Hammer Strength, Cybex, Life Fitness, Technogym, Panatta, Watson and Gym80 all build commercial leg presses with very different sled geometry, footplate angles and starting weights. The feel varies far more than on most equipment.',
    benefitsHeading: 'Why buy used leg press machines on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'huge-new-price-gap',
        title: 'The largest saving in strength kit',
        body: 'Leg presses are expensive new because they are enormous quantities of steel. Buying used typically saves the most in absolute terms of any strength machine, often enough to cover transport and refurbishment several times over.',
      }),
      Object.freeze({
        id: 'member-favourite',
        title: 'A station members always use',
        body: 'The leg press lets members load their legs heavily without a spotter or squat technique, so it stays busy in every kind of facility from budget clubs to rehab-focused studios.',
      }),
      Object.freeze({
        id: 'simple-mechanics',
        title: 'Mechanically simple and repairable',
        body: 'A sled, two rails, bearings or rollers and a set of safety catches. There is very little to fail and everything that does is replaceable, so a sound used machine has decades of service left.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Protected payment on a big collection',
        body: 'Leg presses almost always need collection and specialist handling. Paying through Equipd means funds are held until handover is confirmed, with Buyer Protection on eligible purchases rather than money sent in advance.',
      }),
    ]),
    valuationEyebrow: 'Selling heavy strength kit?',
    valuationHeading: 'Value a leg press before you move it',
    valuationCopy:
      'Leg press values depend on brand, whether the machine is plate loaded or selectorised, sled and rail condition and how much plate storage comes with it. Because these machines are expensive to transport, it is worth checking the free Equipd valuation on the specific model first so you know the value before you commit to moving several hundred kilograms.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the leg press model' }),
      Object.freeze({ label: 'Details', body: 'Add type, year and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK market range' }),
      Object.freeze({ label: 'Decide', body: 'Buy, list or reconsider', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used leg press buying guide',
    guideIntro:
      'A leg press is a large amount of steel arranged to let a member load their legs heavily and safely, and on the used market it is one of the most compelling purchases in commercial strength equipment. New prices are high because of the material and shipping involved, while used machines from closing gyms are frequently in excellent mechanical condition — the sled bearings and the safety catches are the only meaningful wear items. The complications are practical rather than technical: a 45 degree press can be nearly two and a half metres long, weigh 300kg before you add a single plate, and be genuinely difficult to get through a doorway. This guide covers choosing between press types, sled and rail inspection, safety catches, dimensions and access, maintenance, brand geometry differences, lifespan and refurbishment, and how to buy and move one without regret.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'press-types',
        heading: 'Choosing between 45 degree, horizontal and selectorised presses',
        paragraphs: Object.freeze([
          'The 45 degree plate-loaded press is the classic commercial machine. The sled runs on angled rails, the user sits below it, and plates load onto horns on the sled. It allows very heavy loading, feels substantial and is what most members picture when they think of a leg press. It is also the longest and heaviest option and needs the most floor space.',
          'Horizontal and seated presses put the user upright with the resistance moving horizontally, either plate loaded or on a weight stack. They take up considerably less length, are much easier to get into and out of, and suit older members, rehab work and any facility where accessibility matters more than maximum load.',
          'Selectorised leg presses use a weight stack and a pin, which makes changing weight instant and keeps loose plates off the floor. They are ideal for circuits, busy general floors and sites that would rather not have members carrying 20kg plates around. The maximum load is lower than a plate-loaded machine, which is a genuine limitation for stronger members.',
          'Hack squat and leg press combination machines give two movements in one footprint, which is efficient in a small area, though the compromise usually shows in one of the two positions. If space is tight, they are worth considering; if you have the room, dedicated machines feel better. Also check the footplate size and angle, since a small or badly angled footplate limits foot positions and irritates taller users.',
        ]),
      }),
      Object.freeze({
        id: 'sled-and-rails',
        heading: 'Sled travel, rails and bearings',
        paragraphs: Object.freeze([
          'The sled and its rails are the heart of the machine. Push the sled through its full travel with no plates on and feel for smoothness — it should glide with a consistent feel and no notchiness or grabbing. Then do it again with a moderate load if the seller allows, because faults often only appear under weight.',
          'Inspect the rails along their full length for scoring, pitting, rust and dents. Rails are usually hardened steel or chromed and generally survive well, but a machine stored outside or in a damp unit can have surface corrosion that makes the sled feel rough. Deep scoring or a dented rail is a much bigger problem than surface rust.',
          'Check the bearings, rollers or bushings depending on the design. Linear bearings and rollers are the smoothest and can be replaced, but a failed bearing that has been left in service will have damaged the rail as well. Listen carefully as the sled moves and feel for a repeating rough spot, which indicates a flat-spotted roller or a damaged bearing.',
          'Look for lateral play in the sled. Grasp it and try to move it side to side across the rails; a small amount of designed clearance is normal, but noticeable rocking indicates worn bearings or a bent rail. Also confirm the sled returns to the same start position consistently and that the frame is not twisted from a rough previous move.',
        ]),
      }),
      Object.freeze({
        id: 'safety-catches',
        heading: 'Safety catches, stops and loading',
        paragraphs: Object.freeze([
          'The safety catches are the most important components on a leg press and the most likely to have been abused. Test every position: the catches should engage positively, hold the sled securely, and release cleanly without needing force or a particular knack. A machine where the catches only work at some positions is not fit to use.',
          'Look closely for deformation. Catch hooks, pins and the stops they rest on take shock loading every time a member finishes a heavy set carelessly, and bent or peened metal is common on older machines. Repair or replacement is usually possible but must happen before the machine goes on a floor.',
          'Check the plate horns and how the machine loads. Horns should be straight rather than drooping, long enough for a realistic number of plates, and ideally have some means of retaining plates. Bent horns indicate very heavy use or a hard knock, and they make loading awkward and untidy.',
          'Consider the starting weight and how the machine loads for lighter users. Some plate-loaded 45 degree presses have a substantial sled weight before any plates are added, which is fine for strong members and unhelpful for beginners or rehab clients. Establish the empty sled weight rather than assuming, particularly if the machine will serve a broad membership.',
        ]),
      }),
      Object.freeze({
        id: 'dimensions-and-access',
        heading: 'Dimensions, floor loading and getting it in',
        paragraphs: Object.freeze([
          'A 45 degree leg press is the largest single strength machine on many floors. Expect something around 2.2 to 2.4m long and 1.2m wide, and the sled travel means you cannot use the theoretical footprint — you need clear space around it for members to get in and out and to load plates on both sides.',
          'Machine weight commonly runs from 250kg to 400kg empty, and then you add plates. Concentrated on a modest footprint, that raises real questions about upper floors and mezzanines, and it makes matting essential to protect the substrate and reduce noise from plates being loaded and racked.',
          'Access is the deciding factor in many purchases. These machines are long and the frames often do not dismantle far, so measure doorway widths and heights, corridor turns, staircase angles and lift dimensions and weight limits before you buy. Ask specifically what comes off — backrests, seats, footplates and sometimes rail sections — and whether the fixings and manual exist.',
          'Plan where plates will live. A leg press without adjacent plate storage means plates end up on the floor, which is untidy and a trip hazard. Many commercial machines include integrated storage; if yours does not, budget for a plate tree next to it as part of the installation.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and consumables',
        paragraphs: Object.freeze([
          'Leg press maintenance is straightforward and mostly consists of keeping the rails clean and correctly lubricated to the manufacturer specification. Chalk, dust and grit on the rails accelerate bearing wear more than anything else, so wiping them down is genuine mechanical care rather than presentation.',
          'Check the safety catches and stops as a routine item, not just when something looks wrong. They take impact loads and will gradually deform, and this is one of the few places on a strength floor where a failure has serious consequences. Add them to a monthly walk-round.',
          'Inspect the upholstery on the back pad and seat regularly. These pads carry high compressive loads and split earlier than pads on most other machines, and a split back pad on a leg press is both uncomfortable and unhygienic. Reupholstery is inexpensive relative to the machine value.',
          'Tighten fixings periodically. The combination of heavy loads and repeated impact gradually loosens bolts on any large frame, and a leg press that has developed movement will feel unsettling to members and will wear unevenly. A quarterly torque check is enough.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-geometry',
        heading: 'Brand differences and why geometry matters',
        paragraphs: Object.freeze([
          'Leg presses vary more between manufacturers in how they feel than almost any other machine, because sled angle, seat position, footplate size and back pad geometry all interact. Two machines with the same nominal function can suit quite different members, so where possible try the machine rather than buying on the badge.',
          'Hammer Strength and Cybex leg presses are widely used in UK commercial gyms with well-judged geometry and good availability used. Life Fitness and Technogym offer strong selectorised and plate-loaded options with excellent finish, generally at the higher end of used pricing.',
          'European and specialist manufacturers including Panatta, Gym80 and the UK\'s Watson build very heavily engineered presses that are popular with strength-focused gyms and hold their value well. Parts come from a narrower supply chain, which is worth checking if you expect to need bearings quickly.',
          'Practically, the questions to answer for any brand are whether bearings or rollers, safety catch components and upholstery are available for that model, and whether the geometry suits your members. Frames are effectively permanent, so parts availability and fit are what determine whether the machine is a good long-term asset.',
        ]),
      }),
      Object.freeze({
        id: 'refurb-transport-inspection',
        heading: 'Refurbished or as-seen, transport and inspection',
        paragraphs: Object.freeze([
          'Refurbishment on a leg press typically means new bearings or rollers, cleaned and dressed rails, repaired or replaced safety catches, new upholstery and often a repaint. Because the frame is permanent, a properly refurbished press is effectively a new machine and is often the sensible buy for a customer-facing floor.',
          'As-seen machines are the value option and usually a good one, since the faults tend to be cosmetic. The purchases to avoid are those with dented or deeply scored rails, a twisted frame from a bad move, or safety catches that have been bent and bodged, because those undermine the parts of the machine you cannot economically replace.',
          'Inspect in person on this category, without exception. The machine is too heavy and too expensive to move for a photograph-based decision. Load it, press it through the full range, test the catches at every position, check for lateral play and listen throughout. Photograph the rails, the catches, the horns and the serial plate.',
          'Treat transport as the main project. Fulfilment on Equipd is agreed directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and a 300kg machine needs proper equipment, a suitable vehicle and enough people. Specialist gym equipment movers are strongly advisable, and you should agree in advance who dismantles, who reassembles and where the fixings will be.',
          'Prepare the destination before delivery: matting down, space cleared, plate storage planned and enough hands available. Reassemble, load the machine and test the sled and catches before confirming handover, since confirmation is what starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Choosing between press types, checking rails and safety catches, and handling the weight and access challenges of a used leg press.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Which type of leg press suits a general gym floor?',
        answer:
          'A 45 degree plate-loaded press allows the heaviest loading and is what most members expect, but it takes the most space. Selectorised presses are faster to adjust and keep loose plates off the floor, which suits busy circuits. Horizontal and seated presses are the most accessible option for older members and rehab work.',
      }),
      Object.freeze({
        question: 'How do I check the sled and rails on a used leg press?',
        answer:
          'Push the sled through its full travel unloaded and feel for notchiness or grabbing, then repeat with a moderate load if permitted. Inspect the rails for scoring, pitting and dents, and check for lateral rocking of the sled. Surface rust is cosmetic; deep scoring, dents or a bent rail are serious problems.',
      }),
      Object.freeze({
        question: 'What should I look for on the safety catches?',
        answer:
          'Test every position and confirm the catches engage positively, hold the sled securely and release without force or a knack. Look closely for bent, peened or bodged metal, since these components take shock loading whenever a member finishes a heavy set carelessly. Damaged catches must be repaired before the machine is used.',
      }),
      Object.freeze({
        question: 'How heavy is a commercial leg press?',
        answer:
          'Typically 250kg to 400kg empty before any plates are loaded, concentrated on a fairly small footprint. That raises genuine questions about upper floors and mezzanines, requires matting to protect the substrate, and means specialist movers with the right equipment are strongly advisable for collection and installation.',
      }),
      Object.freeze({
        question: 'How much space does a 45 degree leg press need?',
        answer:
          'Around 2.2 to 2.4m in length and about 1.2m wide, plus clear space for the user to get in and out and for loading plates on both sides. Also plan adjacent plate storage, because without it plates end up on the floor around the machine, which is untidy and a trip hazard.',
      }),
      Object.freeze({
        question: 'What is the starting weight of the sled?',
        answer:
          'It varies significantly between models, and some plate-loaded 45 degree presses have a substantial empty sled weight. That is fine for strong members but unhelpful for beginners and rehab clients, so establish the figure for the specific model, particularly if the machine will serve a broad membership.',
      }),
      Object.freeze({
        question: 'Will a leg press fit through a standard doorway?',
        answer:
          'Often only partly dismantled, and some do not come apart far. Measure doorway widths and heights, corridor turns, stair angles and lift dimensions and weight limits before buying, and ask the seller exactly which components come off — backrests, seats, footplates and sometimes rail sections — and whether the fixings and manual exist.',
      }),
      Object.freeze({
        question: 'Why do leg presses feel so different between brands?',
        answer:
          'Because sled angle, seat position, footplate size and back pad geometry all interact, and manufacturers make different choices. Two machines with identical nominal function can suit quite different members, so try the machine yourself where possible rather than buying on brand reputation alone.',
      }),
      Object.freeze({
        question: 'What maintenance does a leg press need?',
        answer:
          'Keep the rails clean and lubricated to the manufacturer specification, since chalk and grit accelerate bearing wear more than anything else. Check safety catches and stops monthly for deformation, inspect the back pad for splitting, and torque-check fixings quarterly as heavy loading gradually loosens them.',
      }),
      Object.freeze({
        question: 'Is a refurbished leg press worth the extra?',
        answer:
          'Frequently yes, because the frame is permanent and refurbishment means new bearings, dressed rails, sound catches, new upholstery and often a repaint — effectively a new machine. As-seen presses are still good value provided the rails are undamaged, the frame is true and the catches have not been bent and bodged.',
      }),
    ]),
    midCtaHeading: 'Looking for a leg press?',
    midCtaLead:
      'Compare used 45 degree, horizontal, selectorised and hack squat combination presses listed by UK gyms, dealers and refurbishers.',
    midCtaLabel: 'Browse Leg Press Machines',
    exploreLead:
      'Explore the rest of the commercial strength range, the brands behind most UK strength floors, and the Equipd guides to buying and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Heavy plate-loaded steel',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-plate-loaded-machines': Object.freeze({
    eyebrow: 'Free-weight feel, machine safety',
    h1: 'Used Plate-Loaded Machines',
    lead: 'Browse used commercial plate-loaded machines from gyms, dealers and refurbishers across the UK. Equipd provides the marketplace and the secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation on every model.',
    metaTitle: 'Used Plate-Loaded Gym Machines for Sale | Equipd',
    metaDescription:
      'Used commercial plate-loaded machines from UK gyms and dealers. Check bushings, pivots and plate horns, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial plate-loaded strength machines',
    searchLabel: 'Search plate-loaded machines',
    listingsHeading: 'Live plate-loaded machine listings',
    listingsLead:
      'Iso-lateral chest presses, rows, shoulder presses, leg machines and other plate-loaded stations listed on Equipd by UK gyms, dealers and refurbishers.',
    listingsCta: 'Browse all plate-loaded machines',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'Plate-loaded stations work best alongside racks, benches, dumbbells and a few selectorised machines for members who prefer not to handle plates.',
    brandLead:
      'Hammer Strength defined the plate-loaded category and remains the most sought-after brand used, with Panatta, Gym80, Watson, Cybex and Technogym all building excellent alternatives with different arcs and pivot designs.',
    benefitsHeading: 'Why buy used plate-loaded machines on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'no-cables-no-electronics',
        title: 'Nothing complicated to go wrong',
        body: 'No cables, no weight stack and no electronics — a plate-loaded machine is a frame, pivots and bushings. That makes it the lowest-risk category in used commercial strength equipment.',
      }),
      Object.freeze({
        id: 'strong-demand',
        title: 'Kit serious lifters seek out',
        body: 'Plate-loaded stations are a genuine draw for strength-focused members, and specific models have devoted followings. Buying used is often the only way to get particular sought-after machines at all.',
      }),
      Object.freeze({
        id: 'buy-station-by-station',
        title: 'Build a floor station by station',
        body: 'Because each machine is independent, you can add stations gradually as budget allows rather than committing to a full circuit, and Equipd lets you compare individual pieces from sellers across the UK.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment on heavy collections',
        body: 'These machines are heavy and usually collected. Paying through Equipd holds funds until handover is confirmed and gives Buyer Protection on eligible purchases, rather than sending money for equipment you have not seen.',
      }),
    ]),
    valuationEyebrow: 'Selling a strength circuit?',
    valuationHeading: 'Value plate-loaded machines individually',
    valuationCopy:
      'Plate-loaded machines vary enormously in value between brands and models, and a sought-after iso-lateral station can be worth several times a generic equivalent of the same age. Use the free Equipd valuation on each specific model rather than pricing a circuit as a job lot, so you understand which pieces are carrying the value.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find each machine model' }),
      Object.freeze({ label: 'Details', body: 'Add year, condition and pads' }),
      Object.freeze({ label: 'Estimate', body: 'See per-station market ranges' }),
      Object.freeze({ label: 'Decide', body: 'Price the circuit or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used plate-loaded machine buying guide',
    guideIntro:
      'Plate-loaded machines are the simplest and safest category in used commercial strength equipment. There is no cable to fray, no stack to bind and no electronics to become obsolete — just a welded frame, a set of pivots and some upholstery. That simplicity is why twenty-year-old machines from closed gyms still command real money, and why particular models have a following that keeps them in demand long after the manufacturer stopped making them. What you do need to understand is how the pivots wear, why an arc that has developed play feels wrong under load, and what an honest set of plate horns and pads should look like. This guide covers movement patterns and specification, pivots and bushings, footprint and loading, maintenance, brand differences, lifespan and refinishing, and how to inspect and transport machines that are heavier than they look.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'movement-patterns',
        heading: 'Movement patterns, arcs and independent arms',
        paragraphs: Object.freeze([
          'The defining characteristic of a plate-loaded machine is its movement arc, and this is where designs genuinely differ. Converging arcs bring the handles together as you press, diverging arcs move them apart as you pull, and both are intended to follow natural joint mechanics more closely than a straight-line path. How well that works for your members depends on the specific machine.',
          'Independent arms are a major consideration. Machines with iso-lateral arms let each side work separately, which allows unilateral training, exposes strength imbalances and feels closer to free weights. Fixed-linkage machines connect both sides, which is simpler and often smoother but removes the unilateral option. Both are legitimate; know which you are buying.',
          'Check the starting position and range for the members you serve. Many plate-loaded machines have adjustable seats and sometimes adjustable start positions, and the quality of that adjustment determines whether the machine works for a 1.6m and a 1.9m member or just for the middle. Sit in the machine and take it through the movement before you buy.',
          'Think about which stations actually earn their space. Chest press, row, shoulder press and pulldown-style machines are used constantly; more specialised stations can sit idle in a general-membership gym while being essential in a strength-focused one. Buy the movements your members will use rather than assembling a complete catalogue.',
        ]),
      }),
      Object.freeze({
        id: 'pivots-and-bushings',
        heading: 'Pivots, bushings and bearings',
        paragraphs: Object.freeze([
          'The pivots are the only real wear points on these machines. Take hold of each movement arm and try to move it laterally and vertically — a well-maintained pivot has almost no play, while a worn one has an obvious wobble that becomes a knock under load. Play at every pivot on a machine means a rebuild rather than a single part.',
          'Establish whether the machine uses bushings or sealed bearings. Bushings are cheaper, serviceable and gradually develop play; sealed bearings run smoother for longer and are usually found on better machines. Either can be replaced on most designs, but availability for the specific model is the question that matters.',
          'Work the movement through its full range under load if the seller allows. Listen for knocking, feel for a rough patch or a point where the arm binds, and watch whether both sides of an iso-lateral machine feel the same. A machine where one arm is noticeably rougher than the other has a worn pivot on that side.',
          'Check the frame and welds while you are there, particularly around the pivot mounts and the base. These machines take repeated impact from plates being loaded and dropped, and cracks around a pivot mount are the one structural failure worth walking away from. Look for repairs and for a frame that has been forced back into shape.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-loading',
        heading: 'Footprint, plate storage and floor loading',
        paragraphs: Object.freeze([
          'Individual plate-loaded stations vary widely, from compact machines around 1.2m by 1.2m to large presses over 2m long. Beyond the footprint you need loading access on both sides, because a member cannot load plates onto a horn pressed against a wall, and you need space in front or behind for entry and exit.',
          'Plate storage is not optional. Every plate-loaded station generates loose plates, and without storage on or beside the machine they end up on the floor. Many commercial machines include integrated horns for spare plates; if yours does not, plan a plate tree per one or two stations as part of the installation cost.',
          'Machine weights commonly run from 100kg to over 300kg empty, and then you add plates and a member. Concentrated loads on upper floors deserve checking, and heavy rubber matting under each station is the standard answer for protecting the substrate and reducing the noise of plates being loaded and dropped.',
          'Plan the circuit layout for traffic as well as fit. Plate-loaded areas work best when members can move between stations without stepping over plates, and when the heaviest-used machines are not the ones jammed into the least accessible corner. Sight lines for staff supervision matter too on a floor where people train heavy.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and consumables',
        paragraphs: Object.freeze([
          'Maintenance is minimal but should be scheduled. Check pivots for developing play, lubricate to the manufacturer specification where the design requires it, torque-check the fixings, and inspect welds around pivot mounts and the base. A quarterly walk-round covers most of it.',
          'Treat upholstery as the main consumable. Back pads, seats and chest pads on plate-loaded machines take heavy compressive loads and split earlier than pads elsewhere in the gym. Reupholstering is inexpensive relative to the machine and transforms how a used circuit looks, so plan it rather than waiting until pads are unusable.',
          'Watch the handles and grips. Worn or split grips are cheap to replace and are what members notice most, and a machine with bare metal handles feels neglected regardless of how good the mechanics are.',
          'Keep an eye on plate horns and any weight retainers. Bent horns from heavy loading make plates awkward to fit and can let them work loose, and retainers go missing constantly. Both are cheap fixes that keep the area tidy and safe.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brands, sought-after models and parts',
        paragraphs: Object.freeze([
          'Hammer Strength effectively created the modern plate-loaded category and its iso-lateral machines remain the most in-demand used plate-loaded equipment in the UK. Specific models command strong prices years after production ended, which is worth knowing whether you are buying or selling.',
          'Panatta, Gym80 and Watson build very heavily engineered plate-loaded machines with distinctive geometry and are popular with strength-focused gyms. They hold value well and have devoted followings, though parts come through smaller supply chains than the volume brands.',
          'Cybex and Technogym plate-loaded ranges are well designed with excellent finish, and are common enough in UK facilities to be straightforward to buy and service. Older machines from less well-known manufacturers can be mechanically sound and excellent value, but resale is weaker and pivot parts may be difficult to source.',
          'The practical question for any brand is whether bushings or bearings, pivot hardware and upholstery can be obtained for that model. Because the frame is permanent, parts availability is what decides whether a machine is a long-term asset or a project, and a five-minute check before buying answers it.',
        ]),
      }),
      Object.freeze({
        id: 'lifespan-and-refinishing',
        heading: 'Lifespan, refurbishment and refinishing',
        paragraphs: Object.freeze([
          'The working life of a plate-loaded machine is effectively indefinite. Frames do not wear out, and the pivots and pads that do are replaceable. This is why the used market for this equipment is driven almost entirely by gyms closing, rebranding or changing direction rather than by machines failing.',
          'Refurbishment usually means replaced bushings or bearings, new upholstery, new grips, straightened or replaced plate horns and a repaint or powder coat. Because most of that is labour, a refurbished plate-loaded machine can look and feel new, and a fully refurbished circuit is a very different proposition from a scruffy one.',
          'Refinishing is worth planning if you are buying for a customer-facing floor. Stripping and powder coating a sound machine, with new pads and grips, costs a fraction of the difference between tired and pristine examples, and it is how many operators assemble a coherent-looking circuit from mixed used stock.',
          'As-seen circuits are where the value is if you are prepared to do the cosmetic work. Buy on pivot condition and frame integrity, ignore paint and pads in your assessment, and use the free valuation on each model to make sure you are pricing the good machines correctly rather than averaging across the lot.',
        ]),
      }),
      Object.freeze({
        id: 'transport-and-inspection',
        heading: 'Inspecting and transporting plate-loaded machines',
        paragraphs: Object.freeze([
          'Inspect and use every machine. Sit in it, load a plate or two, and take the movement through its full range on both sides. Play, binding and noise all appear under load and disappear when a machine is pushed by hand, which is why photograph-based purchases in this category so often disappoint.',
          'Work through a per-machine checklist: pivot play on each arm, smoothness and symmetry under load, weld condition especially around pivot mounts and the base, plate horn straightness, upholstery and grips, adjustment mechanisms, any missing pins or retainers, and the model and serial plate. Photograph each station individually if you are buying several.',
          'Plan transport around weight and awkwardness. Fulfilment is arranged directly between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier — and while many plate-loaded machines partly dismantle, they remain heavy and unwieldy. Specialist movers are sensible for anything above the lighter stations, particularly on stairs.',
          'Confirm the fixings, pins and retainers travel with each machine and that seats and pads are labelled to the right station if several are moving together. Reassemble on site, load and test each machine, and only confirm handover once you are satisfied, since confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Movement arcs, pivot wear, plate storage and transport — the practical questions when buying used plate-loaded equipment.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What is an iso-lateral plate-loaded machine?',
        answer:
          'One where each arm works independently, allowing unilateral training and exposing strength imbalances, with a feel closer to free weights. Fixed-linkage machines connect both sides, which is simpler and often smoother but removes the unilateral option. Both designs are legitimate, so choose based on how your members train.',
      }),
      Object.freeze({
        question: 'How do I check for pivot wear on a used machine?',
        answer:
          'Take hold of each movement arm and try to move it laterally and vertically. A sound pivot has almost no play; a worn one wobbles and will knock under load. Then load the machine and work both sides, since one arm feeling rougher than the other points to a worn pivot on that side.',
      }),
      Object.freeze({
        question: 'Do plate-loaded machines use bushings or bearings?',
        answer:
          'Both, depending on the model. Bushings are cheaper and serviceable but gradually develop play, while sealed bearings stay smooth for longer and are typically found on better machines. Either can usually be replaced, so the question that matters is whether parts are available for that specific model.',
      }),
      Object.freeze({
        question: 'Why are some Hammer Strength machines so expensive used?',
        answer:
          'Because specific iso-lateral models have a strong following among serious lifters and are no longer made, so demand outstrips the supply coming out of closing gyms. That works both ways: it means paying more as a buyer, and it means a sought-after station is worth valuing individually rather than as part of a job lot.',
      }),
      Object.freeze({
        question: 'How much space does a plate-loaded station need?',
        answer:
          'It varies from about 1.2m by 1.2m for compact machines to over 2m in length for large presses. Beyond the footprint you need loading access on both sides and entry space for the user, so a machine pressed against a wall cannot be loaded properly no matter how well it fits the plan.',
      }),
      Object.freeze({
        question: 'Do I need plate storage next to each machine?',
        answer:
          'Effectively yes. Every plate-loaded station generates loose plates, and without storage they end up on the floor as a trip hazard. Many commercial machines have integrated horns for spare plates; where they do not, budget a plate tree per one or two stations as part of the installation.',
      }),
      Object.freeze({
        question: 'Are cracked welds ever acceptable?',
        answer:
          'No, particularly around pivot mounts and the base. These machines take repeated impact from plates being loaded and dropped, and a crack at a pivot mount is the one structural fault that should end your interest. With plenty of sound machines available used, there is no reason to take on a repaired frame.',
      }),
      Object.freeze({
        question: 'Is it worth refinishing used plate-loaded machines?',
        answer:
          'Often, yes. Powder coating a mechanically sound frame with new pads and grips costs far less than the price gap between tired and pristine examples, and it is how many operators build a coherent-looking circuit from mixed used stock. Buy on pivot condition and frame integrity, then refinish.',
      }),
      Object.freeze({
        question: 'How heavy are plate-loaded machines to move?',
        answer:
          'Commonly 100kg to over 300kg empty depending on the station. Many partly dismantle, but they remain heavy and awkward, so specialist movers are sensible for anything beyond the lightest machines, especially on stairs. Make sure pins, retainers and pads travel with the right station.',
      }),
      Object.freeze({
        question: 'Should I buy a whole circuit or individual machines?',
        answer:
          'Buying a circuit from a single seller is efficient and often cheaper per station, but value each machine individually with the free valuation rather than accepting an averaged price, since sought-after models carry most of the value. Buying station by station lets you build the floor gradually around what members actually use.',
      }),
    ]),
    midCtaHeading: 'Building a plate-loaded area?',
    midCtaLead:
      'Browse used plate-loaded presses, rows and leg machines listed by UK gyms, dealers and refurbishers — individual stations and full circuits.',
    midCtaLabel: 'Browse Plate-Loaded Machines',
    exploreLead:
      'Continue through the commercial strength range, the brands serious lifters look for, and the Equipd guides to buying, selling and valuing kit.',
    heroTrustItems: Object.freeze([
      'Iso-lateral and fixed-arm stations',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-pin-loaded-machines': Object.freeze({
    eyebrow: 'Select a weight, start training',
    h1: 'Used Pin-Loaded Machines',
    lead: 'Find used commercial pin-loaded and selectorised machines from gyms, dealers and refurbishers across the UK on Equipd. Pay securely by card, get Buyer Protection on eligible purchases and value any model free before you make an offer.',
    metaTitle: 'Used Pin-Loaded Gym Machines for Sale | Equipd',
    metaDescription:
      'Used commercial pin-loaded and selectorised machines from UK gyms and dealers. Check stacks and cables, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used commercial pin-loaded selectorised machines',
    searchLabel: 'Search pin-loaded machines',
    listingsHeading: 'Live pin-loaded machine listings',
    listingsLead:
      'Selectorised chest presses, pulldowns, leg extensions, curls and full circuits listed on Equipd by UK gyms, leisure operators, dealers and refurbishers.',
    listingsCta: 'Browse all pin-loaded machines',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'Selectorised circuits suit general membership, but most floors also want free weights, racks and a few plate-loaded stations for stronger members.',
    brandLead:
      'Life Fitness, Technogym, Matrix, Cybex, Precor and Gym80 all build selectorised ranges. Because circuits are usually bought as a set, matching brand and generation across stations makes a floor look deliberate and simplifies spares.',
    benefitsHeading: 'Why buy used pin-loaded machines on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'complete-circuits',
        title: 'Complete circuits from single floors',
        body: 'Operators replace selectorised equipment as a range, so Equipd regularly carries eight, ten or twelve matching stations from one gym. Buying a whole circuit at once is far cheaper and more coherent than assembling one piece at a time.',
      }),
      Object.freeze({
        id: 'accessible-for-members',
        title: 'The easiest equipment for new members',
        body: 'Guided movement paths, clear instructions and a pin instead of loose plates make selectorised machines the natural starting point for new and returning members, which is why they anchor most general-membership floors.',
      }),
      Object.freeze({
        id: 'value-against-new',
        title: 'Circuit-wide savings against new',
        body: 'A new selectorised circuit is one of the largest capital costs in fitting out a gym. Used circuits bring a full range within reach, leaving budget for the flooring, mirrors and refurbishment that members actually notice.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment on a large order',
        body: 'Paying for a twelve-station circuit by transfer is a significant risk. Pay through Equipd instead, with funds held until handover is confirmed and Buyer Protection on eligible purchases.',
      }),
    ]),
    valuationEyebrow: 'Replacing a circuit?',
    valuationHeading: 'Value selectorised machines station by station',
    valuationCopy:
      'Circuits are usually priced as a job lot, which means individual stations are often mispriced in both directions. Use the free Equipd valuation on each model to see UK market ranges by year and condition, then build up a realistic figure for the whole circuit instead of guessing from a single headline number.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find each selectorised model' }),
      Object.freeze({ label: 'Details', body: 'Add year, stack weight and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a range for every station' }),
      Object.freeze({ label: 'Decide', body: 'Price the circuit properly', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used pin-loaded machine buying guide',
    guideIntro:
      'Selectorised machines are the backbone of general-membership gyms, and buying a used circuit is how a great many UK facilities have opened or refitted within budget. They are more complex than plate-loaded equipment because each station combines a weight stack, guide rods, cables or belts, pulleys, shrouds and adjustment mechanisms, and every one of those can be tired on a machine that has done ten years of continuous member use. They are also more forgiving than they look, because everything that wears is a stock part and the frames are permanent. The key to buying well is inspecting stations individually rather than trusting a circuit as a whole, and understanding that upholstery and shroud condition drive both member perception and price. This guide covers circuit planning, stacks and cables, faults and adjustment, space, maintenance, brands, refurbishment and logistics.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'circuit-planning',
        heading: 'Planning a circuit and choosing stations',
        paragraphs: Object.freeze([
          'Start from the movements your members need rather than the number of machines you can fit. A workable general circuit covers a horizontal press, a vertical press, a pulldown or vertical pull, a row, leg extension, leg curl, leg press or squat-pattern machine, and an abdominal or back extension station. Everything beyond that is refinement.',
          'Decide whether you want a matched range or mixed stations. A single-brand, single-generation circuit looks deliberate, uses consistent adjustment mechanisms members learn once, and means one spares stock. Mixed used stations cost less and can be perfectly good, but the floor will look assembled rather than designed unless you refinish to match.',
          'Consider adjustability against throughput. Machines with range-of-motion adjustment and easy seat height changes suit a diverse membership and rehab work, but every adjustment is something to explain and something that can seize. On very busy circuit floors, simpler machines with fewer settings keep members moving.',
          'Check stack weights and increments against your membership. Increments of 5kg are common but coarse for upper-body work with beginners and older members, and machines with finer steps or an add-on top weight are considerably more useful. Also confirm the maximum weight is enough for your stronger members on leg stations, where stacks are most often the limitation.',
        ]),
      }),
      Object.freeze({
        id: 'stacks-cables-belts',
        heading: 'Weight stacks, cables and belts',
        paragraphs: Object.freeze([
          'Watch the stack travel on every station. Select a mid-range weight and work the machine, watching the plates rise and fall — they should move smoothly, quietly and squarely. Notchy or noisy travel usually means dirty or dry guide rods, worn plate liners or chalk contamination, all of which are serviceable. Plates that visibly rock or tilt as they travel indicate worn liners or bent rods.',
          'Inspect the cables and any belts throughout their accessible length, paying particular attention to the swaged ends where failures start. Split coating, broken strands, kinks or rust mean replacement. On machines using a belt rather than a cable, look for cracking, fraying at the edges and stretch.',
          'Check the pulleys as carefully as the cables. A worn groove or a dry bearing will destroy a new cable, so both must be addressed together. Follow the cable route where shrouds allow to make sure it runs cleanly and does not rub on the frame — misrouting after a previous move is very common on relocated circuits.',
          'Test the selector pin and stack holes on every machine. A worn pin, or plate holes deformed by years of a bent pin being forced in, produces the everyday annoyance of a member unable to change weight easily. Pins are cheap and model-specific, so confirm availability and count that every station has one.',
        ]),
      }),
      Object.freeze({
        id: 'faults-and-adjustment',
        heading: 'Adjustment mechanisms, shrouds and upholstery',
        paragraphs: Object.freeze([
          'Work every adjustment on every station. Seat heights, back pads, thigh pads, range-of-motion levers and foot plates all use pop-pins, cams or gas struts, and seized or missing mechanisms are among the most common faults on ex-facility circuits. A station whose seat cannot be adjusted serves a much narrower range of members.',
          'Check that all shrouds and covers are present and undamaged. Shrouds keep hands and clothing away from moving stacks, and they are frequently broken or lost during previous moves. They are also often unobtainable for older models, which makes a missing shroud a bigger problem than it first appears.',
          'Assess upholstery honestly. Every pad on a used circuit will show wear, and split vinyl, compressed foam and faded colours are normal after years of member use. Reupholstering a whole circuit is a known cost with a huge visual return, so get a quote and treat it as part of the purchase price rather than an afterthought.',
          'Then look at the details that give away how a circuit was maintained: instruction placards still in place and legible, grips intact, weight stack numbers readable, no corrosion behind shrouds and under seats, and no ad-hoc repairs with cable ties or mismatched bolts. A well-kept circuit shows it in these small things.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-layout',
        heading: 'Footprint, layout and installation',
        paragraphs: Object.freeze([
          'Individual selectorised stations typically occupy somewhere between 1.2 and 1.6 square metres of frame footprint, but the usable requirement is roughly double once you add entry space and clearance for the moving parts. A twelve-station circuit realistically wants a well-planned area rather than a corner.',
          'Lay a circuit out for flow. If members are expected to move from station to station, arrange them in a logical order with enough space to pass, and keep the stations that take longest away from pinch points. Circuits crammed to maximise station count feel unpleasant and get used less than a smaller, better-spaced set.',
          'Consider height as well as area. Pulldown and vertical press stations are tall, often over 2m, and the cable needs clearance above the top pulley. Check the ceiling in the intended position and remember these machines are also awkward to tilt for transport because of that height.',
          'Confirm whether stations need bolting down. Most are stable freestanding with a loaded stack, but taller machines and some designs specify fixing. Lay flooring before installation, and plan the position of each machine before delivery day rather than shuffling several hundred kilograms around afterwards.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintaining a used circuit',
        paragraphs: Object.freeze([
          'Set a monthly routine covering every station: inspect cables and belts along their accessible length and at the swages, check pulleys, clean and lubricate guide rods to specification, confirm the stack travels smoothly, and test every adjustment mechanism. On a twelve-station circuit that is a straightforward morning.',
          'Keep chalk away from selectorised equipment where you can, because chalk dust in plate liners is the single most common cause of a stack that feels rough. Wiping rods and vacuuming around stack towers periodically makes a noticeable difference to how the circuit feels.',
          'Hold a spares stock sized to the circuit: selector pins, plate liners, pop-pins and adjustment knobs, grips, and cable assemblies for the two or three most heavily used stations. Since the failures are predictable, a small stock keeps every station in service.',
          'Plan upholstery renewal on a cycle rather than reactively. Pads on a busy circuit have a finite life, and replacing them across the circuit at once keeps the floor looking coherent, whereas replacing them one at a time leaves a patchwork of colours and ages.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and matching a floor',
        paragraphs: Object.freeze([
          'Life Fitness and Technogym selectorised ranges are the most common in UK facilities, both well regarded for biomechanics and finish, with Technogym generally at the top of used pricing. Being common is an advantage used: parts and engineer familiarity are good, and you can find whole circuits rather than fragments.',
          'Matrix, Precor and Cybex all offer strong selectorised equipment that appears regularly on the used market at more accessible prices, with reasonable parts support on recent generations. Gym80 and other European specialists build very solid machines favoured by strength-oriented gyms.',
          'Matching matters more in this category than any other, because a circuit is seen as a single thing by members. A consistent brand and generation means uniform adjustment mechanisms, matching upholstery colours, consistent placards and one spares stock. If you have to mix, plan to reupholster in a single colour to tie the floor together.',
          'Whichever brand you choose, confirm that cables, liners, pins, shrouds and upholstery are available for that generation before committing to a circuit. Buying a twelve-station range whose shrouds are discontinued creates a slow problem you will notice for years.',
        ]),
      }),
      Object.freeze({
        id: 'refurb-and-logistics',
        heading: 'Refurbished circuits, transport and inspection',
        paragraphs: Object.freeze([
          'Refurbished circuits from dealers typically arrive with new cables, serviced stacks and rods, new upholstery throughout, replaced pins and grips and often a repaint. For an operator opening to a date, a circuit that works and matches on day one is worth a real premium over one that mostly works.',
          'As-seen circuit clearances offer the best value if you have the time and the trade contacts. The economics usually work when the frames and stacks are sound and the work needed is cables, pads and pins across the circuit — but quote that work properly across every station before offering, because twelve stations of small jobs is a project.',
          'Inspect every station individually rather than sampling. Machines from the same circuit wear very unevenly depending on which are popular, and it is normal to find two stations needing cables while the rest are fine. Use the machines: select a weight, complete full repetitions, work the adjustments and listen.',
          'Plan logistics around volume. Fulfilment on Equipd is agreed directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and a full circuit is a multi-load job with a lot of dismantling. Agree who strips and who rebuilds, insist that fixings and shrouds are bagged and labelled per machine, and check that seats, pads and pins go back to the right stations.',
          'On arrival, reassemble, check cable routing before loading, test every station and count everything against the agreed list. Confirm handover only when you are satisfied, since confirmation starts the Buyer Protection window on eligible purchases and applies to the order rather than each individual machine.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Circuit planning, stack and cable checks, upholstery and logistics — what to know before buying used selectorised equipment.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What stations do I need for a basic selectorised circuit?',
        answer:
          'A workable general circuit covers a horizontal press, a vertical press, a pulldown or vertical pull, a row, leg extension, leg curl, a leg press or squat-pattern machine, and an abdominal or back station. Start from the movements your members need rather than the number of machines the floor can physically hold.',
      }),
      Object.freeze({
        question: 'Why do weight stacks feel rough on some used machines?',
        answer:
          'Usually chalk dust and grit embedded in the plate liners, or guide rods that are dirty and dry. Both are serviceable with cleaning, lubrication and new liners. The more serious version is a bent guide rod, which causes binding that cleaning will not fix, so watch the plates travel squarely through the full range.',
      }),
      Object.freeze({
        question: 'Is it better to buy a matched circuit or mixed stations?',
        answer:
          'A matched single-brand, single-generation circuit looks deliberate, uses adjustment mechanisms members learn once and needs only one spares stock. Mixed stations cost less and work fine mechanically, but the floor will look assembled rather than designed unless you reupholster everything in one colour to tie it together.',
      }),
      Object.freeze({
        question: 'How much does it cost to reupholster a used circuit?',
        answer:
          'It varies by station count and pad sizes, but it is modest relative to the machines and it is the single highest-return improvement you can make to used selectorised equipment. Get a quote before you buy and treat it as part of the purchase cost rather than something to consider after delivery.',
      }),
      Object.freeze({
        question: 'Are missing shrouds a serious problem?',
        answer:
          'Yes. Shrouds keep hands and clothing away from moving weight stacks, and they are commonly broken or lost during previous relocations. They are also often unobtainable for older models, so check that every cover is present and undamaged before agreeing a price on a circuit.',
      }),
      Object.freeze({
        question: 'What stack increments should I look for?',
        answer:
          'Increments of 5kg are common but coarse for upper-body work with beginners and older members, so machines with finer steps or an add-on top weight are noticeably more useful. On leg stations, check the maximum weight is sufficient for your stronger members, as that is where stacks most often run out.',
      }),
      Object.freeze({
        question: 'How much floor space does a twelve-station circuit need?',
        answer:
          'Each station occupies roughly 1.2 to 1.6 square metres of frame, but plan on around double that per machine once you allow entry space and clearance for moving parts. Also arrange the stations for flow so members can move between them without squeezing past, which matters more than maximising station count.',
      }),
      Object.freeze({
        question: 'Should I inspect every station or is a sample enough?',
        answer:
          'Inspect every one. Machines from a single circuit wear very unevenly because some stations are far more popular than others, and it is normal to find two needing cables while the rest are sound. Use each machine properly: select a weight, complete full repetitions and work every adjustment.',
      }),
      Object.freeze({
        question: 'What spares should I keep for a used circuit?',
        answer:
          'Selector pins, plate liners, pop-pins and adjustment knobs, grips, and cable assemblies for the two or three busiest stations. Failures on selectorised equipment are predictable, so a modest labelled stock is usually the difference between a station out for an hour and one out for a fortnight.',
      }),
      Object.freeze({
        question: 'How is a full circuit transported?',
        answer:
          'As a multi-load job with substantial dismantling. Fulfilment is arranged between buyer and seller on Equipd, so agree who strips and who rebuilds, and insist fixings and shrouds are bagged and labelled per machine. Check pads, seats and pins go back to the correct stations during reassembly.',
      }),
    ]),
    midCtaHeading: 'Fitting out a gym floor?',
    midCtaLead:
      'Browse used pin-loaded and selectorised machines from UK gyms, dealers and refurbishers — individual stations and complete circuits.',
    midCtaLabel: 'Browse Pin-Loaded Machines',
    exploreLead:
      'Keep exploring the commercial strength range, the brands behind most UK circuits, and the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Complete matched circuits',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'used-commercial-benches': Object.freeze({
    eyebrow: 'The kit that never sits idle',
    h1: 'Used Commercial Benches',
    lead: 'Buy used commercial weight benches — flat, adjustable, incline, decline and Olympic — from UK gyms, dealers and refurbishers on Equipd. Secure card payment, Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Commercial Weight Benches for Sale | Equipd',
    metaDescription:
      'Used commercial weight benches from UK gyms and dealers — flat, adjustable and Olympic. Check pads, frames and ladders, then buy securely with Buyer Protection.',
    schemaAbout: 'Used commercial weight benches',
    searchLabel: 'Search commercial benches',
    listingsHeading: 'Live commercial bench listings',
    listingsLead:
      'Flat, adjustable, incline, decline, preacher and Olympic benches listed on Equipd by UK gyms, dealers and refurbishers — often in sets from one floor.',
    listingsCta: 'Browse all commercial benches',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'Benches are only useful with something to lift. Look at racks, dumbbells, plate-loaded machines and free weights to build the free-weight area around them.',
    brandLead:
      'Hammer Strength, Life Fitness, Technogym, Jordan, Eleiko, Watson and Escape all build commercial benches. Pad width, upholstery quality and the adjustment mechanism separate a bench that lasts fifteen years from one that wobbles after two.',
    benefitsHeading: 'Why buy used commercial benches on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'buy-in-sets',
        title: 'Sets from single floors',
        body: 'Gyms replace benches together, so Equipd often carries several matching units from one facility. Buying a set means consistent height, matching upholstery and one repair procedure across your free-weight area.',
      }),
      Object.freeze({
        id: 'commercial-build-for-less',
        title: 'Commercial build at home-bench prices',
        body: 'A used commercial bench often costs less than a new mid-range home bench while being heavier, wider-padded and rated for far greater loads. It is the clearest example of used commercial kit outperforming new consumer equipment.',
      }),
      Object.freeze({
        id: 'easy-logistics',
        title: 'Simple to collect and place',
        body: 'Benches are among the easiest gym equipment to transport — no assembly, no fixings, no power. Most fit in a van and go through a standard doorway, which keeps the total cost of buying used genuinely low.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment and protection',
        body: 'Pay through Equipd with funds held until handover is confirmed and Buyer Protection on eligible purchases, so a set bought from a gym you have never visited is not a leap of faith.',
      }),
    ]),
    valuationEyebrow: 'Clearing a free-weight area?',
    valuationHeading: 'Value benches before you sell them cheap',
    valuationCopy:
      'Commercial benches are routinely undersold because owners assume a bench is a bench. Brand, pad width, adjustment design and upholstery condition make a substantial difference, and premium benches hold value strongly. Use the free Equipd valuation on the model to see the UK range before you list a set or accept an offer.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the bench model or type' }),
      Object.freeze({ label: 'Details', body: 'Add year, adjustment type and pad condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK market range' }),
      Object.freeze({ label: 'Decide', body: 'List the set or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial bench buying guide',
    guideIntro:
      'Benches are the most used and least considered equipment in any free-weight area. Members lie on them, stand on them, drag them across the floor and load them with more weight than the manufacturer imagined, and a good commercial bench takes all of it for fifteen years. That durability is exactly why the used market is so strong: benches from closing gyms are usually structurally perfect with tired upholstery, which is a cheap and quick fix. The pitfalls are specific — a bench whose adjustment ladder has been bent, one whose frame has been twisted by being dragged, or one whose pad gap makes pressing uncomfortable. This guide covers bench types and specification, upholstery and frames, the faults to look for, dimensions and layout, maintenance, brand differences, reupholstery economics, and how to buy sets sensibly.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'bench-types',
        heading: 'Flat, adjustable, Olympic and specialist benches',
        paragraphs: Object.freeze([
          'Flat benches are the workhorses. They are simple, immensely strong, take no time to reposition and never have an adjustment mechanism to seize. Any free-weight area needs more of them than anything else, and used flat benches from good manufacturers are among the best value purchases in the whole category.',
          'Adjustable benches — usually flat to incline, and sometimes decline as well — are the versatile option and the ones members will queue for. The adjustment mechanism is what you are really buying: a robust ladder or pop-pin system that changes quickly and locks solidly is worth paying for, because a fiddly mechanism means members simply leave the bench flat.',
          'Olympic bench presses with integrated uprights are a different proposition. They combine a bench and bar supports in one unit, which suits gyms without enough racks, but the fixed uprights limit adjustment and the safety provision is usually poorer than a rack. They sell well used and are worth having, though a rack plus a good adjustable bench is the more flexible investment.',
          'Specialist benches — preacher curl, seated shoulder press with a vertical back, decline abdominal, hyperextension — earn their space only in bigger areas. They are cheap used because demand is narrower, which makes them a sensible way to add variety once the core flat and adjustable benches are covered.',
        ]),
      }),
      Object.freeze({
        id: 'pads-and-frames',
        heading: 'Pad width, gaps, upholstery and frame construction',
        paragraphs: Object.freeze([
          'Pad width matters more than most buyers realise. A pad around 25 to 30cm suits most pressing, giving shoulder support without restricting the shoulder blades. Very narrow pads feel unstable under heavy loads and very wide ones interfere with proper scapular position, so check the width against how your members actually press.',
          'On adjustable benches, look at the gap between the seat pad and the back pad. A large gap is uncomfortable and unhelpful when pressing at an incline, and it is a common shortcoming on older or cheaper designs. Lie on the bench in the incline positions you expect members to use before agreeing a price.',
          'Assess upholstery on condition and construction. Commercial benches use heavy-duty vinyl over dense foam, and the failure modes are split seams, splits at the edges where members grip, compressed foam that no longer supports, and staple lines pulling out underneath. Splits are a hygiene problem as much as a cosmetic one, since foam absorbs sweat.',
          'Check the frame itself. Commercial benches use substantial box or tube steel, and the weight of the bench is a reasonable proxy for how heavily it is built. Look at the welds where the uprights meet the base and around the adjustment ladder, and check the feet — worn or missing foot pads let steel scrape the floor and let the bench rock.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Common faults on used benches',
        paragraphs: Object.freeze([
          'Wobble is the most common complaint and usually has a simple cause: missing or worn foot pads, a bent leg from being dragged, or a floor that is not flat. Set the bench on a level surface and rock it, then check the feet. A bench that rocks on a flat floor with sound feet has a frame problem.',
          'Test the adjustment through every position several times. Ladders and pop-pins get bent when members adjust a bench with weight on it, and a mechanism that needs lifting at a particular angle or a firm shove is already partly damaged. Any position that will not lock positively makes the bench unsafe at that setting.',
          'Look for evidence of hard use. Dents on the top surface of pads from dropped dumbbells, scuffed and torn upholstery at the edges, bent transport handles, seized wheels and a frame that has been dragged rather than lifted are all normal on ex-facility benches, and all legitimate negotiating points.',
          'Check the frame is square. Set the bench on a flat floor and look along it from the end — a bench twisted from being dragged over a threshold will never sit properly and will always feel unstable. This is the one fault that is difficult to put right and worth walking away from, particularly given how many sound benches are available.',
        ]),
      }),
      Object.freeze({
        id: 'dimensions-and-layout',
        heading: 'Dimensions, weight and layout',
        paragraphs: Object.freeze([
          'A commercial flat bench typically measures around 1.2 to 1.5m long and 0.6m wide, with a pad height near 45cm to suit the standard rack and lifting positions. Adjustable and Olympic benches are longer, particularly with uprights. None of that is demanding on space individually, but a free-weight area needs clear space around each bench for spotters and for dumbbell work.',
          'Benches are heavy for their size — commonly 30 to 70kg for commercial units, and considerably more for Olympic benches. That mass is what makes them stable, but it also means they are not casually repositioned, which is why many commercial benches include wheels and a handle at one end.',
          'Plan how benches interact with racks. A bench that will be used inside a power rack needs to fit between the uprights with room for the lifter, and pad height needs to work with the rack hole spacing so the bar can be set at a proper press height. Check compatibility before buying rather than discovering it on installation day.',
          'Allow space for storage. Facilities that own several flat benches usually want somewhere to put the ones not in use, and benches parked in walkways are both an obstruction and a hazard. A designated bench area or a rack designed for storing them keeps the floor tidy.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and upholstery care',
        paragraphs: Object.freeze([
          'Bench maintenance is mostly upholstery care. Wipe pads down with an appropriate cleaner rather than a harsh solvent, since aggressive products degrade vinyl and cause premature cracking. Members and cleaning staff both need to know which product to use, because this is the single biggest determinant of how long pads last.',
          'Repair small splits promptly. A minor tear in vinyl grows quickly under use and lets sweat into the foam, at which point the pad has to be replaced rather than patched. A vinyl repair patch applied the week a split appears can add a couple of years to a pad.',
          'Check fixings and adjustment mechanisms monthly. Bolts loosen on anything that gets moved and loaded repeatedly, and a bench with slightly loose fixings feels unstable and wears its own holes. Also check the feet and wheels, replacing worn pads before bare steel starts marking the floor.',
          'Have benches reupholstered on a cycle rather than one at a time. Doing a whole set together keeps the area looking consistent, and upholstery firms are cheaper per unit for a batch. Because the frames are permanent, a set of benches can be recovered several times over their life.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and what commands a premium',
        paragraphs: Object.freeze([
          'Hammer Strength and Life Fitness benches are common in UK commercial gyms with heavy frames and well-judged pad dimensions, and they are straightforward to buy used in numbers. Technogym benches are beautifully finished and match its wider ranges, which matters if you are maintaining a coordinated floor.',
          'UK and European specialists — Watson, Eleiko, Jordan and Escape among them — build benches that strength-focused facilities specifically seek out. Watson and Eleiko in particular hold their value strongly used, and a well-kept example can be worth a multiple of a generic bench of the same age.',
          'The premium is mostly for steel weight, adjustment quality, pad construction and the pad gap. A bench that adjusts quickly and locks solidly, sits rock-steady under a heavy press and has a well-shaped pad is a genuinely better product, and members notice on every set.',
          'Parts availability matters less here than in any other category, since a bench is a frame and a pad. Upholstery can be made by any competent trimmer, which is why even benches from discontinued manufacturers remain fully serviceable purchases.',
        ]),
      }),
      Object.freeze({
        id: 'reupholstery-and-logistics',
        heading: 'Reupholstery economics, transport and inspection',
        paragraphs: Object.freeze([
          'Reupholstery is the key insight in buying used benches. A structurally excellent commercial bench with split pads is usually the cheapest good bench you can own, because recovering the pads costs a modest amount and produces something that looks and feels new. Buy on frame and mechanism condition and treat pads as a planned cost.',
          'That also means you should not pay a large premium for perfect upholstery on an otherwise identical bench, unless you need it usable immediately. Weigh the price difference against a trimmer\'s quote and decide accordingly — for a set of six, the arithmetic is usually clear.',
          'Inspect properly despite the simplicity. Sit and lie on the bench, work every adjustment position, rock it on a flat floor, check the feet, look along the frame for twist, examine welds at the uprights and ladder, and inspect the pad seams and edges. Photograph each bench if you are buying a set and note any differences between them.',
          'Transport is the easiest of any gym equipment. Fulfilment on Equipd is agreed directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and benches need no dismantling and fit in a van. Load them padded and strapped so pads do not get punctured in transit, then inspect on arrival and confirm handover only when satisfied, since confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Pad widths and gaps, adjustment mechanisms, wobble and reupholstery — the practical questions when buying used commercial benches.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'How wide should a commercial bench pad be?',
        answer:
          'Around 25 to 30cm suits most pressing, giving shoulder support without restricting the shoulder blades. Very narrow pads feel unstable under heavy loads, and unusually wide ones interfere with proper scapular position. Check the width against how your members actually press rather than assuming wider is better.',
      }),
      Object.freeze({
        question: 'Why does the gap between the seat and back pad matter?',
        answer:
          'A large gap is uncomfortable and unsupportive when pressing at an incline, and it is a common weakness on older or cheaper adjustable benches. Lie on the bench in the incline positions your members will use before agreeing a price, because it is not something you can change afterwards.',
      }),
      Object.freeze({
        question: 'What causes a used bench to wobble?',
        answer:
          'Most often missing or worn foot pads, a leg bent from being dragged, or an uneven floor. Set the bench on a level surface, check the feet and rock it. If it still rocks with sound feet on a flat floor, the frame is likely twisted, which is difficult to correct and a reason to look elsewhere.',
      }),
      Object.freeze({
        question: 'How do I test the adjustment mechanism?',
        answer:
          'Work it through every position several times, checking it moves without force and locks positively at each setting. Ladders and pop-pins get bent when members adjust a bench with weight on it, so a mechanism needing a particular knack or a firm shove is already damaged and should be repaired before use.',
      }),
      Object.freeze({
        question: 'Is it worth buying a bench with split upholstery?',
        answer:
          'Usually yes, provided the frame and mechanism are sound. Recovering pads costs a modest amount and produces a bench that looks and feels new, so a structurally excellent bench with tired pads is often the cheapest good bench you can own. Get a trimmer\'s quote and factor it into your offer.',
      }),
      Object.freeze({
        question: 'Should I buy an Olympic bench press or a rack and bench?',
        answer:
          'A rack plus a good adjustable bench is the more flexible investment and generally offers better safety provision. Olympic benches with integrated uprights suit gyms short of racks and sell well used, but the fixed uprights limit adjustment. If space and budget allow one option, choose the rack and bench.',
      }),
      Object.freeze({
        question: 'How heavy are commercial benches?',
        answer:
          'Typically 30 to 70kg for flat and adjustable units, and considerably more for Olympic benches. That mass is what makes them stable in use, but it also means they are not casually repositioned, which is why many commercial benches include wheels and a handle at one end.',
      }),
      Object.freeze({
        question: 'Will a used commercial bench fit inside my power rack?',
        answer:
          'Check the bench width against the internal rack width and confirm the pad height works with the rack hole spacing so the bar can be set at a proper press height. Commercial benches are wider than home benches, so this is worth measuring before purchase rather than on installation day.',
      }),
      Object.freeze({
        question: 'How should bench pads be cleaned?',
        answer:
          'With a cleaner appropriate for commercial vinyl rather than a harsh solvent, because aggressive products degrade the material and cause premature cracking. Make sure both members and cleaning staff know which product to use, as this is the biggest single factor in how long upholstery lasts.',
      }),
      Object.freeze({
        question: 'Do I need specialist transport for benches?',
        answer:
          'No. Benches need no dismantling, no power and no fixings, and they fit in a van, which is why they are the easiest gym equipment to buy used. Load them padded and strapped so pads are not punctured in transit, and inspect on arrival before confirming handover.',
      }),
    ]),
    midCtaHeading: 'Need benches for a free-weight area?',
    midCtaLead:
      'Browse used flat, adjustable, incline, decline and Olympic benches from UK gyms, dealers and refurbishers — singles and matched sets.',
    midCtaLabel: 'Browse Commercial Benches',
    exploreLead:
      'Continue through the commercial strength range, the brands strength facilities specify, and the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Heavy commercial frames',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'used-commercial-dumbbells': Object.freeze({
    eyebrow: 'Rubber, urethane and pro-style',
    h1: 'Used Commercial Dumbbells',
    lead: 'Source used commercial dumbbell sets from UK gyms, dealers and refurbishers on Equipd. We provide the marketplace and the secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation so you know what a set is worth.',
    metaTitle: 'Used Commercial Dumbbell Sets for Sale | Equipd',
    metaDescription:
      'Used commercial dumbbell sets from UK gyms and dealers — rubber hex, urethane and pro-style. Check heads and handles, then buy securely with Buyer Protection.',
    schemaAbout: 'Used commercial dumbbells',
    searchLabel: 'Search commercial dumbbells',
    listingsHeading: 'Live commercial dumbbell listings',
    listingsLead:
      'Rubber hex, urethane and pro-style dumbbell sets listed on Equipd by UK gyms, dealers and refurbishers, from part sets to complete racked ranges.',
    listingsCta: 'Browse all commercial dumbbells',
    categoryHeading: 'Other commercial strength to consider',
    categoryLead:
      'Dumbbells need benches and space around them. Look at commercial benches, racks and plate-loaded machines to complete a free-weight area.',
    brandLead:
      'Escape, Jordan, Eleiko, Watson, Iron Grip, Ivanko and Technogym all supply commercial dumbbells. Head material and handle construction determine how a set survives a decade of being dropped, far more than the badge on the end cap.',
    benefitsHeading: 'Why buy used commercial dumbbells on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'weight-is-weight',
        title: 'Steel and rubber do not depreciate in use',
        body: 'A 30kg dumbbell weighs 30kg whether it is new or ten years old. Beyond cosmetic wear and the occasional loose head, used commercial dumbbells perform identically to new ones — which makes this the most rational used purchase in a gym.',
      }),
      Object.freeze({
        id: 'set-availability',
        title: 'Complete sets, not fragments',
        body: 'Gyms replace dumbbells as a range, so Equipd carries full sets with racks rather than the odd pair. Buying a complete set in one transaction saves the frustration of chasing missing weights for months.',
      }),
      Object.freeze({
        id: 'huge-cost-difference',
        title: 'A large saving on a large purchase',
        body: 'A full commercial set from 2.5kg to 50kg is a significant capital cost new. Used sets typically cost a fraction of that, which is often what makes a proper free-weight area affordable at all.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Protected payment on heavy loads',
        body: 'Dumbbell sets are collected on pallets and weigh tonnes. Paying through Equipd means funds are held until handover is confirmed, with Buyer Protection on eligible purchases rather than paying in advance for weight you have not counted.',
      }),
    ]),
    valuationEyebrow: 'Selling a dumbbell set?',
    valuationHeading: 'Value a dumbbell set before you agree a price',
    valuationCopy:
      'Dumbbells are usually priced per kilogram, which hides real differences between urethane, rubber and pro-style sets and between complete and partial ranges. The free Equipd valuation gives you a market view based on the set and its condition, so you can price a clearance sensibly or check whether a per-kilo figure is fair before committing to move several tonnes.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the dumbbell type or brand' }),
      Object.freeze({ label: 'Details', body: 'Add the weight range, rack and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See the UK market range' }),
      Object.freeze({ label: 'Decide', body: 'Buy the set or list yours', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used commercial dumbbell buying guide',
    guideIntro:
      'Dumbbells are the most rational used purchase in a gym, because mass does not wear out. A ten-year-old 25kg dumbbell does exactly what a new one does, and the only real questions are whether the heads are still firmly attached, whether the rubber or urethane has degraded, and whether you have somewhere to put several tonnes of iron. Where buyers go wrong is on the practical detail: assuming a set is complete when three pairs are missing, underestimating the floor loading, forgetting that a rack is needed and specific to the set, or not appreciating that a full set can weigh more than a small car. This guide covers head materials and construction, set ranges and increments, the faults that matter, racks and floor loading, maintenance, brand differences, refurbishment, and how to inspect and move a set without a bad day.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'head-materials',
        heading: 'Rubber hex, urethane and pro-style construction',
        paragraphs: Object.freeze([
          'Rubber hex dumbbells are the commercial default: a hexagonal rubber-encased head on a knurled steel handle. They do not roll, they protect the floor when dropped, and they are the cheapest commercial option new and used. The main drawback is that rubber can mark floors and, in warm rooms, some sets develop a noticeable smell that fades with age.',
          'Urethane dumbbells are the premium choice. Urethane is harder and more durable than rubber, does not mark floors, does not smell and holds its finish for many years, which is why urethane sets dominate higher-end facilities. They cost more new and hold value better used, so expect to pay a premium for a good urethane set — usually justified.',
          'Pro-style dumbbells use plates bolted to a thicker chrome or steel handle, often with a wider grip. They look imposing, are popular in bodybuilding-focused gyms and can be repaired plate by plate, but they are heavier for a given weight, noisier and less forgiving of the floor. Older chrome-handled sets can also be slippery once the knurling wears.',
          'Whatever the material, the handle-to-head joint is what determines longevity. Better commercial dumbbells bond and mechanically fix the head to the handle so it cannot work loose; cheaper ones rely on a single fixing that eventually spins. A spinning head is the single most common terminal fault on used dumbbells, so check every one.',
        ]),
      }),
      Object.freeze({
        id: 'set-ranges',
        heading: 'Set ranges, increments and completeness',
        paragraphs: Object.freeze([
          'A typical general-membership set runs from 2.5kg to 30kg or 40kg in 2.5kg increments, then in larger steps above that. Strength-focused facilities commonly go to 50kg or beyond. Decide your top weight based on your membership rather than ambition, since the heaviest pairs are expensive and often the least used.',
          'Increments matter at the light end. Jumping from 5kg to 10kg is a huge relative increase for a beginner or a rehab client, so 2.5kg steps through the lower range are far more useful than an extra pair at the top. If a used set has coarse increments low down, factor in buying a few intermediate pairs.',
          'Count everything before you agree a price. "Full set" is a phrase that frequently turns out to mean full apart from a few pairs, usually the most useful mid-range weights that walked off over the years. Ask for a photograph of the loaded rack and count the pairs yourself, weight by weight.',
          'Consider whether pairs are genuinely matched. Mixed sets assembled from different brands or generations vary in handle diameter, length and feel, which members notice, and they look untidy on a rack. A consistent set is worth a premium over an equivalent weight of assorted dumbbells.',
        ]),
      }),
      Object.freeze({
        id: 'common-faults',
        heading: 'Faults to check on every dumbbell',
        paragraphs: Object.freeze([
          'Check for loose or spinning heads on every single dumbbell. Grip the handle and try to twist each head, then hold the dumbbell vertically and see if the head shifts. A head that moves will get worse, and on many designs it cannot be properly repaired. This is the check that matters most and it takes seconds per unit.',
          'Inspect the rubber or urethane for splitting, chunking and separation from the handle. Rubber hardens and cracks with age, particularly in hot or sunlit rooms, and once a head has begun to split it will continue. Small surface marks are cosmetic; a split running into the head is not.',
          'Feel the knurling on the handles. Worn smooth knurling makes heavy dumbbells genuinely harder to hold, especially for pressing, and it cannot be restored on a rubber-hex handle. On pro-style dumbbells with chrome handles, check for flaking chrome and rust as well.',
          'Then look at the details: bent handles on pro-style sets, loose plate bolts, missing end caps, illegible weight markings, and any dumbbell that looks like it has been repaired. Also check whether the weight markings are accurate on older sets, since tolerances on cheaper historic dumbbells were sometimes generous.',
        ]),
      }),
      Object.freeze({
        id: 'racks-and-floors',
        heading: 'Racks, floor loading and layout',
        paragraphs: Object.freeze([
          'A dumbbell set needs a rack, and racks are not universal. Saddle spacing, tray depth and tier height all need to suit the dumbbells you are buying, so buying the set and rack together from the same gym is usually the sensible route. A urethane set on a rack designed for a smaller hex set will not sit properly.',
          'Understand the total weight before you commit. A full commercial set from 2.5kg to 50kg in pairs runs to a couple of tonnes or more before you add the rack, and that is concentrated along a few metres of wall. On upper floors, mezzanines and older buildings this genuinely needs checking rather than assuming.',
          'Flooring is not optional. Heavy rubber flooring under a dumbbell area protects the substrate from dropped weights, reduces noise transmission substantially and keeps rubber heads from marking the floor. It is far cheaper to lay before the rack arrives than to work around afterwards.',
          'Plan the space around the rack. Members need room to lift a heavy pair off, turn and walk away without hitting a bench or another member, and they need bench access nearby. A dumbbell rack squeezed into a narrow walkway causes both congestion and dropped weights.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and keeping a set complete',
        paragraphs: Object.freeze([
          'The main maintenance task is checking for loose heads. Add a walk-round to your monthly routine, twisting each head and setting aside any that move. Catching a loosening head early sometimes allows a repair; leaving it does not.',
          'Clean handles and heads regularly with an appropriate cleaner. Dumbbell handles are among the most-touched surfaces in a gym, and rubber and urethane both respond badly to harsh solvents. Keeping them clean also makes worn knurling and developing splits easier to spot.',
          'Enforce racking. The single biggest threat to a dumbbell set is dumbbells being left on the floor, kicked under benches and eventually lost or damaged. Clear signage, staff routines and enough rack space for the set you own is what keeps a set complete for a decade.',
          'Keep a note of what you own. Sets drift over time as pairs are damaged or borrowed for classes, and a simple inventory means you notice a missing pair while it can still be found. It also makes valuing and selling the set straightforward when you eventually upgrade.',
        ]),
      }),
      Object.freeze({
        id: 'brands',
        heading: 'Brand differences and what to pay for',
        paragraphs: Object.freeze([
          'Escape, Jordan and Technogym supply a large share of UK commercial gyms, with both rubber and urethane ranges and good availability used. Eleiko and Watson sit at the premium end with excellent construction and strong resale, and Watson in particular has a loyal following among strength facilities.',
          'Iron Grip and Ivanko are well regarded for pro-style and urethane dumbbells with robust handle-to-head construction, and older sets from either turn up in good condition. Unbranded or budget commercial sets can be perfectly serviceable, but they are the ones most likely to develop loose heads, so inspect them especially carefully.',
          'What you are paying for is head material and joint construction. A urethane set with properly fixed heads from a reputable manufacturer will still be in service in fifteen years; a cheap rubber set with single-fixing heads may start spinning within three. That difference is worth more than any styling.',
          'Handle diameter and length are worth checking against your members\' preferences too. Thicker handles reduce grip comfort for smaller hands on heavy weights, and unusually short handles can be awkward for larger users. If possible, lift a few pairs before committing to a set.',
        ]),
      }),
      Object.freeze({
        id: 'inspection-and-transport',
        heading: 'Inspecting, refurbishing and moving a set',
        paragraphs: Object.freeze([
          'Refurbished dumbbell sets usually mean cleaned heads, replaced end caps, tightened or re-bonded heads where possible and a serviced rack. On pro-style sets, individual plates and handles can be replaced, which makes genuine refurbishment more meaningful than on rubber hex. Ask exactly what has been done.',
          'Inspect the whole set rather than sampling, since a set is only as good as its worst pairs and the mid-range weights get the hardest use. Twist every head, look at every head for splits, feel the knurling on the popular weights, and count the pairs against the agreed list.',
          'Weigh the logistics seriously. Fulfilment is agreed directly between buyer and seller on Equipd — collection, seller delivery or a buyer-arranged courier — and a full set means pallets, a tail-lift vehicle and either a pump truck or a lot of manual handling. Establish whether the seller can palletise and load, and whether your delivery point can accept a pallet.',
          'Plan the destination before the pallets arrive: flooring down, rack position decided and assembled if it comes separately, and enough people to load the rack safely. Count the set and check for loose heads as you rack it, and only confirm handover once the count and condition match what was agreed — confirmation starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Rubber against urethane, loose heads, floor loading and moving several tonnes — the practical questions on used commercial dumbbells.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Is urethane worth paying more for than rubber hex?',
        answer:
          'Usually yes for a commercial floor. Urethane is harder and more durable, does not mark floors and does not smell, and it holds its finish for many years, which is why it dominates higher-end facilities and holds value better used. Rubber hex is cheaper and perfectly serviceable, especially over rubber flooring.',
      }),
      Object.freeze({
        question: 'What is the most important thing to check on used dumbbells?',
        answer:
          'Loose or spinning heads. Grip each handle and try to twist both heads, then hold the dumbbell vertically to see if a head shifts. Movement will get worse and on many designs cannot be properly repaired, so check every dumbbell in the set rather than sampling a few.',
      }),
      Object.freeze({
        question: 'What weight range should a commercial set cover?',
        answer:
          'A general-membership set typically runs from 2.5kg to 30kg or 40kg in 2.5kg increments, with strength-focused gyms going to 50kg or beyond. Prioritise fine increments through the lower and middle range over extra heavy pairs, since the heaviest dumbbells are expensive and usually the least used.',
      }),
      Object.freeze({
        question: 'How do I know if a set is genuinely complete?',
        answer:
          'Ask for a photograph of the fully loaded rack and count the pairs weight by weight before agreeing a price. "Full set" often means full apart from a few pairs, usually the most popular mid-range weights. Confirm the inventory in Equipd messages so the count is documented.',
      }),
      Object.freeze({
        question: 'Do I need to buy the rack with the set?',
        answer:
          'Almost always, because racks are not universal — saddle spacing, tray depth and tier height need to suit your specific dumbbells. Buying the set and rack together from the same gym avoids the problem of a set that will not sit properly, and it is usually cheaper than sourcing a rack separately.',
      }),
      Object.freeze({
        question: 'How much does a full dumbbell set weigh?',
        answer:
          'A commercial set from 2.5kg to 50kg in pairs commonly runs to a couple of tonnes or more before the rack, concentrated along a few metres of wall. That makes floor loading a genuine consideration on upper floors, mezzanines and older buildings, and it dictates how the set has to be transported.',
      }),
      Object.freeze({
        question: 'Do I need special flooring under a dumbbell area?',
        answer:
          'Heavy rubber flooring is effectively essential. It protects the substrate from dropped weights, substantially reduces noise transmission to neighbouring spaces and stops rubber heads marking the floor. Lay it before the rack and set arrive, since retro-fitting around a loaded rack is difficult.',
      }),
      Object.freeze({
        question: 'Why do some used rubber dumbbells smell?',
        answer:
          'The rubber compound used in some sets gives off an odour that is more noticeable in warm, poorly ventilated rooms, and it fades over time. It is a nuisance rather than a defect. If it matters for your space, urethane sets do not have the issue at all.',
      }),
      Object.freeze({
        question: 'Can worn knurling be repaired?',
        answer:
          'Not on rubber hex or urethane dumbbells with integrated handles. Worn smooth knurling makes heavier dumbbells noticeably harder to grip, particularly for pressing, so check the handles on the popular mid-range weights specifically since those wear first. Pro-style sets with replaceable handles are the exception.',
      }),
      Object.freeze({
        question: 'How is a dumbbell set delivered?',
        answer:
          'On pallets, needing a tail-lift vehicle and either a pump truck or plenty of manual handling. Fulfilment is arranged between buyer and seller on Equipd, so confirm whether the seller can palletise and load and whether your delivery point can take a pallet. Count the set as you rack it before confirming handover.',
      }),
    ]),
    midCtaHeading: 'Looking for a dumbbell set?',
    midCtaLead:
      'Browse used rubber hex, urethane and pro-style commercial dumbbells from UK gyms, dealers and refurbishers, including complete racked sets.',
    midCtaLabel: 'Browse Commercial Dumbbells',
    exploreLead:
      'Explore the rest of the commercial strength range, the brands supplying UK free-weight areas, and the Equipd guides to buying and valuing kit.',
    heroTrustItems: Object.freeze([
      'Complete racked sets',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'home-treadmills': Object.freeze({
    eyebrow: 'Running at home, without the gym membership',
    h1: 'Used Home Treadmills',
    lead: 'Browse used home treadmills from private sellers, dealers and refurbishers across the UK. Equipd is the marketplace, not the seller — pay securely by card, get Buyer Protection on eligible purchases and check any model with a free Instant Valuation first.',
    metaTitle: 'Used Home Treadmills for Sale UK | Equipd',
    metaDescription:
      'Buy used home treadmills from UK sellers. Compare folding models, motor sizes and noise, then pay securely with Buyer Protection on eligible purchases.',
    schemaAbout: 'Used home treadmills',
    searchLabel: 'Search home treadmills',
    listingsHeading: 'Live home treadmill listings',
    listingsLead:
      'Home and light-commercial treadmills listed on Equipd by private sellers, dealers and refurbishers across the UK, including folding models for tight spaces.',
    listingsCta: 'Browse all home treadmills',
    categoryHeading: 'Other home cardio to consider',
    categoryLead:
      'A treadmill is not the only option for cardio at home. Bikes, cross trainers and rowers are quieter, lighter and often better suited to flats and upstairs rooms.',
    brandLead:
      'NordicTrack, ProForm, Sole, Horizon, JTX, Reebok and Technogym all sell home treadmills in the UK, with big differences in deck size, motor rating and whether the console needs a subscription to be useful.',
    benefitsHeading: 'Why buy a used home treadmill on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'depreciation',
        title: 'Let the first owner take the depreciation',
        body: 'Treadmills lose a large share of their value the moment they leave the shop, and many are barely used. Buying second-hand often gets you a far better specification than the same money buys new.',
      }),
      Object.freeze({
        id: 'better-spec-for-money',
        title: 'A stronger machine for the same budget',
        body: 'Used money frequently stretches to a longer deck, a bigger motor and better cushioning — the things that decide whether you actually enjoy running at home or quietly stop after a month.',
      }),
      Object.freeze({
        id: 'buyer-protection',
        title: 'Buyer Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with a protection window afterwards on eligible purchases. That matters on a machine with a motor, a belt and electronics you cannot judge from photographs.',
      }),
      Object.freeze({
        id: 'valuation',
        title: 'Free valuation before you offer',
        body: 'The free Instant Valuation shows what the model is actually worth used, which is far more useful than comparing against a list price that may never have been paid.',
      }),
    ]),
    valuationEyebrow: 'Treadmill gathering dust?',
    valuationHeading: 'Value a home treadmill in a couple of minutes',
    valuationCopy:
      'Home treadmills are the most commonly under-priced and over-priced items in used fitness equipment, because sellers work from what they paid and buyers have nothing to compare against. Use the free Equipd valuation on the exact model to see a realistic UK range from the year and condition, whether you are selling the one in your spare room or making an offer on somebody else\'s.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find your treadmill model' }),
      Object.freeze({ label: 'Details', body: 'Add the age and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See what it is worth used' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or buy with confidence', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home treadmill buying guide',
    guideIntro:
      'A treadmill is the most popular piece of home fitness equipment and the one most likely to end up unused in a spare room, which is exactly why the second-hand market is so good. The trick is buying one that suits your house as well as your training. A machine that is too heavy for the route upstairs, too loud for the flat below, too short in the deck for your stride or dependent on a subscription you do not want will not get used no matter how good the specification looks. This guide covers folding versus fixed frames, motor and deck specification, noise and neighbours, the faults that matter on used machines, measuring your space, domestic power, maintenance you can do yourself, and how to get a 100kg machine into an upstairs room without damaging either the treadmill or the house.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'folding-or-fixed',
        heading: 'Folding or fixed, and how much treadmill you need',
        paragraphs: Object.freeze([
          'Folding treadmills lift the deck vertically so the machine takes up less floor space when not in use, and most have a hydraulic soft-drop mechanism to lower it safely. They are the right choice if the treadmill shares a room with anything else, though the folding hinge adds a component that can wear and they are generally lighter and less rigid than fixed-frame machines.',
          'Fixed-frame treadmills are heavier, more stable underfoot and feel considerably better at higher speeds. If you have a dedicated space — a garage, a converted room, a large landing — a fixed frame is usually the better machine. It is also the harder one to move, so be sure the space is permanent before you commit.',
          'Match the deck length to how you will actually use the machine. Walking and gentle jogging is comfortable on a shorter belt, but running, and particularly running if you are tall, needs a longer running surface or you will find yourself shortening your stride and drifting towards the back. This is the specification people regret most.',
          'Be honest about your training. If you plan brisk walking and incline work, a modest machine will be perfectly satisfying and much easier to house. If you intend to do interval running several times a week, you want the biggest motor rating, longest deck and best cushioning your budget and room will take — a light machine used hard will not last.',
        ]),
      }),
      Object.freeze({
        id: 'motor-and-deck',
        heading: 'Motors, cushioning and console technology',
        paragraphs: Object.freeze([
          'Motor ratings on home treadmills are usually quoted as continuous horsepower, and something around 2hp continuous or more is a sensible target for regular running rather than walking. Be sceptical of peak figures, which are marketing numbers. A motor working near its limit runs hot, gets loud and wears quickly.',
          'Cushioning is what makes home running tolerable on hard floors. Better machines use elastomer or spring systems under the deck to reduce joint loading, and the difference is noticeable within a few minutes. On a used machine, cushioning elements can compress over time, so pay attention to how the deck feels rather than what the sticker claims.',
          'Consoles are the biggest change in home treadmills over the last decade and the biggest trap in buying used. Many machines now build their programmes around a subscription platform, and without an active subscription some consoles lose most of their functionality — sometimes including guided workouts and incline control. Establish exactly what works without paying a monthly fee before you buy.',
          'Check the basics still work regardless of the smart features: the display reads speed and distance, the buttons and quick-select keys respond, the safety key stops the belt, incline moves through its range and any heart-rate grips register something sensible. A simple console in full working order beats a clever one that half works.',
        ]),
      }),
      Object.freeze({
        id: 'noise-and-neighbours',
        heading: 'Noise, vibration, floors and neighbours',
        paragraphs: Object.freeze([
          'Treadmills are the noisiest home cardio machines, and the noise that travels is not the motor — it is the impact of your feet transmitting through the deck into the floor structure. In a flat or an upstairs room that impact carries downstairs far more than you would expect, and it is the most common reason home treadmills stop being used.',
          'A heavy anti-vibration mat under the machine helps significantly and is cheap. It reduces impact transmission, protects the floor covering, keeps the machine from creeping and cuts the drumming resonance that a suspended timber floor can produce. If you are putting a treadmill above a neighbour, treat a proper mat as part of the purchase.',
          'Think about placement within the room. A treadmill on a solid ground floor over concrete is a completely different proposition from one on joists in the middle of a first-floor room. Positioning the machine near a supporting wall rather than the centre of a span reduces flex and noise, and running earlier in the evening rather than late is a courtesy that avoids most complaints.',
          'If you live in a flat with people below and want to run indoors regularly, consider whether a treadmill is the right choice at all. A magnetic bike, a cross trainer or a magnetic rower generates a fraction of the impact noise, and many people who bought a treadmill for a flat end up wishing they had bought one of those.',
        ]),
      }),
      Object.freeze({
        id: 'faults',
        heading: 'Faults to check on a used home treadmill',
        paragraphs: Object.freeze([
          'Run the machine properly during your inspection, with someone standing on the belt, and take it through the speed and incline range. A treadmill that runs smoothly empty can hesitate badly under load, which points to belt tension, the drive belt or a tired motor. Let it run for several minutes rather than a few seconds.',
          'Feel the belt surface for glazing, fraying and wear in the middle of the walking zone, and check the belt tracks centrally without drifting to one side. Also check the deck feels consistent along its length — a soft or hollow-sounding patch suggests the deck surface has worn where the user always lands.',
          'Listen for the classic noises. Grinding suggests roller or motor bearings, a rhythmic slap points to a belt joint or worn roller, and a squeal is often the drive belt. Run the incline right through its range and back, since incline motors are a common failure point and an incline that jams or stalls is an expensive repair on a home machine.',
          'On folding machines, work the folding mechanism several times. The hydraulic soft-drop should lower the deck gently and the deck should lock securely upright. A failed damper lets the deck fall, which is a genuine hazard in a house with children. Also check the frame for cracks around the hinge and for rust if the machine has lived in a garage.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-power',
        heading: 'Measuring your space and checking domestic power',
        paragraphs: Object.freeze([
          'Home treadmills commonly need somewhere around 1.6 to 2m of length and 0.7 to 0.9m of width, but the usable space is larger. You need clear run-off behind the machine in case you stumble, room at the sides to get on and off, and ideally space in front so the console is not pressed against a wall.',
          'Check ceiling height as well as floor area, particularly in loft rooms, garages with low beams and under-stairs spaces. The deck sits several inches off the floor and you then need clearance above your head while running, so a room that feels fine standing in can be too low in practice.',
          'Measure the whole route in before you buy: doorway widths, the turn at the top of the stairs, banister clearance and any tight landing. Home treadmills weigh roughly 80 to 130kg and do not dismantle far, so if the route is tight, a folding machine or a lighter model may be the only realistic option.',
          'On power, home treadmills run from a standard UK three-pin socket, but they draw a lot for a domestic appliance. Give the treadmill its own socket rather than sharing an extension lead with other equipment, avoid long thin extension cables, and if you are in an older property with an ageing consumer unit and the breaker trips when the motor is under load, get an electrician to look rather than working around it.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance you can do yourself',
        paragraphs: Object.freeze([
          'Keep the area around and under the treadmill clean. Dust, carpet fibres and pet hair get drawn under the belt and into the motor housing, where they accelerate deck wear and make the motor run hot. Vacuuming under the machine and, occasionally and with it unplugged, under the motor cover is the highest-value maintenance job there is.',
          'Check belt tension and tracking periodically. Both are usually adjusted with an Allen key at the rear rollers, and the manual will give the procedure and the correct feel. A belt that slips under foot strike needs tension; one that drifts to one side needs tracking adjustment, and a quarter turn at a time is the right approach.',
          'Follow the manufacturer guidance on deck lubrication. Some home treadmills specify periodic silicone lubricant under the belt, while others use permanently lubricated decks where adding lubricant causes problems. Look up the specific model rather than applying a general rule, because getting this wrong in either direction shortens deck life.',
          'Unplug the machine when it is not in use if it lives somewhere damp like a garage, and consider a cover. Damp and treadmill electronics do not mix, and a garage machine that has sat through a couple of winters uncovered is far more likely to have corrosion problems than one kept in a heated room.',
        ]),
      }),
      Object.freeze({
        id: 'buying-and-collecting',
        heading: 'Home or commercial, and collecting safely',
        paragraphs: Object.freeze([
          'Consider whether an ex-commercial treadmill suits you. A used gym machine is far better built than any home treadmill at a similar price, with a bigger motor, a longer deck and parts that stay available. The catches are weight of 180kg or more, no folding, a footprint designed for a gym floor and a power draw worth checking — brilliant for a garage, usually impossible for an upstairs box room.',
          'Ask why the machine is being sold, and take the answer seriously. "Barely used, need the space" is the most common and often genuine story in home treadmills, and it is exactly the machine you want. A machine sold because "it just needs a new belt" is a different proposition — price the part before you decide it is a bargain.',
          'Inspect before you pay wherever you can. Run the machine, check the belt and folding mechanism, look for corrosion, confirm the safety key is present and photograph the model and serial plate. If you genuinely cannot attend, ask for a video of the machine running with someone on the belt and the console visible.',
          'Plan the lift honestly. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and a treadmill needs at least two capable people, a clear route and preferably a stair trolley. Ask whether the console or uprights come off if the route is tight, and get any fixings bagged.',
          'Only confirm handover once the machine is in place and you have run it. Confirmation is what starts the Buyer Protection window on eligible purchases, so it belongs after you have plugged the treadmill in and used it rather than while it is still on the pavement.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Noise and neighbours, folding frames, subscription consoles and domestic power — the questions that decide whether a used treadmill works at home.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Can I use a treadmill in a first-floor flat?',
        answer:
          'You can, but foot impact transmits through the floor structure to the property below far more than the motor noise you notice yourself. A heavy anti-vibration mat, positioning the machine near a supporting wall rather than mid-span, and avoiding late evening use all help. If neighbours below are a concern, a magnetic bike or rower is a kinder choice.',
      }),
      Object.freeze({
        question: 'Are folding treadmills less sturdy than fixed ones?',
        answer:
          'Generally yes — folding frames tend to be lighter and feel less planted at speed, and the hinge is an extra component that can wear. They are still the right choice if the machine shares a room with anything else. If you have a dedicated space and plan to run fast, a fixed frame feels noticeably better.',
      }),
      Object.freeze({
        question: 'What motor size do I need for running at home?',
        answer:
          'Look for around 2hp continuous or more if you intend to run regularly rather than walk, and treat quoted peak figures as marketing. A motor working near its limit gets hot and loud and wears quickly, so if you are choosing between a bigger motor and extra console features, take the motor.',
      }),
      Object.freeze({
        question: 'Do I need a subscription to use a used treadmill console?',
        answer:
          'On some machines, yes — several manufacturers build their programmes around a subscription platform, and without one the console can lose guided workouts and sometimes automatic incline control. Establish exactly what functions work without a paid subscription before buying, because it materially affects what the machine is worth to you.',
      }),
      Object.freeze({
        question: 'How much space does a home treadmill need?',
        answer:
          'Typically 1.6 to 2m long and 0.7 to 0.9m wide, plus clear run-off behind in case you stumble and room at the sides to get on and off. Also check ceiling height, since the deck sits several inches off the floor and low loft rooms or garages with beams can be too tight for running.',
      }),
      Object.freeze({
        question: 'Can a treadmill run on a normal household socket?',
        answer:
          'Yes, home treadmills use a standard UK three-pin plug, but they draw heavily for a domestic appliance. Give the machine its own socket rather than a shared extension lead, avoid long thin extension cables, and if the breaker trips under load in an older property, have an electrician check the circuit.',
      }),
      Object.freeze({
        question: 'How do I check the belt and deck on a used treadmill?',
        answer:
          'Run the machine with someone standing on the belt through its full speed and incline range for several minutes. Feel the belt for glazing and fraying, check it tracks centrally without drifting, and listen for grinding or a rhythmic slap. A soft or hollow patch in the middle means the deck has worn where the user always landed.',
      }),
      Object.freeze({
        question: 'Is an ex-commercial treadmill a good idea for home use?',
        answer:
          'It can be excellent value if you have the space and access. Gym machines are far better built than home models at similar used prices, with bigger motors and better parts support. The obstacles are weight of 180kg or more, no folding, a large footprint and a heavier power draw — ideal for a garage, rarely practical upstairs.',
      }),
      Object.freeze({
        question: 'Does a home treadmill need lubricating?',
        answer:
          'It depends on the model. Some specify periodic silicone lubricant under the belt while others use permanently lubricated decks where adding lubricant causes problems. Check the manual for that specific machine rather than following general advice, since getting it wrong in either direction shortens deck life.',
      }),
      Object.freeze({
        question: 'How many people do I need to move a treadmill?',
        answer:
          'At least two capable people, a clear measured route and preferably a stair trolley — home treadmills weigh roughly 80 to 130kg and do not dismantle far. Ask whether the console or uprights come off if the route is tight, get fixings bagged, and check doorways, stair turns and banister clearance before collection day.',
      }),
    ]),
    midCtaHeading: 'Ready to find a home treadmill?',
    midCtaLead:
      'Compare used home treadmills listed across the UK, from compact folding machines to full-size decks for a garage gym.',
    midCtaLabel: 'Browse Home Treadmills',
    exploreLead:
      'Keep looking through home cardio and home strength categories, plus the Equipd guides to buying, selling and valuing equipment safely.',
    heroTrustItems: Object.freeze([
      'Folding and full-size models',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'home-exercise-bikes': Object.freeze({
    eyebrow: 'Quiet cardio that fits anywhere',
    h1: 'Used Home Exercise Bikes',
    lead: 'Find used home exercise bikes — upright and recumbent — from private sellers, dealers and refurbishers across the UK. Equipd hosts the marketplace with secure card payments, Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Home Exercise Bikes for Sale UK | Equipd',
    metaDescription:
      'Used upright and recumbent home exercise bikes from UK sellers. Quiet, compact cardio for flats and spare rooms, with Buyer Protection on eligible purchases.',
    schemaAbout: 'Used home exercise bikes',
    searchLabel: 'Search home exercise bikes',
    listingsHeading: 'Live home exercise bike listings',
    listingsLead:
      'Upright and recumbent home exercise bikes listed on Equipd by private sellers, dealers and refurbishers throughout the UK.',
    listingsCta: 'Browse all home exercise bikes',
    categoryHeading: 'Other home cardio to consider',
    categoryLead:
      'Bikes are the easiest cardio to live with at home. If you want variety, cross trainers and rowers are also quiet, while treadmills give you walking and running at the cost of noise and space.',
    brandLead:
      'JTX, Reebok, NordicTrack, Schwinn, Decathlon, Horizon and Technogym all sell home bikes in the UK. Build weight, flywheel smoothness and whether the console connects to training apps are what separate them.',
    benefitsHeading: 'Why buy a used home exercise bike on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'quiet-and-neighbour-friendly',
        title: 'Quiet enough for a flat',
        body: 'A magnetic exercise bike is close to silent apart from the fan of your own breathing, with no impact travelling into the floor. It is the single most neighbour-friendly piece of cardio equipment you can own.',
      }),
      Object.freeze({
        id: 'small-footprint',
        title: 'Fits where a treadmill will not',
        body: 'An upright bike occupies about the space of an armchair and can be tucked into a bedroom corner or moved between rooms by one person, which is why bikes get used long after bigger machines have been given up on.',
      }),
      Object.freeze({
        id: 'bargain-category',
        title: 'The best value in used cardio',
        body: 'Home bikes are bought with enthusiasm and often barely ridden, so the used market is full of near-new machines at a fraction of retail. Buyer Protection on eligible purchases means you can take advantage with some reassurance.',
      }),
      Object.freeze({
        id: 'valuation',
        title: 'Check the price before you offer',
        body: 'Asking prices on used bikes are all over the place. The free Instant Valuation shows a realistic UK range for the model so you know whether a listing is a bargain or optimistic.',
      }),
    ]),
    valuationEyebrow: 'Bike in the spare room?',
    valuationHeading: 'Value a home exercise bike free',
    valuationCopy:
      'Exercise bikes are the classic unused purchase, which means plenty of good machines are sold for far less than they are worth and a few are advertised for far more. The free Equipd valuation gives you a UK market range for the specific model based on age and condition, so you can list yours realistically or make a sensible offer on someone else\'s.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find your bike model' }),
      Object.freeze({ label: 'Details', body: 'Add the age and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'List it or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home exercise bike buying guide',
    guideIntro:
      'An exercise bike is the most practical piece of cardio equipment for most UK homes. It is quiet, it fits in a corner, it can be carried upstairs by one determined person, it does not annoy the neighbours and it needs no special flooring. It is also the item most likely to be bought new, used for six weeks and then sold on, which makes the second-hand market unusually rich in barely-used machines. What you need to get right is the type — upright or recumbent — and the build quality, because a light bike with a small flywheel feels unpleasant to pedal and that is the real reason people stop. This guide covers upright against recumbent, flywheels and resistance, checking a used bike, space and moving it, noise, connectivity and apps, maintenance, and how spin bikes differ if that is what you actually want.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'upright-or-recumbent',
        heading: 'Upright or recumbent for home use',
        paragraphs: Object.freeze([
          'Upright bikes put you over the pedals in a familiar cycling position and take up the least space. They suit most people, work well for steady cardio and intervals, and are the easiest to move and store. The saddle takes getting used to, and that is worth knowing before you buy rather than discovering it in week two.',
          'Recumbent bikes seat you in a supported, reclined position with the pedals out in front. They are considerably more comfortable for longer sessions, much kinder on the lower back, and easier to get on and off, which makes them the better choice for older riders, anyone recovering from injury and anyone who wants to ride while watching something for an hour.',
          'The trade-off is length. A recumbent needs roughly 1.5m or more of floor length against about a metre for an upright, and it is harder to tuck out of the way. If you have the room, comfort usually wins on how much the bike actually gets used; if space is tight, an upright is the pragmatic answer.',
          'Consider who else will use it. A recumbent suits a household with a wide age range far better, while an upright suits a single user training in a small space. If someone in the house has knee, hip or back problems, a recumbent is very often the difference between a bike that is used daily and one that is not.',
        ]),
      }),
      Object.freeze({
        id: 'flywheel-and-resistance',
        heading: 'Flywheel weight, resistance and why cheap bikes feel wrong',
        paragraphs: Object.freeze([
          'Pedalling feel comes mostly from flywheel weight and drive quality. A heavier flywheel carries momentum through the pedal stroke and feels smooth; a light one feels jerky and plasticky, and that unpleasantness is the main reason budget bikes end up unused. Where you can, ride the bike before buying and judge the feel rather than the specification list.',
          'Magnetic resistance is what you want, and it is standard on almost anything worth buying. It is silent, has no contact wear and adjusts either manually with a knob or electronically from the console. Older bikes with a friction pad or a fan for resistance are noisier and less pleasant, and there is little reason to choose one now.',
          'Check how resistance is controlled. Manual knob adjustment is simple and never breaks, while electronic control allows programmes and app-controlled resistance but adds electronics to go wrong. On a used bike, work through the whole resistance range and confirm each step actually changes how hard it is to pedal.',
          'Look at overall build weight as a proxy for quality. A heavier bike is generally more stable, quieter and better made, and will not rock when you push hard. Also check the bike sits level and the levelling feet are present, since a bike that wobbles on the floor feels cheap regardless of what it cost.',
        ]),
      }),
      Object.freeze({
        id: 'checking-used',
        heading: 'What to check on a used home bike',
        paragraphs: Object.freeze([
          'Ride it for a few minutes through the full resistance range, out of the saddle if the bike allows it, and listen. Bearing rumble, a clicking bottom bracket or a knock through the pedal stroke are the faults that matter, and they are all easy to hear within a minute of riding.',
          'Check the pedals and cranks carefully. Pedal threads are the most commonly damaged part on home bikes because people over-tighten or cross-thread them, and a stripped crank thread is a proper repair rather than a cheap pedal swap. Rock each crank laterally to check for play, and make sure both pedal straps are present and intact.',
          'Work the seat post and any handlebar adjustment through the full range. Seized posts, missing adjustment knobs and worn pop-pin holes are common on used bikes and make it hard to set the bike up properly, which in turn makes riding uncomfortable. On a recumbent, slide the seat carriage its full length and check it locks firmly at each position.',
          'Test the console. Most home bike computers run on standard batteries, so a dead display is often nothing more than that, but confirm it registers cadence and resistance changes and that all the buttons respond. Then check the frame and welds, look for rust if the bike has lived in a garage or conservatory, and inspect the saddle and grips for splits.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-moving',
        heading: 'Space, floors and getting it home',
        paragraphs: Object.freeze([
          'An upright bike typically needs around 1m by 0.5m of floor space, with a little clearance to get on and off, and a recumbent around 1.5m or more of length. Both are comfortably the smallest cardio footprint you can buy, which is why bikes work in bedrooms, home offices and conservatories where nothing else fits.',
          'Protect the floor. A thin mat under the bike stops the feet marking carpet or scratching laminate, catches sweat and keeps the machine from creeping across a smooth surface. Unlike a treadmill it is not needed for noise, so a light mat is enough.',
          'Weight is manageable — most home bikes are 25 to 60kg — and many have small transport wheels at the front so one person can tilt and roll them between rooms. That mobility is a genuine practical advantage over other cardio, since a bike can live in a corner and be brought out when used.',
          'For collection, most home bikes will go through a standard doorway and up a staircase with two people, and pedals and seats often come off to make it easier. Fulfilment on Equipd is arranged directly between buyer and seller, so agree whether you are collecting or the seller is delivering, and confirm that pedals, seat and any fixings travel with the bike.',
        ]),
      }),
      Object.freeze({
        id: 'noise-and-apps',
        heading: 'Noise, neighbours and connecting to apps',
        paragraphs: Object.freeze([
          'A magnetic bike is the quietest cardio machine you can own. There is no impact and no fan, so the only sounds are the drive belt and your breathing, which means you can ride at six in the morning in a flat without a conversation with the neighbours. That single fact is why bikes suit shared buildings so well.',
          'The one exception is out-of-saddle riding on a light bike, which can rock the frame and transmit some movement into a suspended floor. A heavier bike and a mat solve most of it, and if you plan a lot of standing work you are really looking for a spin bike rather than a home upright.',
          'Many recent home bikes broadcast speed, cadence and resistance over Bluetooth, which lets them work with training apps for guided sessions and virtual rides. That transforms how engaging home cycling is for a lot of people, and it costs nothing extra on the used market if the bike happens to support it.',
          'Check compatibility rather than assuming. Older bikes may have no connectivity at all, and some connect only to a manufacturer app that may or may not still be supported. If app use matters to you, confirm the specific model works with the software you intend to use before you buy, and remember a basic bike plus a separate cadence sensor is a cheap alternative.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and long-term care',
        paragraphs: Object.freeze([
          'Home bikes need very little. Wipe the frame and console down after use, because sweat is the main thing that corrodes a bike over the years, and pay particular attention to the seat post area and the handlebar stem where it collects.',
          'Check the pedals are tight every few months and never force one into the thread. Keep the seat post clean and lightly greased so it does not seize, and check the levelling feet are still doing their job if the bike develops a rock.',
          'Change the console batteries when the display dims rather than assuming the electronics have failed. It is the single most common false alarm on used home bikes, and a two-pound fix is often mistaken for a broken machine.',
          'If the bike lives somewhere cold and damp like a garage or conservatory, expect corrosion over time and consider a cover. Bikes are far more tolerant of these spaces than treadmills because there is much less electronics, but bearings and fasteners still suffer in the damp.',
        ]),
      }),
      Object.freeze({
        id: 'spin-and-commercial',
        heading: 'Spin bikes, ex-gym bikes and choosing between them',
        paragraphs: Object.freeze([
          'If you want to ride out of the saddle, follow spin classes or train like a cyclist, you want a spin or studio bike rather than a home upright. Those have a heavy flywheel, a road-style position and no backrest or programmed console, and they feel completely different. Buying an upright and expecting a spin experience is a common and avoidable mistake.',
          'Ex-commercial gym bikes are a strong option for home use if you have the space. They are built for years of continuous use, most are self-powered so they need no socket, and used prices can be very reasonable. The catches are size — particularly recumbents at 1.7m or so — and weight, though they are far easier to move than an ex-gym treadmill.',
          'Weigh comfort against specification honestly. The best home bike is the one you will get on four times a week, and for many people that is a comfortable recumbent in front of the television rather than a more serious machine in a cold garage. Buy for the habit you will actually keep.',
          'Whichever you choose, ride it before you pay if you possibly can and only confirm handover once the bike is in your house and you have used it. Confirmation is what starts the Buyer Protection window on eligible purchases, so a few minutes of riding first is time well spent.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Upright against recumbent, flywheel feel, noise in flats and app connectivity — what matters when buying a used home exercise bike.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Should I buy an upright or a recumbent bike for home?',
        answer:
          'Uprights take the least space and suit most people for steady cardio and intervals. Recumbents are far more comfortable for longer sessions, kinder on the lower back and easier to get on and off, which suits older riders and anyone with knee or hip issues. The trade-off is length: recumbents need around 1.5m or more.',
      }),
      Object.freeze({
        question: 'Why do cheap exercise bikes feel unpleasant to pedal?',
        answer:
          'Mostly light flywheels and low-quality drives, which make the pedal stroke feel jerky rather than smooth. That unpleasantness is the main reason budget bikes end up unused. Ride a bike before buying if you can and judge the feel directly, since it matters far more than the numbers on the console.',
      }),
      Object.freeze({
        question: 'Is an exercise bike quiet enough for a flat?',
        answer:
          'A magnetic bike is the quietest cardio machine you can own — no impact, no fan, just the drive belt and your breathing — so early morning riding in a flat is genuinely fine. The exception is heavy out-of-saddle work on a light frame, which a heavier bike and a mat largely solve.',
      }),
      Object.freeze({
        question: 'What should I check first on a used bike?',
        answer:
          'Ride it through the full resistance range listening for bearing rumble or a clicking bottom bracket, then rock each crank for play and check the pedal threads, which are the most commonly damaged part. Also work the seat post and any handlebar adjustment, since seized posts and missing knobs are very common.',
      }),
      Object.freeze({
        question: 'Do home exercise bikes need to be plugged in?',
        answer:
          'Most do not — the console usually runs on standard batteries and resistance is magnetic. Some bikes with larger screens or powered resistance need a mains adaptor, so check the specific model. A dim display on a used bike is far more often flat batteries than a fault.',
      }),
      Object.freeze({
        question: 'Can I use a used bike with training apps like a virtual ride?',
        answer:
          'Only if the bike broadcasts its data, which many recent models do over Bluetooth. Older bikes may have no connectivity, and some connect only to a manufacturer app that may no longer be supported. Confirm compatibility with the software you intend to use, or consider a basic bike plus a separate cadence sensor.',
      }),
      Object.freeze({
        question: 'How much space does a home exercise bike need?',
        answer:
          'An upright needs around 1m by 0.5m plus a little clearance to mount and dismount; a recumbent needs about 1.5m or more of length. Both are the smallest cardio footprints available, which is why bikes work in bedrooms, home offices and conservatories where other machines simply do not fit.',
      }),
      Object.freeze({
        question: 'Is a spin bike the same as a home exercise bike?',
        answer:
          'No. Spin or studio bikes have a heavy flywheel and a road-style position designed for out-of-saddle riding and class-style sessions, with no backrest or programmed console. If you want to follow spin classes or train like a cyclist, buy a spin bike rather than a home upright and expect a different feel.',
      }),
      Object.freeze({
        question: 'Are ex-gym bikes worth considering for home use?',
        answer:
          'Often yes. Commercial bikes are built for continuous use, most are self-powered so they need no socket, and used prices are reasonable. The obstacles are size — commercial recumbents can be 1.7m long — and weight, though they are far easier to move into a house than an ex-gym treadmill.',
      }),
      Object.freeze({
        question: 'How do I collect a used exercise bike?',
        answer:
          'Most home bikes are 25 to 60kg and will go through a standard doorway and up stairs with two people, and pedals and seats often come off to help. Fulfilment is arranged between buyer and seller on Equipd, so agree collection or delivery in advance and check pedals, seat and fixings travel with the bike.',
      }),
    ]),
    midCtaHeading: 'Looking for a home exercise bike?',
    midCtaLead:
      'Compare used upright and recumbent home bikes listed by private sellers, dealers and refurbishers across the UK.',
    midCtaLabel: 'Browse Home Exercise Bikes',
    exploreLead:
      'Carry on through the home cardio and home strength ranges, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'Quiet magnetic resistance',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'home-cross-trainers': Object.freeze({
    eyebrow: 'Low impact, low noise',
    h1: 'Used Home Cross Trainers',
    lead: 'Browse used home cross trainers and ellipticals from private sellers, dealers and refurbishers across the UK. Equipd provides the marketplace and the secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Home Cross Trainers for Sale UK | Equipd',
    metaDescription:
      'Used home cross trainers and ellipticals from UK sellers. Compare stride length and noise, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used home cross trainers and ellipticals',
    searchLabel: 'Search home cross trainers',
    listingsHeading: 'Live home cross trainer listings',
    listingsLead:
      'Home ellipticals and cross trainers listed on Equipd by private sellers, dealers and refurbishers throughout the UK.',
    listingsCta: 'Browse all home cross trainers',
    categoryHeading: 'Other home cardio to consider',
    categoryLead:
      'Cross trainers give full-body, low-impact cardio. Bikes are smaller and quieter still, rowers store upright, and treadmills add walking and running if you have the space and the floor for it.',
    brandLead:
      'JTX, NordicTrack, Reebok, Horizon, Domyos and Life Fitness all sell home cross trainers in the UK. Stride length, flywheel weight and frame rigidity vary enormously across price points and are what decide how the machine feels.',
    benefitsHeading: 'Why buy a used home cross trainer on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'joint-friendly',
        title: 'Full-body cardio without the impact',
        body: 'A cross trainer works arms and legs together with your feet never leaving the pedals, which suits anyone with sore knees, ankles or hips and produces almost no impact noise for the room below.',
      }),
      Object.freeze({
        id: 'lightly-used-stock',
        title: 'Plenty of barely-used machines',
        body: 'Cross trainers are a classic new-year purchase, so the used market is full of machines with a few hours on them. Buying second-hand is usually the difference between a light budget model and a genuinely good one.',
      }),
      Object.freeze({
        id: 'buyer-protection',
        title: 'Buyer Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with a protection window afterwards on eligible purchases — worth having on a machine whose pivots and rollers are impossible to judge from photographs.',
      }),
      Object.freeze({
        id: 'valuation',
        title: 'Free valuation on the model',
        body: 'Used cross trainer prices vary widely for no obvious reason. The free Instant Valuation gives you a realistic UK range so you can spot a good listing quickly.',
      }),
    ]),
    valuationEyebrow: 'Cross trainer not getting used?',
    valuationHeading: 'Value a home cross trainer free',
    valuationCopy:
      'Cross trainers are frequently sold for far less than they are worth because owners just want the space back, and occasionally listed at close to retail years after purchase. The free Equipd valuation gives you a market range for the exact model by age and condition, which takes the guesswork out of both selling and offering.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find your cross trainer model' }),
      Object.freeze({ label: 'Details', body: 'Add the age and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home cross trainer buying guide',
    guideIntro:
      'Cross trainers are one of the smartest home cardio buys and one of the most variable in quality. At the top of the market they feel smooth, natural and stable; at the bottom they have a short, circular stride, plastic pedal arms and a frame that flexes with every step, and no amount of enthusiasm survives that for long. Because they are bought hopefully and abandoned quietly, the second-hand market is unusually generous — but you have to know what to test, and you have to check the ceiling before you buy, because a cross trainer lifts you 20cm off the floor before you start. This guide covers stride length and drive position, flywheel and frame quality, faults on used machines, ceiling height and footprint, noise for flats and upstairs rooms, maintenance, and how to get one home and assembled.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'stride-and-drive',
        heading: 'Stride length and drive position',
        paragraphs: Object.freeze([
          'Stride length is the specification that decides whether a cross trainer feels like walking or like pedalling a small circle. Budget home machines often have quite short strides, which feels cramped and unnatural for anyone of average height or above, while better home machines offer a considerably longer stride that feels much closer to walking or running.',
          'If you are tall, treat stride length as the first thing you check and the reason to spend more. It is also the specification most often glossed over in listings, so ask the seller for the model number and look it up rather than judging from photographs.',
          'Drive position affects both feel and footprint. Rear-drive machines put the flywheel behind you and generally give a flatter, more natural stride, but they are longer. Front-drive machines are more compact and often cheaper, using a ramp and roller arrangement that becomes the main wear point. Centre-drive designs are the shortest of all and useful where floor space is very tight.',
          'Decide whether you want moving handlebars. Dual-action machines with moving upper handles give upper-body involvement and are what most people expect from a cross trainer, while fixed-handle machines have fewer pivots to develop creaks. Both are common at home, so it is a preference rather than a quality question.',
        ]),
      }),
      Object.freeze({
        id: 'flywheel-and-frame',
        heading: 'Flywheel weight, frame rigidity and build quality',
        paragraphs: Object.freeze([
          'The smoothness of a cross trainer comes largely from flywheel weight. A heavier flywheel carries momentum through the stride and feels fluid, while a light one feels notchy and makes the whole machine seem cheap. It is the single best indicator of how a machine will feel before you get on it.',
          'Frame rigidity matters just as much and is easier to test than to specify. Get on the machine and stride hard: a good cross trainer stays planted, while a light one flexes, rocks and rattles. Overall machine weight is a reasonable proxy — heavier machines are almost always more stable and quieter.',
          'Look at the pedal arms and linkages. Metal pedal arms and proper bearings at the pivots last far longer than plastic arms and plain bushings, and they are the difference between a machine that still feels tight after three years and one that creaks on every step. Check the pedal pads are large enough for your feet in trainers.',
          'Check the maximum user weight and the machine\'s own weight against the specification, since both tell you something honest about how it was built. A machine with a low user weight limit is built light, and it will feel light in use regardless of what the console offers.',
        ]),
      }),
      Object.freeze({
        id: 'faults',
        heading: 'Faults to check on a used cross trainer',
        paragraphs: Object.freeze([
          'Creaking and clicking are the defining complaints on used cross trainers, and they come from dry or worn pivot bushings. Ride the machine hard, at high and low resistance, upright and leaning forward, and listen. Some noise responds to lubrication; a persistent creak under load can mean worn bushings or a loose frame joint.',
          'Check for play at every pivot. With the machine stationary, take hold of the pedal arms and the handlebars and try to move them side to side. A few millimetres becomes an audible knock under a heavier user and gets worse over time. Play everywhere means the machine has done a lot of work or was lightly built to begin with.',
          'On front-drive machines, inspect the ramp and rollers. Look along the ramp surface for grooves and check the rollers for flat spots and scoring, then ride it and feel for a ticking or bumpy stride. Rollers are usually cheap to replace on home machines if parts are available, but the availability is a genuine question on budget brands.',
          'Test the resistance and console. Work through the whole resistance range confirming each level feels different, then check the display registers and the buttons respond. Most home machines need mains power for the console and powered resistance, so confirm the adaptor is included — a missing proprietary adaptor is a surprisingly common problem on used machines.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-ceiling',
        heading: 'Ceiling height, footprint and where it can go',
        paragraphs: Object.freeze([
          'Ceiling height is the constraint people miss. A cross trainer raises you roughly 20cm above the floor before you stand up straight, so you need your own height plus that clearance plus a margin. Loft rooms, garages with beams, rooms with low light fittings and under-stairs spaces frequently fail this test, and it is worth measuring before anything else.',
          'Home machines commonly need around 1.4 to 1.8m of length and 0.6 to 0.7m of width, with rear-drive machines at the longer end. You also want clearance behind for getting on and off and a little at the sides for the moving handlebars, so allow more than the bare footprint.',
          'Most home cross trainers do not fold, though many have transport wheels at one end so you can tilt and roll them a short distance. That means the space you choose is more or less permanent, which makes it worth putting the machine somewhere you will actually want to use it rather than the room you least mind losing.',
          'Think about where the console will face. A cross trainer positioned facing a blank wall gets used far less than one facing a window or a television. It sounds trivial, but for home cardio the difference between an engaging position and a dull one is the difference between four sessions a week and none.',
        ]),
      }),
      Object.freeze({
        id: 'noise',
        heading: 'Noise, floors and neighbours',
        paragraphs: Object.freeze([
          'Cross trainers are among the quietest cardio machines because your feet never leave the pedals, so there is no foot impact to transmit into the floor. In a flat or an upstairs room they are dramatically kinder to the people below than a treadmill, which is one of the main reasons to choose one.',
          'The noise they do make is mechanical: roller rumble on front-drive machines, the drive belt, and creaking from pivots. On a light machine there is also frame movement, which transmits into a suspended floor as a low rocking rather than an impact. A heavier machine solves most of it.',
          'A mat underneath is still worth having. It protects carpet and laminate from the feet, absorbs some vibration, keeps the machine from creeping and catches sweat. You do not need the heavy anti-vibration matting a treadmill wants, so a standard equipment mat is sufficient.',
          'If you are in a flat, position the machine near a supporting wall rather than in the middle of a floor span, and keep pivots lubricated so creaking does not become the thing your neighbours hear. Done sensibly, a cross trainer is one of very few machines you can use late in the evening in a shared building without a second thought.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and keeping it feeling tight',
        paragraphs: Object.freeze([
          'Pivots are everything on a cross trainer. Lubricating them to the manufacturer specification every few months is the single job that keeps the machine feeling new and prevents the creaking that makes people give up on them. Check the manual for which points need attention and what to use.',
          'Keep the ramp and rollers clean on front-drive machines. Dust and grit on the ramp accelerate roller wear noticeably, so wiping the ramp surfaces regularly is genuine mechanical maintenance rather than tidying. It is a two-minute job that adds years to the rollers.',
          'Check fixings periodically, particularly at the uprights and the pedal arm mounts. Home cross trainers are bolted together rather than welded, and bolts loosen with use, producing wobble and creaks that are often mistaken for worn parts. A quick check with the supplied tools resolves a surprising number of complaints.',
          'Wipe the frame and console down after use, since sweat drips onto the pedal arms and the base and corrodes fixings over time. If the machine lives in a garage or conservatory, expect corrosion to be the thing that eventually ages it and consider a cover.',
        ]),
      }),
      Object.freeze({
        id: 'collection-and-assembly',
        heading: 'Collecting, assembling and ex-gym alternatives',
        paragraphs: Object.freeze([
          'Home cross trainers are usually 40 to 90kg and are awkward rather than desperately heavy. Many can be partly dismantled — uprights, handlebars and the console often come off — which is how they got into the house in the first place. Ask the seller whether they still have the manual and the assembly tools, because reassembling one without instructions is genuinely fiddly.',
          'Plan for two people and a measured route. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and the important detail is that every bolt is bagged and labelled if the machine comes apart, since missing fixings are the most common post-collection problem.',
          'Consider an ex-commercial elliptical if you have a garage or large room. Gym machines feel far better than home models, with long strides, heavy flywheels and proper bearings, and used prices can be very reasonable. The obstacles are weight of 150kg or more, a footprint around 2m long and the ceiling height they need, which rules them out of most upstairs rooms.',
          'Before you pay, ride the machine for several minutes and check the pivots, ramp, resistance and console. Only confirm handover once the machine is assembled in your house and working, since confirmation is what starts the Buyer Protection window on eligible purchases, and a cross trainer that creaks or has a missing adaptor is much easier to resolve before that point.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Stride length, ceiling height, creaking pivots and noise for neighbours — the questions that matter on a used home cross trainer.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'How much ceiling height do I need for a cross trainer?',
        answer:
          'Your own height plus roughly 20cm for the pedal position, plus a comfortable margin. Loft rooms, garages with beams, low light fittings and under-stairs spaces often fail this test, so measure to the lowest obstruction in the intended spot before you look at machines rather than afterwards.',
      }),
      Object.freeze({
        question: 'Why does stride length matter so much?',
        answer:
          'It decides whether the machine feels like walking or like pedalling a small circle. Budget home machines often have short strides that feel cramped for anyone of average height or above. If you are tall, it is the main reason to spend more, and it is the specification most often left out of listings.',
      }),
      Object.freeze({
        question: 'Are cross trainers quiet enough for a flat?',
        answer:
          'They are among the quietest options, because your feet never leave the pedals so there is no impact travelling into the floor. The noise they do make is mechanical — rollers, drive belt and creaking pivots — and a heavier machine near a supporting wall with a mat underneath is genuinely fine for evening use.',
      }),
      Object.freeze({
        question: 'What causes a used cross trainer to creak?',
        answer:
          'Dry or worn pivot bushings, and occasionally loose frame bolts. Lubricating the pivots to the manufacturer specification and checking the fixings resolves most cases. A creak that persists under load after both can mean worn bushings or a loose frame joint, which is worth investigating before you buy.',
      }),
      Object.freeze({
        question: 'How do I test a used machine before buying?',
        answer:
          'Ride it hard through the full resistance range, upright and leaning forward, and listen for creaks and knocks. Then check for play by moving the pedal arms and handlebars laterally, inspect the ramp and rollers on front-drive machines, and confirm the console and every resistance level work.',
      }),
      Object.freeze({
        question: 'Do home cross trainers need mains power?',
        answer:
          'Most do, for the console and powered resistance, and they often use a proprietary adaptor. A missing adaptor is a surprisingly common problem on used machines and can be awkward to replace, so confirm it is included and test the machine plugged in before agreeing to buy.',
      }),
      Object.freeze({
        question: 'Do cross trainers fold away?',
        answer:
          'Very few do, though most have transport wheels at one end so you can tilt and roll them a short distance. That means the space you choose is essentially permanent, so pick somewhere you will actually enjoy using it — facing a window or a television rather than a blank wall makes a real difference.',
      }),
      Object.freeze({
        question: 'Is front-drive or rear-drive better for home use?',
        answer:
          'Rear-drive machines usually give a flatter, more natural stride but are longer. Front-drive machines are more compact and often cheaper, with a ramp and roller arrangement that becomes the main wear point. Centre-drive designs are the shortest. Choose on how it feels and how much floor length you have.',
      }),
      Object.freeze({
        question: 'Should I consider an ex-gym elliptical for home?',
        answer:
          'If you have a garage or a large ground-floor room, yes — commercial machines feel far better with long strides, heavy flywheels and proper bearings, at reasonable used prices. The obstacles are weight of 150kg or more, a footprint around 2m long and demanding ceiling height, which rules them out upstairs.',
      }),
      Object.freeze({
        question: 'How difficult is it to move and reassemble one?',
        answer:
          'They are awkward rather than very heavy at 40 to 90kg, and uprights, handlebars and consoles often come off. Ask whether the seller still has the manual and tools, since reassembly is fiddly without them, and make sure every bolt is bagged and labelled — missing fixings are the most common problem after collection.',
      }),
    ]),
    midCtaHeading: 'Looking for a home cross trainer?',
    midCtaLead:
      'Compare used home ellipticals and cross trainers listed by private sellers, dealers and refurbishers across the UK.',
    midCtaLabel: 'Browse Home Cross Trainers',
    exploreLead:
      'Keep exploring home cardio and home strength categories, plus the Equipd guides to buying, selling and valuing equipment.',
    heroTrustItems: Object.freeze([
      'Low-impact and quiet',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'home-rowing-machines': Object.freeze({
    eyebrow: 'Stores upright, works everything',
    h1: 'Used Home Rowing Machines',
    lead: 'Find used home rowing machines — air, magnetic and water — from private sellers, dealers and refurbishers across the UK. Equipd is the marketplace: pay securely by card, get Buyer Protection on eligible purchases and value any model free before you buy.',
    metaTitle: 'Used Home Rowing Machines for Sale UK | Equipd',
    metaDescription:
      'Used home rowing machines from UK sellers — air, magnetic and water. Compare noise, storage and length, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used home rowing machines',
    searchLabel: 'Search home rowing machines',
    listingsHeading: 'Live home rowing machine listings',
    listingsLead:
      'Air, magnetic and water rowers listed on Equipd by private sellers, dealers and refurbishers across the UK, including folding and vertically stored models.',
    listingsCta: 'Browse all home rowing machines',
    categoryHeading: 'Other home cardio to consider',
    categoryLead:
      'Rowers give whole-body work in a footprint you can stand up in a corner. Bikes are smaller still and quieter, cross trainers suit sore joints, and treadmills add walking and running if the space allows.',
    brandLead:
      'Concept2, WaterRower, JTX, Domyos and Hydrow are the names most commonly found used in the UK. Resistance type matters most: air rowers are loud and comparable, magnetic rowers are quiet, and water rowers sound and look quite different.',
    benefitsHeading: 'Why buy a used home rowing machine on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'stores-upright',
        title: 'Stores in a corner, not a room',
        body: 'Most rowers separate or tilt to stand vertically, so a 2.4m machine becomes a footprint smaller than a bedside table between sessions. No other cardio machine disappears so completely.',
      }),
      Object.freeze({
        id: 'parts-and-longevity',
        title: 'Machines that genuinely last',
        body: 'Quality rowers are mechanically simple and extremely well supported for parts, so a ten-year-old machine with a fresh chain, rollers and shock cord performs exactly like a new one — which is why used rowers are such reliable buys.',
      }),
      Object.freeze({
        id: 'whole-body',
        title: 'Whole-body work, low impact',
        body: 'Rowing uses legs, back and arms with no impact through the joints, which makes it one of the most efficient home workouts and a good fit for anyone who cannot run comfortably.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment and protection',
        body: 'Pay through Equipd with funds held until you confirm handover, and Buyer Protection on eligible purchases — reassuring when buying a sought-after rower from a seller you have never met.',
      }),
    ]),
    valuationEyebrow: 'Rower stood in the hall?',
    valuationHeading: 'Value a home rowing machine free',
    valuationCopy:
      'Good rowers hold their value unusually well, so sellers often ask too little for a well-known machine and buyers often pay too much for a tired budget one. The free Equipd valuation shows a realistic UK range for the exact model by age and condition, which is the quickest way to price a sale or sense-check a listing.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find your rower model' }),
      Object.freeze({ label: 'Details', body: 'Add the age, monitor and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or buy with confidence', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home rowing machine buying guide',
    guideIntro:
      'A rowing machine is arguably the best value home cardio purchase there is. It works most of your body, it produces no impact, it stores upright in a corner, and the better machines are so well supported for parts that a decade-old example can be brought back to new condition for the price of a few consumables. The decisions worth thinking about are resistance type, which determines how loud the machine is and therefore whether it suits a flat, and length, because a rower needs more clear floor than people expect even though it stores away neatly. This guide covers air, magnetic and water resistance, monitors and data, what to check on a used machine, space and storage, noise and neighbours, maintenance you can do yourself, and how to collect one.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'resistance-types',
        heading: 'Air, magnetic and water resistance at home',
        paragraphs: Object.freeze([
          'Air rowers use a fan flywheel, so resistance rises with how hard you pull. That makes them the most responsive and the standard for anyone who wants comparable numbers and structured intervals. The drawback at home is noise: an air rower under a hard effort produces a substantial whooshing roar that carries through walls and floors.',
          'Magnetic rowers set resistance to a level and stay there, and they are dramatically quieter — quiet enough to row while someone sleeps in the next room. They feel smoother and less responsive than air, which some people prefer and others find lifeless, and they are the sensible default for flats and shared houses.',
          'Water rowers use paddles in a tank, producing a smooth catch and a pleasant swishing sound that many people find more tolerable than fan noise even though it is not silent. They also look far better in a living space, which is a genuine consideration for a machine you cannot hide. The tank needs occasional treatment and makes the machine heavier to move.',
          'Some machines combine air and magnetic resistance, giving quiet operation with more responsive feel. If you can try before buying, do — the difference between resistance types is the single biggest factor in whether you enjoy rowing at home, far more than console features or brand.',
        ]),
      }),
      Object.freeze({
        id: 'monitors',
        heading: 'Monitors, data and app connectivity',
        paragraphs: Object.freeze([
          'The monitor is what turns rowing from repetitive into engaging, because pace and split times give you something to chase. On the better machines, successive monitor generations added memory, heart-rate connectivity and data transfer, and some newer monitors can be fitted to older frames — which means an older machine can be modernised rather than replaced.',
          'Ask for the lifetime metre count if the monitor stores it. It is the honest measure of how much the machine has done, and on a home rower the numbers are usually modest. Frame and roller condition should broadly match whatever total you are shown.',
          'Check the monitor works properly rather than just lighting up. Take some strokes and confirm it registers stroke rate, split and distance, that all the buttons respond and that it retains settings. Most run on standard batteries with a top-up from rowing, so a dim or dead display is very often just old batteries.',
          'If you want to row in an app or an online rowing community, check compatibility for the specific monitor rather than assuming. Some machines connect readily to third-party software, others only to a manufacturer app, and a few subscription-based rowers lose much of their functionality without an active plan — establish that before you buy.',
        ]),
      }),
      Object.freeze({
        id: 'used-checks',
        heading: 'What to check on a used rower',
        paragraphs: Object.freeze([
          'Sit on the seat and slide it the full length of the rail, listening for grinding and feeling for bumps. Flat-spotted seat rollers and a scored or dented rail are the most common wear points and will irritate you every session. Rollers are inexpensive on good machines; a badly damaged rail is more of a problem.',
          'Pull the handle to full extension several times and watch that it returns smoothly and completely. A slow or incomplete return means a stretched shock cord or one that needs re-tensioning, which is a cheap and easy fix but makes the machine unusable until it is done — good negotiating material rather than a reason to walk away.',
          'Inspect the chain or belt. A dry, rusty or visibly stretched chain should be replaced, and on belt-drive machines look for fraying or glazing. While you are there, check the damper slides freely across its range on an air machine and that the footplates, straps and heel cups are intact and adjustable.',
          'Look into the flywheel housing if you can. Home air rowers pull in dust, hair and carpet fibre, and a clogged flywheel changes the feel and stresses the bearings. On water rowers, check the water is clear rather than green or cloudy, and ask when it was last treated. Finally, check the folding or separating mechanism operates and locks properly, since that is how the machine will be stored.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-storage',
        heading: 'Length in use, storage and where it lives',
        paragraphs: Object.freeze([
          'A full-size rower is around 2.4m long and 0.6m wide in use, and you want a bit more than that — clear space behind the flywheel and enough room at the seat end to get on and off. Realistically, allow close to 3m of clear floor length, which is more than many rooms offer without moving furniture.',
          'Storage is the compensation. Most machines either separate into two parts or tilt to stand vertically, taking the footprint down to well under half a square metre. Check the ceiling height for upright storage — a 2.4m machine stood on end needs headroom — and confirm the machine you are buying has whatever pins or catches the storage method needs.',
          'Folding machines that hinge in the middle are the most compact but add a mechanism to wear. Machines that separate into two pieces are simple and store flat under a bed or upright in a cupboard. Water rowers generally stand upright but must be drained first if you want to move them any distance.',
          'Think about the floor. Rowers do not need heavy matting, but a mat protects carpet and laminate from the feet and the flywheel housing, and stops the machine shifting on a smooth surface. It also makes the machine easier to slide back into position after storage.',
        ]),
      }),
      Object.freeze({
        id: 'noise',
        heading: 'Noise, neighbours and shared buildings',
        paragraphs: Object.freeze([
          'This is where the resistance decision really matters. An air rower at full effort is genuinely loud — the noise carries through walls and ceilings and is the most common reason people row less than they intended in a flat. If you live in a terraced house or an apartment, take that seriously before choosing air.',
          'Magnetic rowers are close to silent apart from the seat rolling on the rail, which makes them the right choice for early-morning or late-night rowing in a shared building. Water rowers sit in between: not quiet, but the sound is a smooth swish rather than a fan roar, and many people find it less intrusive.',
          'The other noise is the seat on the rail and the handle returning. Keeping the rail clean and the rollers in good condition keeps that to a soft rumble, and a mat under the machine reduces what transmits into a suspended floor.',
          'Rowing has one big advantage over running at home: there is no impact. Even a loud air rower does not thump the floor the way footfall on a treadmill does, so the complaint you might get is airborne noise rather than structural, and closing a door solves more of it than you would expect.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance you can do in ten minutes',
        paragraphs: Object.freeze([
          'Rowers are the easiest home cardio to maintain. Oil the chain at the interval the manual specifies, wipe the rail after use, and keep the seat rollers clean. That is genuinely most of it, and it is why well-cared-for rowers last decades.',
          'Clear dust from the flywheel housing on air machines occasionally. In a carpeted room it accumulates faster than you expect, and removing it restores the feel and keeps the bearings happier. The covers usually come off with a screwdriver and the job takes a few minutes.',
          'Keep the shock cord tension right. If the handle starts returning slowly, the manual will explain the adjustment, and cords are inexpensive to replace when adjustment runs out. Doing it promptly keeps the stroke feeling correct.',
          'On water rowers, follow the manufacturer schedule for tank treatment to keep the water clear. It is a small task a couple of times a year, and neglecting it is why some second-hand water rowers arrive with unpleasant-looking tanks that need draining and refilling.',
        ]),
      }),
      Object.freeze({
        id: 'collection-and-choosing',
        heading: 'Choosing a machine and collecting it',
        paragraphs: Object.freeze([
          'Buy on resistance type and build rather than console features. A well-made machine with a basic monitor will be used for years; a feature-heavy budget rower with a rough seat action and a light frame will not. If you are unsure, the machines with the strongest parts support are the safest used purchases because anything that wears can be renewed.',
          'Be careful with subscription-based rowers. Some connected machines are built around a monthly plan and lose a great deal of functionality without it, which can make an apparent bargain much less useful than it looks. Establish exactly what works without a subscription before you commit.',
          'Collection is the easiest of any cardio machine. Most rowers weigh 25 to 40kg and separate into two pieces, so one or two people can manage stairs and standard doorways without difficulty. Water rowers should be drained before moving. Fulfilment on Equipd is arranged directly between buyer and seller, so agree collection or delivery in advance.',
          'Before you pay, row the machine for a couple of minutes: check the monitor registers, the seat runs smoothly, the handle returns fully and the damper or resistance adjusts. Then only confirm handover once the machine is in your home and you have used it, since confirmation is what starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Choosing between air, magnetic and water resistance, storage and length, noise in flats, and what to check on a used rower.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Which resistance type is best for rowing at home?',
        answer:
          'Magnetic is the sensible default for flats and shared houses because it is nearly silent. Air is the most responsive and best for structured intervals and comparable numbers, but it is genuinely loud. Water rowers sit in between on noise and look far better in a living space. Resistance type matters more than brand or console.',
      }),
      Object.freeze({
        question: 'How much floor length does a rower need at home?',
        answer:
          'Around 2.4m long and 0.6m wide in use, and realistically close to 3m of clear floor length once you allow space behind the flywheel and at the seat end. Storage is the compensation: most machines separate or tilt upright to well under half a square metre, so check ceiling height for upright storage.',
      }),
      Object.freeze({
        question: 'Are air rowers too loud for a flat?',
        answer:
          'They can be. An air rower at full effort produces a substantial fan roar that carries through walls and ceilings, and it is a common reason people row less than intended in an apartment. There is no floor impact as there is with a treadmill, but if airborne noise is a concern, choose magnetic.',
      }),
      Object.freeze({
        question: 'Why does the handle return slowly on a used rower?',
        answer:
          'The shock cord has stretched or needs re-tensioning. It is an inexpensive, straightforward fix documented in the manual, but it makes the machine unusable until it is done, so treat it as negotiating material on an otherwise good machine rather than a reason to reject it.',
      }),
      Object.freeze({
        question: 'Is a high lifetime metre count a problem?',
        answer:
          'Rarely on a quality machine, because almost everything that wears is a cheap available part. A rower with a large total but new rollers, chain and shock cord performs like new. Judge the seat rail, roller and chain condition alongside the number rather than treating metres as a verdict on their own.',
      }),
      Object.freeze({
        question: 'Do rowing machines fold up?',
        answer:
          'Most either hinge in the middle or separate into two pieces, and many then stand vertically. Folding machines are the most compact but add a mechanism that can wear; separating machines are simpler and store flat or upright in a cupboard. Water rowers usually stand upright but should be drained to move far.',
      }),
      Object.freeze({
        question: 'What should I check on the seat and rail?',
        answer:
          'Slide the seat the whole length of the rail listening for grinding and feeling for bumps, and look for scoring or dents in the rail. Flat-spotted rollers are the most common wear point and are cheap to replace on good machines, whereas a badly damaged rail is a more significant problem.',
      }),
      Object.freeze({
        question: 'Do I need a subscription for a used connected rower?',
        answer:
          'On some machines, yes. Certain connected rowers are built around a monthly plan and lose much of their functionality without one, which makes an apparent bargain less useful than it appears. Establish exactly what works without an active subscription before committing to buy.',
      }),
      Object.freeze({
        question: 'How much maintenance does a home rower need?',
        answer:
          'Very little. Oil the chain at the interval the manual specifies, wipe the rail and keep the seat rollers clean, and clear dust from the flywheel housing on air machines occasionally. Water rowers need periodic tank treatment. That is genuinely most of it, which is why good rowers last decades.',
      }),
      Object.freeze({
        question: 'How easy is a rower to collect?',
        answer:
          'The easiest of any cardio machine. Most weigh 25 to 40kg and separate into two parts, so one or two people can manage stairs and standard doorways. Drain a water rower before moving it. Fulfilment is arranged between buyer and seller on Equipd, so agree collection or delivery in advance.',
      }),
    ]),
    midCtaHeading: 'Ready to find a rowing machine?',
    midCtaLead:
      'Compare used air, magnetic and water rowers listed by private sellers, dealers and refurbishers across the UK.',
    midCtaLabel: 'Browse Home Rowing Machines',
    exploreLead:
      'Continue through home cardio and home strength categories, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'Stores upright at home',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'home-multi-gyms': Object.freeze({
    eyebrow: 'A whole gym in one corner',
    h1: 'Used Home Multi-Gyms',
    lead: 'Browse used home multi-gyms and all-in-one strength stations from private sellers, dealers and refurbishers across the UK. Equipd hosts the marketplace, with secure card payments, Buyer Protection on eligible purchases and a free Instant Valuation on any model.',
    metaTitle: 'Used Home Multi-Gyms for Sale UK | Equipd',
    metaDescription:
      'Used home multi-gyms and all-in-one strength stations from UK sellers. Check cables and stacks, then buy securely with Buyer Protection on eligible orders.',
    schemaAbout: 'Used home multi-gyms',
    searchLabel: 'Search home multi-gyms',
    listingsHeading: 'Live home multi-gym listings',
    listingsLead:
      'Single and dual stack multi-gyms, cable stations and all-in-one home strength machines listed on Equipd by sellers across the UK.',
    listingsCta: 'Browse all home multi-gyms',
    categoryHeading: 'Other home strength to consider',
    categoryLead:
      'A multi-gym is one route to home strength. Dumbbells and a bench are cheaper and more flexible, and a power rack suits anyone who wants to squat and press with a barbell.',
    brandLead:
      'Body-Solid, Powertec, Marcy, BH Fitness, Inspire, Force USA and TuffStuff are the names most often found used in the UK. The difference between a light home unit and a light-commercial one shows in cable quality, pulley bearings and how the frame feels under load.',
    benefitsHeading: 'Why buy a used home multi-gym on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'no-loose-weights',
        title: 'No loose plates, no dropped weights',
        body: 'A pin-selected stack means no plates on the floor, nothing to drop and nothing to disturb the room below — which makes a multi-gym one of the few strength options that works in an upstairs room or a flat.',
      }),
      Object.freeze({
        id: 'assembly-avoided',
        title: 'Skip the flat-pack build',
        body: 'A new multi-gym is a long assembly job from a box of hundreds of parts. Buying used often means collecting a machine already built, or at least one whose previous owner has proved that all the parts are there.',
      }),
      Object.freeze({
        id: 'value',
        title: 'A large saving on a bulky item',
        body: 'Multi-gyms are expensive to ship and awkward to store, so sellers price them to move. That makes them one of the biggest discounts against new price anywhere in home fitness equipment.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Buyer Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with a protection window afterwards on eligible purchases — useful on a machine where cable condition and missing parts are the main risks.',
      }),
    ]),
    valuationEyebrow: 'Multi-gym taking up the garage?',
    valuationHeading: 'Value a home multi-gym free',
    valuationCopy:
      'Multi-gyms are among the hardest home equipment to price, because size and awkwardness push values down while a good light-commercial machine can still be worth real money. The free Equipd valuation gives you a UK market range for the specific model by age and condition, so you can list yours sensibly or judge whether a cheap listing is genuinely a bargain.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find your multi-gym model' }),
      Object.freeze({ label: 'Details', body: 'Add stack weight, age and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home multi-gym buying guide',
    guideIntro:
      'A multi-gym gives you most of a gym\'s strength exercises in a single frame with no loose weights, which makes it one of the most practical ways to train at home — particularly upstairs or in a flat where dropping a dumbbell is not an option. It is also the home equipment most likely to disappoint, for two reasons: light machines with plastic pulleys and thin cables feel unpleasant and wear quickly, and buyers routinely underestimate both the footprint and the space you need around it. Add the fact that a used multi-gym must be dismantled to leave one house and rebuilt in another, and you have a purchase that rewards preparation. This guide covers types and specification, cables and pulleys, faults and missing parts, space and ceiling height, noise, maintenance, brands, and how to dismantle, move and rebuild one.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'types',
        heading: 'Types of multi-gym and what they include',
        paragraphs: Object.freeze([
          'Single-stack multi-gyms use one weight stack shared between stations — typically a lat pulldown, chest press, leg extension and low pulley. They are the most compact and the cheapest, and for one person training alone they are perfectly adequate. Changing between stations sometimes means rethreading a cable or moving a bar, which is worth checking.',
          'Dual-stack machines have separate stacks, usually one driving pressing and pulling and another for a pec deck or leg station. They cost more, take more space and allow two people to train at once, and they generally feel better because each stack is doing less work through fewer pulleys.',
          'Cable-based home stations, effectively domestic versions of a functional trainer, use adjustable pulleys instead of fixed stations. They are more versatile and better suited to varied training, but they need more ceiling height and they need you to know what exercises you want to do, since there is less guidance built in.',
          'Then there are the hybrids: multi-gyms with an integrated Smith machine, a bench press station or a squat rack. These pack a lot in, but the compromises show — the bench angle is rarely ideal and the press station is usually limited. If barbell training is your priority, a rack and a bench will serve you better than a hybrid.',
        ]),
      }),
      Object.freeze({
        id: 'specification',
        heading: 'Stack weight, cable ratios and build quality',
        paragraphs: Object.freeze([
          'Check what the stack actually delivers rather than the number on the shroud. Home multi-gyms often use pulley arrangements that halve the effective resistance at the handle, so a 100kg stack might give around 50kg on a press. That is fine — but it means a 60kg stack machine may be too light for you sooner than you expect.',
          'Look at the increments as well as the maximum. Coarse steps of 10kg or more are frustrating for upper-body work, while machines with 5kg plates and an add-on weight are much more usable for steady progression. Also confirm the top stack weight is enough for your leg station, which is where home multi-gyms run out first.',
          'Judge build quality through the components you can see. Steel pulleys with sealed bearings, thick nylon-coated cable and a heavy frame indicate a light-commercial machine that will last; small plastic pulleys, thin cable and a frame that flexes when you press hard indicate a budget unit. On a used machine, the second type will already be showing its age.',
          'Check the pads and adjustment. Seat height adjustment, a back pad that supports you properly and thigh pads that actually hold you down for pulldowns all determine whether the machine is comfortable to use. A multi-gym you cannot set up for your body is a multi-gym you will stop using.',
        ]),
      }),
      Object.freeze({
        id: 'cables-and-faults',
        heading: 'Cables, pulleys and the parts that go missing',
        paragraphs: Object.freeze([
          'Cables are the main wear item and the main risk. Run your hands along every accessible length feeling for broken strands, split coating, kinks and rust, and look closely at the crimped ends where failures start. Any fraying means the cable needs replacing before the machine is used, and on some home brands replacement cables are difficult to source.',
          'Check the pulleys individually. Spin each one, listen for roughness and look into the groove for wear. Plastic pulleys on budget machines crack and develop flat spots, and a worn groove will chew through a new cable, so cables and bad pulleys need addressing together.',
          'Watch the stack travel. Select a mid-range weight and work each station, checking the plates rise and fall smoothly and squarely. Notchy travel usually means dry guide rods or worn plate liners, and both are serviceable. Plates that rock as they travel suggest worn liners or a slightly bent rod.',
          'Then count the small parts, because this is where used multi-gyms most often disappoint. The selector pin, seat pins, lat bar, low row handle, ankle strap, foam rollers and any bench pad are all easy to lose during a move, and some are proprietary. Confirm exactly what is included in Equipd messages, and ask specifically whether the manual and assembly hardware still exist.',
        ]),
      }),
      Object.freeze({
        id: 'space',
        heading: 'Footprint, ceiling height and access space',
        paragraphs: Object.freeze([
          'Home multi-gyms commonly occupy something like 1.5 to 2.1m by 1.2m, but the usable requirement is considerably larger. You need room to sit at each station, space to pull a lat bar down without hitting a wall, and clearance behind for a low row or a leg station. Allow a metre of free space around the working sides.',
          'Ceiling height is the constraint that catches people out. Most multi-gyms stand around 2.1m tall, and a high pulley needs the cable and housing above that, so garages with low beams, loft rooms and rooms with pendant lights often will not take one. Measure to the lowest obstruction in the intended position before you buy.',
          'Think about the floor as well. A loaded multi-gym is a heavy, concentrated load — frame plus stack can easily exceed 150kg — so on a suspended upstairs floor it is worth positioning near a supporting wall rather than mid-span. On concrete it makes no difference beyond protecting the surface.',
          'Be realistic about permanence. Once built, a multi-gym is not moved without dismantling, so the space you choose is the space it lives in. Garages are the most common home, which brings damp and cold into the equation — a machine with cables and a steel stack in an unheated garage will corrode faster than one indoors.',
        ]),
      }),
      Object.freeze({
        id: 'noise-and-neighbours',
        heading: 'Noise, neighbours and why multi-gyms suit flats',
        paragraphs: Object.freeze([
          'A multi-gym is one of the quietest ways to strength train at home. There are no plates to drop, no barbell to rack and no impact, so the only noise is the stack settling at the end of a set and the pulleys running. For an upstairs room or a flat that is a decisive advantage over free weights.',
          'The noise that does travel is the clunk of the stack landing if you let the weight drop at the end of a repetition. Controlling the last few centimetres of the movement removes almost all of it, and a rubber mat under the stack tower absorbs the rest.',
          'A mat under the whole machine is worth having anyway. It protects the floor from the frame feet, stops the machine marking carpet or laminate, and reduces the low-frequency transmission of the stack into a suspended floor. It also makes the area easier to keep clean.',
          'Compared with the alternatives, this is the main argument for a multi-gym over a rack and barbell in a shared building. If you cannot drop weights and cannot risk noise complaints, a pin-loaded machine solves the problem in a way free weights genuinely cannot.',
        ]),
      }),
      Object.freeze({
        id: 'maintenance',
        heading: 'Maintenance and getting a long life from it',
        paragraphs: Object.freeze([
          'Inspect the cables every couple of months along their accessible length and at the crimped ends. This is the one maintenance task that matters, because a cable failure under load is both a broken machine and a safety issue. Catching fraying early means a planned replacement rather than an accident.',
          'Keep the guide rods clean and lightly lubricated to the manufacturer specification so the stack runs smoothly, and wipe the frame down after use. Sweat on a home multi-gym collects around the seat and the stack tower, and that is where corrosion starts.',
          'Check fixings periodically. Multi-gyms are bolted together rather than welded, and bolts loosen with use, producing flex and rattles that feel like a failing machine but are usually just a spanner job. Go round the frame with the supplied tools every few months.',
          'If the machine lives in a garage, take damp seriously. A cover, some ventilation and keeping the machine off a wet floor all extend its life considerably. Cables and steel stacks in an unheated, damp garage are the most common reason a home multi-gym becomes unusable long before the frame gives up.',
        ]),
      }),
      Object.freeze({
        id: 'moving-and-rebuilding',
        heading: 'Dismantling, transport and rebuilding',
        paragraphs: Object.freeze([
          'Understand before you buy that a multi-gym must come apart to leave the seller\'s house and be rebuilt in yours. This is the single biggest practical factor in the purchase, and it is why these machines are cheap used. Ask how the seller intends to dismantle it and whether they have the manual, because rebuilding without instructions is genuinely difficult.',
          'Photograph the machine assembled from several angles before it comes apart, and photograph the cable routing in particular. Cable paths are the hard part of any rebuild, and a set of photographs taken at the seller\'s house is worth more than any generic guide you will find later.',
          'Insist that every bolt, pin and washer is bagged and labelled by area, and count the weight plates and small parts against the agreed list. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and the plates alone often make up most of the weight, so plan a suitable vehicle and enough hands.',
          'Allow real time for the rebuild. A multi-gym takes hours rather than minutes to assemble properly, and it is much easier with two people. Build the frame square, route the cables carefully with reference to your photographs, and check every station under a light load before you use it properly.',
          'Only confirm handover once the machine is rebuilt and working. Confirmation is what starts the Buyer Protection window on eligible purchases, and since missing parts are the most common problem with used multi-gyms, it is worth completing the rebuild before that point wherever practical.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Stack weights, cable condition, ceiling height, noise and the rebuild — what to know before buying a used home multi-gym.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'What weight stack do I need on a home multi-gym?',
        answer:
          'More than the number suggests, because many home machines halve the effective resistance at the handle through their pulley arrangement. A 60kg stack can feel like 30kg on a press, so check the ratio and think about where you will be in a year rather than only what feels heavy today.',
      }),
      Object.freeze({
        question: 'How much ceiling height does a multi-gym need?',
        answer:
          'Most stand around 2.1m tall and the high pulley needs the cable and housing above that. Garages with low beams, loft rooms and rooms with pendant light fittings often will not take one, so measure to the lowest obstruction in the intended position before you start looking at machines.',
      }),
      Object.freeze({
        question: 'Are multi-gyms suitable for a flat or upstairs room?',
        answer:
          'They are one of the best options, because there are no plates to drop and no impact. The only noise is the stack landing at the end of a repetition, which controlling the movement and a rubber mat under the tower largely eliminate. That is the main argument for a multi-gym over free weights in a shared building.',
      }),
      Object.freeze({
        question: 'What should I check on the cables?',
        answer:
          'Run your hands along every accessible length feeling for broken strands, split coating, kinks and rust, and look closely at the crimped ends. Also check the pulleys for cracks, flat spots and worn grooves, since a worn groove will destroy a new cable. Replacement cables can be hard to source for some home brands.',
      }),
      Object.freeze({
        question: 'What parts commonly go missing on used multi-gyms?',
        answer:
          'Selector and seat pins, the lat bar, low row handle, ankle strap, foam rollers and bench pads, plus assembly hardware and the manual. Several are proprietary and awkward to replace, so confirm exactly what is included in Equipd messages and ask specifically about the manual before agreeing a price.',
      }),
      Object.freeze({
        question: 'How much space does a multi-gym need in total?',
        answer:
          'The frame is commonly 1.5 to 2.1m by 1.2m, but allow roughly a metre of free space around the working sides so you can sit at each station, pull a lat bar down and use a low row without hitting a wall. Once built it will not be moved without dismantling, so choose the position carefully.',
      }),
      Object.freeze({
        question: 'Is a single or dual stack machine better?',
        answer:
          'A single stack is more compact and cheaper and is fine for one person, though changing stations sometimes means rethreading a cable. Dual stacks cost more and take more space but let two people train at once and generally feel better, since each stack works through fewer pulleys.',
      }),
      Object.freeze({
        question: 'Can I put a multi-gym in an unheated garage?',
        answer:
          'You can, and many people do, but damp is the enemy. Cables and steel stacks corrode in cold, humid garages, which is the most common reason a home multi-gym becomes unusable long before the frame fails. A cover, some ventilation and keeping the machine off a wet floor all help considerably.',
      }),
      Object.freeze({
        question: 'How hard is it to dismantle and rebuild one?',
        answer:
          'It is the main practical challenge and the reason they are cheap used. Photograph the assembled machine and especially the cable routing before it comes apart, bag and label every bolt, and allow hours rather than minutes for the rebuild with two people. Without the manual it is genuinely difficult.',
      }),
      Object.freeze({
        question: 'Should I buy a multi-gym or dumbbells and a bench?',
        answer:
          'A multi-gym suits flats and upstairs rooms where dropping weights is impossible, and it guides you through exercises. Dumbbells and a bench are cheaper, more flexible and far easier to move, but they need more technique and a floor that can take them. Choose based on your building as much as your training.',
      }),
    ]),
    midCtaHeading: 'Looking for a home multi-gym?',
    midCtaLead:
      'Compare used multi-gyms, cable stations and all-in-one strength machines listed by sellers across the UK.',
    midCtaLabel: 'Browse Home Multi-Gyms',
    exploreLead:
      'Keep exploring home strength and home cardio categories, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'No loose weights to drop',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'home-dumbbells': Object.freeze({
    eyebrow: 'The most used kit you will ever buy',
    h1: 'Used Home Dumbbells',
    lead: 'Find used dumbbells for home training — fixed, adjustable and selectorised — from sellers across the UK on Equipd. Secure card payment, Buyer Protection on eligible purchases and a free Instant Valuation so you know what a set is worth.',
    metaTitle: 'Used Dumbbells for Home Gyms UK | Equipd',
    metaDescription:
      'Used home dumbbells from UK sellers — fixed hex, spinlock and adjustable sets. Compare weight ranges and storage, then buy securely with Buyer Protection.',
    schemaAbout: 'Used home dumbbells',
    searchLabel: 'Search home dumbbells',
    listingsHeading: 'Live home dumbbell listings',
    listingsLead:
      'Fixed rubber hex, spinlock, selectorised and adjustable dumbbells listed on Equipd by sellers across the UK, from single pairs to complete sets with racks.',
    listingsCta: 'Browse all home dumbbells',
    categoryHeading: 'Other home strength to consider',
    categoryLead:
      'Dumbbells work best with something to lie on and something to store them in. Look at home benches, power racks and multi-gyms to build out the rest of a home setup.',
    brandLead:
      'Bowflex, PowerBlock, NÜOBELL, Mirafit, Bodymax, York and Domyos all appear regularly on the UK used market. Fixed dumbbells last indefinitely, while adjustable designs vary a lot in how well their mechanisms survive years of use.',
    benefitsHeading: 'Why buy used dumbbells on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'weight-doesnt-wear',
        title: 'Iron does not wear out',
        body: 'A 12kg dumbbell weighs 12kg regardless of age. Beyond scuffed paint and the occasional loose head, used dumbbells are functionally identical to new ones — which makes them the most sensible second-hand purchase in home fitness.',
      }),
      Object.freeze({
        id: 'expensive-new',
        title: 'Avoid paying new prices for metal',
        body: 'Dumbbells are heavy and expensive to ship, so new prices carry a lot of freight cost. Buying locally used cuts that out entirely, and complete sets often sell for a fraction of retail because owners need the space.',
      }),
      Object.freeze({
        id: 'flexible',
        title: 'The most versatile home equipment',
        body: 'One pair of dumbbells and a bench covers most of the strength training anyone needs at home, in less space than a bicycle and with no assembly, no power and no console to become obsolete.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment and protection',
        body: 'Pay through Equipd with funds held until you confirm handover and Buyer Protection on eligible purchases, rather than sending money for weights you have not counted or lifted.',
      }),
    ]),
    valuationEyebrow: 'Dumbbells under the bed?',
    valuationHeading: 'Value dumbbells before you sell them cheap',
    valuationCopy:
      'Dumbbells hold their value better than almost anything else in home fitness, and sets are routinely sold for far less than they are worth simply because the owner wants the space back. Use the free Equipd valuation to see a realistic UK range for the set and condition before you list, or to check that a bargain listing really is one.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the dumbbell type or set' }),
      Object.freeze({ label: 'Details', body: 'Add weight range, rack and condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'List them or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home dumbbell buying guide',
    guideIntro:
      'Dumbbells are the best value equipment in any home gym and the easiest thing to buy second-hand, because weight does not depreciate through use. A twenty-year-old pair of cast iron dumbbells does exactly what a new pair does. The real decisions are about format — fixed pairs, spinlock bars or one of the modern adjustable systems — and about the practical realities of having heavy iron in a house: what happens when someone drops one on a laminate floor, where it all lives when not in use, and how much noise travels to a neighbour below. This guide covers formats and weight ranges, what to check on used dumbbells, floors and noise, storage, adjustable mechanisms, brands, and the arithmetic of buying weight sensibly.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'formats',
        heading: 'Fixed, spinlock or adjustable',
        paragraphs: Object.freeze([
          'Fixed dumbbells — usually rubber-coated hex or cast iron — are the simplest and most durable option. You pick one up and train, with nothing to adjust and nothing to break. The drawback is that covering a useful range takes several pairs, which costs more and takes considerably more storage space than any other format.',
          'Spinlock dumbbells use a bar with a threaded collar and loose plates. They are the cheapest way to own a wide weight range and are extremely common second-hand, but changing weight takes time and the collars have a habit of working loose during a set, which becomes irritating quickly and can be genuinely dangerous overhead.',
          'Selectorised adjustable dumbbells use a dial or pin to select weight from a cradle, replacing a whole rack of fixed pairs with one pair and a base. For home use they are transformative on space, and they are what most people should buy if the budget stretches. They are more complex, they do not enjoy being dropped, and a damaged mechanism is much harder to repair than a bent spinlock bar.',
          'Block-style adjustable dumbbells use a pin through a nested stack and are the most robust of the adjustable designs, tolerating rougher handling than dial systems. Their shape takes some getting used to, particularly for exercises where the dumbbell sits against your body, so try before committing if you can.',
        ]),
      }),
      Object.freeze({
        id: 'weight-range',
        heading: 'Choosing a weight range that lasts',
        paragraphs: Object.freeze([
          'Buy for where you will be in a year, not where you are now. The most common mistake in home dumbbells is a light set that gets outgrown within months, and the second most common is a heavy pair with nothing in between. Progression needs a usable ladder of weights, not just a top end.',
          'For most people starting out, a range that covers roughly 5kg to 20kg or 25kg per hand handles the majority of home training — presses, rows, curls, lunges and carries. Stronger lifters will want to go beyond that, but the heaviest pairs are also the least used and most expensive, so weigh the cost against how often they will come off the rack.',
          'Increments matter more than most buyers expect, particularly for pressing. Jumping from 10kg to 15kg is a very large step for a shoulder press, so a set with 2.5kg increments in the middle range is far more useful than a wider spread with big gaps. Adjustable systems generally handle this best.',
          'When looking at a used set, count the pairs and check whether the range is continuous. Sets frequently arrive missing exactly the weights you would use most, because those are the ones that went astray or were sold separately. Confirm the inventory in Equipd messages before agreeing a price.',
        ]),
      }),
      Object.freeze({
        id: 'checks',
        heading: 'What to check on used dumbbells',
        paragraphs: Object.freeze([
          'On fixed dumbbells, grip each handle and try to twist both heads. A head that moves will get worse and often cannot be repaired properly, and it is the only fault that genuinely writes off a fixed dumbbell. It takes seconds per unit to check, so check them all.',
          'Look at the rubber or urethane for splits, chunks missing and separation from the handle, and at cast iron for flaking paint and rust — which is cosmetic but will mark hands and floors. Feel the knurling on the handles too, since smooth worn knurling makes heavier dumbbells noticeably harder to hold.',
          'On spinlock sets, check the threads on both the bars and the collars, since cross-threaded collars are extremely common and make the set frustrating to use. Count the plates against the claimed total, and check for bent bars by rolling them on a flat surface.',
          'On adjustable dumbbells, work the mechanism through every weight setting several times and confirm the plates lock positively each time. Rattling, a setting that will not engage, or plates that stay behind in the cradle all indicate a worn or damaged mechanism. Also check the cradle or base is included and undamaged, since it is essential and rarely sold separately.',
        ]),
      }),
      Object.freeze({
        id: 'floors-and-noise',
        heading: 'Floors, dropped weights and neighbours',
        paragraphs: Object.freeze([
          'Dumbbells are the main threat to a domestic floor. A 20kg dumbbell dropped onto laminate or tile will damage it, and dropped onto a suspended timber floor it produces an impact that travels through the whole building. If you are training upstairs or above a neighbour, this is the constraint to plan around.',
          'Rubber matting is the answer and it is not expensive. Interlocking rubber tiles or a heavy gym mat under the training area protects the floor, cuts noise transmission substantially and stops dumbbells rolling. It is worth buying at the same time as the weights rather than after the first accident.',
          'Rubber-coated or urethane dumbbells are considerably kinder to floors and quieter than bare cast iron, which is worth paying a little more for in a domestic setting. They also do not mark walls and skirting boards when set down carelessly.',
          'Train with the neighbours in mind if you share a building. Setting dumbbells down under control rather than dropping them, keeping heavy work away from late evening, and putting the training area near a supporting wall rather than the middle of a floor span all reduce what other people hear. Most complaints come from dropped weights, not from training itself.',
        ]),
      }),
      Object.freeze({
        id: 'storage',
        heading: 'Storage and how much space weights really take',
        paragraphs: Object.freeze([
          'Storage is the hidden cost of fixed dumbbells. A range of five or six pairs needs a rack or tree, which occupies real floor space and needs to be near where you train. Dumbbells left on the floor get kicked, scratch skirting boards and are a genuine trip hazard in a shared room.',
          'A rack does not have to be large or expensive, but it does have to suit the dumbbells. Saddle spacing and tray depth vary, and a set of large-diameter hex dumbbells will not sit properly on a rack designed for smaller ones. Buying the rack with the set is usually the simplest route.',
          'This is where adjustable dumbbells earn their price. A pair covering 2kg to 32kg per hand replaces an entire rack in the space of two shoeboxes, which in a bedroom or a small flat is often the difference between having useful weights and not. The base still needs a home, but it is a fraction of the space.',
          'Think about weight distribution if the weights live upstairs. A full set of fixed dumbbells and a rack can add up to a few hundred kilograms in one corner of a bedroom, which is worth thinking about in an older property, and it is a strong practical argument for adjustable dumbbells over a full rack of fixed pairs.',
        ]),
      }),
      Object.freeze({
        id: 'brands-and-adjustables',
        heading: 'Brands, adjustable mechanisms and what lasts',
        paragraphs: Object.freeze([
          'On fixed dumbbells, brand matters far less than construction. What you are looking for is a head firmly bonded and mechanically fixed to the handle, decent knurling and a coating that has not started to split. Unbranded rubber hex dumbbells from a reputable retailer are often perfectly good buys used.',
          'Among adjustable systems, dial-based designs are compact and quick to change but least tolerant of being dropped, and a damaged selector is expensive or impossible to repair. Pin-based block designs are more robust and generally survive family use better. Older spinlock sets are the most repairable of all — a new bar or collar costs very little.',
          'Check parts availability if you are buying a used adjustable set, particularly for the cradle, selector dial and any plastic components. These are the parts that fail, and a system whose spares are no longer sold is a set you cannot fix. Well-known brands are a safer bet for exactly this reason.',
          'Bear in mind that adjustable dumbbells are physically larger than fixed dumbbells of the same weight, which can be awkward for exercises where the dumbbell sits close to your body or where you need to press from a tight position. It is not a flaw, but it is worth trying before you commit to a set.',
        ]),
      }),
      Object.freeze({
        id: 'buying-and-collecting',
        heading: 'Buying sensibly and collecting weight',
        paragraphs: Object.freeze([
          'Work out a price per kilogram as a sanity check, then adjust for format and condition. It is a crude measure and it does not capture the value of an adjustable mechanism or a rack, but it quickly identifies the listings that are optimistic. Use the free valuation alongside it for the specific set.',
          'Consider ex-commercial dumbbells if you have space and a suitable floor. Gym dumbbells are better made than most home equivalents and are often available in complete racked sets, and a partial set from a gym clearance can be a very economical way to build a range. The weight involved is the only real obstacle.',
          'Plan the collection properly, because weight is deceptive. A modest set is a couple of hundred kilograms and cannot be carried in one trip or in an ordinary shopping bag. Take a suitable vehicle, boxes or crates that will not fail, and expect to make several journeys from car to house. Fulfilment on Equipd is arranged between buyer and seller.',
          'Count and check as you load. Confirm every pair against the agreed list, twist each head, work an adjustable mechanism through its range, and make sure the rack, cradle, collars and any pins are included. Then only confirm handover once everything is counted and in your house, since confirmation is what starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Fixed against adjustable, weight ranges, protecting floors and keeping neighbours happy — what matters when buying used dumbbells for home.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Are adjustable dumbbells worth buying used?',
        answer:
          'They can be excellent value, but check the mechanism carefully. Work it through every weight setting several times confirming the plates lock positively, and make sure the cradle or base is included and undamaged. Dial-based systems are least tolerant of being dropped, and a damaged selector is expensive or impossible to repair.',
      }),
      Object.freeze({
        question: 'What weight range should I buy for home training?',
        answer:
          'For most people starting out, roughly 5kg to 20kg or 25kg per hand covers presses, rows, curls, lunges and carries. Buy for where you will be in a year rather than today, and prioritise a continuous ladder with 2.5kg steps in the middle over a wide spread with large gaps.',
      }),
      Object.freeze({
        question: 'Will dumbbells damage my floor?',
        answer:
          'Bare iron dropped on laminate, tile or vinyl certainly will, and the impact also travels through a suspended timber floor to whoever is below. Rubber matting under the training area is inexpensive and solves both problems, and rubber-coated or urethane dumbbells are much kinder to floors than bare cast iron.',
      }),
      Object.freeze({
        question: 'Can I train with dumbbells in an upstairs flat?',
        answer:
          'Yes, with sensible precautions. Use rubber matting, set weights down under control rather than dropping them, position the training area near a supporting wall rather than mid-span, and avoid heavy work late in the evening. Most noise complaints come from dropped weights rather than from the training itself.',
      }),
      Object.freeze({
        question: 'What is the main fault to check on used fixed dumbbells?',
        answer:
          'Loose or spinning heads. Grip each handle and try to twist both heads — any movement will get worse and often cannot be properly repaired, which is the only fault that genuinely writes off a fixed dumbbell. It takes seconds per unit, so check every one rather than sampling.',
      }),
      Object.freeze({
        question: 'Are spinlock dumbbells a good buy second-hand?',
        answer:
          'They are the cheapest way to own a wide range and are very common used, but the collars work loose during sets which is irritating and can be dangerous overhead. Check the threads on both bars and collars for cross-threading, count the plates against the claimed total, and roll the bars to check they are straight.',
      }),
      Object.freeze({
        question: 'How much space does a set of dumbbells need?',
        answer:
          'More than people expect. A range of five or six fixed pairs needs a rack or tree occupying real floor space near where you train. This is where adjustable dumbbells earn their price, since a single pair covering a wide range replaces an entire rack in about the space of two shoeboxes.',
      }),
      Object.freeze({
        question: 'Do I need to buy a rack with the dumbbells?',
        answer:
          'Strongly advisable for fixed sets, since dumbbells left on the floor get kicked, scratch skirting boards and are a trip hazard. Racks are not universal — saddle spacing and tray depth vary — so buying the rack with the set avoids ending up with weights that will not sit on it properly.',
      }),
      Object.freeze({
        question: 'Are ex-gym dumbbells suitable for home use?',
        answer:
          'Often yes. Commercial dumbbells are better made than most home equivalents and partial sets from gym clearances can be very economical. The considerations are the sheer weight involved, whether your floor and storage can take it, and whether a full commercial rack will fit the space you have.',
      }),
      Object.freeze({
        question: 'How do I collect a set of dumbbells safely?',
        answer:
          'Take a suitable vehicle and sturdy crates rather than bags, and expect several trips from car to house — even a modest set is a couple of hundred kilograms. Count every pair against the agreed list as you load, check for loose heads, and confirm the rack, collars and pins are included before confirming handover.',
      }),
    ]),
    midCtaHeading: 'Need dumbbells for home?',
    midCtaLead:
      'Browse used fixed, spinlock and adjustable dumbbells listed by sellers across the UK, from single pairs to full sets with racks.',
    midCtaLabel: 'Browse Home Dumbbells',
    exploreLead:
      'Continue through home strength and home cardio categories, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'Fixed and adjustable sets',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),

  'home-weight-benches': Object.freeze({
    eyebrow: 'The cheapest useful thing in a home gym',
    h1: 'Used Home Weight Benches',
    lead: 'Browse used home weight benches — flat, adjustable, folding and bench press combinations — from sellers across the UK on Equipd. Pay securely by card, get Buyer Protection on eligible purchases and value any bench free before you buy.',
    metaTitle: 'Used Home Weight Benches for Sale UK | Equipd',
    metaDescription:
      'Used home weight benches from UK sellers — flat, adjustable and folding. Check pads, frames and weight ratings, then buy securely with Buyer Protection.',
    schemaAbout: 'Used home weight benches',
    searchLabel: 'Search home weight benches',
    listingsHeading: 'Live home weight bench listings',
    listingsLead:
      'Flat, adjustable, folding and bench press combination benches listed on Equipd by private sellers, dealers and refurbishers across the UK.',
    listingsCta: 'Browse all home weight benches',
    categoryHeading: 'Other home strength to consider',
    categoryLead:
      'A bench needs weights to be useful. Look at dumbbells, power racks and multi-gyms to build the rest of a home strength setup around it.',
    brandLead:
      'Mirafit, Bodymax, York, Adidas, Domyos, Bowflex and Rep all sell home benches in the UK, and light-commercial benches from gym brands also turn up used. Frame weight, pad width and the adjustment mechanism are what separate a bench that lasts from one that wobbles.',
    benefitsHeading: 'Why buy a used home weight bench on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'cheap-and-plentiful',
        title: 'Cheap, plentiful and hard to break',
        body: 'Benches are simple steel frames with a pad, so used examples are usually in good structural order and sell for very little. It is the least risky purchase in a home gym.',
      }),
      Object.freeze({
        id: 'ex-commercial-bargain',
        title: 'Ex-gym benches at home bench prices',
        body: 'A used commercial bench often costs less than a new mid-range home bench while being far heavier, wider-padded and rated for much greater loads — the single best value swap in home strength equipment.',
      }),
      Object.freeze({
        id: 'easy-transport',
        title: 'No assembly, no power, easy to collect',
        body: 'Most benches need no assembly and fit in a car or estate boot, which keeps the real cost of buying used genuinely low compared with equipment that needs a van and a rebuild.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Buyer Protection on eligible purchases',
        body: 'Pay through Equipd and funds are held until you confirm handover, with a protection window afterwards on eligible purchases — reassurance even on a lower-value item bought from a stranger.',
      }),
    ]),
    valuationEyebrow: 'Bench in the shed?',
    valuationHeading: 'Value a home weight bench free',
    valuationCopy:
      'Benches are the item people most often give away for nothing, and good adjustable and light-commercial benches are worth considerably more than owners assume. The free Equipd valuation shows a realistic UK range for the type and condition, so you can price a sale fairly or check a listing before you travel for it.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the bench type or model' }),
      Object.freeze({ label: 'Details', body: 'Add age, adjustment and pad condition' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home weight bench buying guide',
    guideIntro:
      'A bench is the least glamorous and most useful thing in a home gym. With one bench and a pair of dumbbells you can train your whole body, and a decent bench costs very little second-hand because they are simple, durable and constantly being sold on by people clearing a spare room. The risk is buying too light a bench: home benches vary enormously in frame weight and weight rating, and a bench that flexes or rocks under a heavy set is unpleasant at best and genuinely unsafe at worst. This guide covers bench types and specification, weight ratings and stability, faults on used benches, storage and folding, using a bench with a rack, pad care and reupholstery, and how ex-commercial benches compare for home use.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'types',
        heading: 'Flat, adjustable, folding and combination benches',
        paragraphs: Object.freeze([
          'Flat benches are the simplest and strongest option. There is no adjustment to seize or bend, they are usually the heaviest built for the money, and they cover pressing, rows and step-ups perfectly well. If you only want one bench and space is not a problem, a solid flat bench is a defensible choice.',
          'Adjustable benches — flat to incline, sometimes with decline — are what most people should buy. Incline pressing, seated shoulder work and supported rows all become available, and the versatility is worth the extra complexity. The mechanism is what you are really buying, so a bench that adjusts easily and locks solidly is worth paying more for.',
          'Folding benches trade some rigidity for the ability to store flat against a wall or under a bed. In a bedroom or a shared living space that can be the difference between owning a bench and not, but be aware that folding frames are generally lighter and less planted than fixed ones.',
          'Bench press combinations with integrated uprights let you press a barbell without a rack, which suits people short of space or budget. The compromise is limited adjustment and much weaker safety provision than a proper rack, so if you plan to press heavy alone, a rack with safeties and a separate bench is the safer route.',
        ]),
      }),
      Object.freeze({
        id: 'ratings-and-stability',
        heading: 'Weight ratings, frame weight and stability',
        paragraphs: Object.freeze([
          'Check the maximum user and load rating, which on home benches is usually quoted as a combined figure. Ratings vary hugely — from figures that only suit light dumbbell work to several hundred kilograms on serious benches — and the number is a good proxy for how the bench is built.',
          'Frame weight tells you as much as the rating. A heavier bench is more stable, quieter and less likely to shift while you press, and it is the main thing separating a light bench from one that feels reassuring under a heavy set. If you can, lift the bench before buying: the difference is immediately obvious.',
          'Look at the leg configuration. Benches with a wide, well-braced base sit stable, while narrow three-legged designs can feel tippy under uneven loads such as single-arm rows. Also check the feet — worn or missing foot pads are the most common cause of a bench that rocks and marks the floor.',
          'Consider pad height and width. A pad around 25 to 30cm wide supports the shoulders without restricting them, and pad height matters if you will use the bench inside a rack. Very high benches make it hard to plant your feet, which is worth checking if you are shorter than average.',
        ]),
      }),
      Object.freeze({
        id: 'faults',
        heading: 'Faults to check on a used bench',
        paragraphs: Object.freeze([
          'Set the bench on a flat floor and rock it. Wobble almost always comes from missing or worn foot pads, a bent leg from being dragged, or an uneven floor. If it still rocks with sound feet on level ground, the frame is likely twisted, which is difficult to put right and worth avoiding given how cheap sound benches are.',
          'Work the adjustment through every position several times, checking it moves without a struggle and locks positively at each setting. Ladders, pop-pins and gas struts get bent or worn when people adjust a bench with weight on it, and any position that will not lock is unsafe.',
          'Inspect the upholstery carefully. Split seams, tears at the edges where people grip, compressed foam that no longer supports and staple lines pulling out underneath are all common. Splits let sweat into the foam, which is a hygiene problem as much as a cosmetic one, though recovering a pad is inexpensive.',
          'Then check the details: welds at the uprights and the adjustment ladder, rust if the bench has lived in a shed or garage, the folding mechanism if fitted, and whether any leg extension or preacher attachment includes its pins and pads. Missing attachment parts are common and often not worth chasing.',
        ]),
      }),
      Object.freeze({
        id: 'space-and-storage',
        heading: 'Space, storage and living with a bench',
        paragraphs: Object.freeze([
          'A home bench typically measures around 1.2 to 1.5m long and 0.6m wide, but the space you need is bigger. You want room to sit or lie with your arms out to the sides, space at the head end if you press with dumbbells, and enough clearance to get on and off without moving furniture.',
          'Think about where it lives when not in use. Fixed benches are heavy enough to leave in place but awkward to store, folding benches go flat against a wall or under a bed, and upright-storing benches stand on end in a corner. In a shared room, the storage question decides whether the bench gets used or resented.',
          'Protect the floor. A bench with worn feet will mark carpet and scratch laminate, particularly when it shifts under a heavy set. A mat under the training area handles this, and it will already be there if you are using dumbbells, which you almost certainly are.',
          'Weight varies more than people expect. Light home benches can be 15 to 25kg and are easily moved by one person, while heavier adjustable and commercial benches are 30 to 70kg or more, need two people and will not tuck away. Match the bench to whether the space is dedicated or shared.',
        ]),
      }),
      Object.freeze({
        id: 'using-with-a-rack',
        heading: 'Using a bench with a rack or barbell',
        paragraphs: Object.freeze([
          'If you will bench press inside a power rack, check the bench width against the internal width of the rack and make sure there is room for you as well. Home racks vary, and a wide commercial bench in a narrow home rack leaves no space to get set up properly.',
          'Pad height needs to work with the rack hole spacing so the bar can sit at a comfortable unracking height with your shoulders on the bench. This is an easy thing to overlook and an annoying one to discover afterwards, so measure both before buying if you already own the rack.',
          'For pressing without a rack, be realistic about safety. Bench press combinations with fixed uprights offer limited protection if a lift fails, and pressing heavy alone with no safeties is the most common way people get hurt training at home. Dumbbell pressing is a far safer default if you train alone.',
          'If you are buying both a bench and a rack, buy them together where you can so the fit is known. It also usually works out cheaper, since sellers clearing a home gym would rather move both items in one transaction.',
        ]),
      }),
      Object.freeze({
        id: 'pads-and-reupholstery',
        heading: 'Pad care, reupholstery and long-term value',
        paragraphs: Object.freeze([
          'Clean pads with a cleaner suitable for vinyl rather than a harsh household spray, since aggressive products dry the material and cause cracking. This single habit is the main determinant of how long upholstery lasts, and it applies as much at home as in a gym.',
          'Repair small splits as soon as they appear. A vinyl repair patch costs very little and stops a small tear becoming a soaked pad, and it can add years to a bench that would otherwise need recovering.',
          'Recovering pads is an option worth knowing about. A structurally excellent bench with tired upholstery is often the cheapest good bench available, because a local trimmer can recover the pads for a modest amount. That is exactly why buying on frame and mechanism condition rather than appearance makes sense.',
          'Keep the bench somewhere dry if you can. Sheds and unheated garages rust frames and perish vinyl over a few winters, and a bench that has spent years outdoors under a tarpaulin is usually more work than it is worth, however cheap it looks.',
        ]),
      }),
      Object.freeze({
        id: 'ex-commercial-and-collecting',
        heading: 'Ex-commercial benches and collecting yours',
        paragraphs: Object.freeze([
          'Consider an ex-gym bench seriously. Commercial benches are heavier, have wider and better-shaped pads, higher load ratings and much more robust adjustment mechanisms, and used prices frequently undercut new home benches. For a garage or dedicated room they are the obvious choice.',
          'The only real drawbacks are weight and size. A commercial bench at 50 to 70kg needs two people and will not be casually moved or stored upright, and its width may not suit a narrow home rack. If your space is shared or upstairs, a lighter folding home bench may still be the better answer.',
          'Inspect before you pay. Sit and lie on the bench, work every adjustment position, rock it on a flat floor, check the feet and pad seams, and look along the frame for twist. It takes two minutes and it is the whole inspection.',
          'Collection is the easiest of any gym equipment. Fulfilment on Equipd is arranged directly between buyer and seller — collection, seller delivery or a buyer-arranged courier — and most benches fit in a car or estate boot with the seats down. Confirm handover once the bench is in your house and you have used it, since that is what starts the Buyer Protection window on eligible purchases.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Weight ratings, wobble, folding storage and using a bench with a rack — the practical questions on used home benches.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'Should I buy a flat or adjustable bench for home?',
        answer:
          'An adjustable bench is the better buy for most people, since incline pressing, seated shoulder work and supported rows all become available. Flat benches are simpler, usually heavier built for the money and have no mechanism to fail, so they suit anyone who only wants to press and row.',
      }),
      Object.freeze({
        question: 'What weight rating do I need?',
        answer:
          'Look at the combined user and load rating and treat it as a proxy for build quality. Ratings vary from figures suited only to light dumbbell work to several hundred kilograms. If you plan to press heavy or use a barbell, buy at the higher end and prefer a heavier frame.',
      }),
      Object.freeze({
        question: 'Why does my used bench wobble?',
        answer:
          'Almost always missing or worn foot pads, a leg bent from being dragged, or an uneven floor. Check the feet first and test it on level ground. If it still rocks with sound feet on a flat floor, the frame is likely twisted, which is hard to correct and a reason to find another bench.',
      }),
      Object.freeze({
        question: 'Are folding benches strong enough?',
        answer:
          'Good ones are perfectly adequate for dumbbell training, but folding frames are generally lighter and feel less planted than fixed benches. If you need to store the bench flat against a wall or under a bed, the trade-off is worth it; if you have a dedicated space, a fixed frame feels better.',
      }),
      Object.freeze({
        question: 'How do I know if a bench will fit inside my power rack?',
        answer:
          'Measure the bench width against the internal rack width, allowing room for you to get set up, and check pad height against the rack hole spacing so the bar sits at a comfortable unracking height. Commercial benches are wider than home benches, so this matters if you already own a home rack.',
      }),
      Object.freeze({
        question: 'Is split upholstery worth worrying about?',
        answer:
          'It affects hygiene and value rather than safety, since splits let sweat into the foam. A repair patch applied early stops a small tear spreading, and recovering pads costs a modest amount, so a structurally excellent bench with tired upholstery is often the cheapest good bench you can buy.',
      }),
      Object.freeze({
        question: 'Are ex-commercial benches suitable for home use?',
        answer:
          'Very much so, and they are frequently cheaper used than new home benches while being heavier, wider-padded and far more robustly adjustable. The only drawbacks are weight of 50 to 70kg or more, which needs two people, and a width that may not suit a narrow home rack.',
      }),
      Object.freeze({
        question: 'Can I bench press safely without a rack?',
        answer:
          'It is the most common way people get hurt training alone at home. Bench press combinations with fixed uprights offer limited protection if a lift fails, so if you train solo, either use a rack with safeties or default to dumbbell pressing, which you can simply set down if a set goes wrong.',
      }),
      Object.freeze({
        question: 'How much space does a home bench need?',
        answer:
          'The bench itself is around 1.2 to 1.5m long and 0.6m wide, but allow room to lie with your arms out to the sides, space at the head end for dumbbell pressing, and clearance to get on and off. Also plan where it will live when not in use if the room is shared.',
      }),
      Object.freeze({
        question: 'Can I keep a weight bench in a shed or garage?',
        answer:
          'It will survive, but damp rusts frames and perishes vinyl over a few winters. A dry space is much kinder, and a bench that has spent years outdoors under a tarpaulin is usually more work than it is worth however cheap it looks. If it must live in a garage, keep it off a wet floor and covered.',
      }),
    ]),
    midCtaHeading: 'Need a bench for home?',
    midCtaLead:
      'Browse used flat, adjustable, folding and bench press combination benches listed by sellers across the UK.',
    midCtaLabel: 'Browse Home Weight Benches',
    exploreLead:
      'Keep exploring home strength and home cardio categories, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'Adjustable and folding options',
      'Buyer Protection on eligible orders',
      'Free Instant Valuation',
    ]),
  }),

  'home-power-racks': Object.freeze({
    eyebrow: 'Barbell training, safely, at home',
    h1: 'Used Home Power Racks',
    lead: 'Find used home power racks, squat racks and folding wall racks from sellers across the UK on Equipd. We provide the marketplace and secure payment flow, with Buyer Protection on eligible purchases and a free Instant Valuation on any rack.',
    metaTitle: 'Used Home Power Racks for Sale UK | Equipd',
    metaDescription:
      'Used home power racks and squat racks from UK sellers. Check uprights, safeties and ceiling height, then buy securely with Buyer Protection on eligible purchases.',
    schemaAbout: 'Used home power racks and squat racks',
    searchLabel: 'Search home power racks',
    listingsHeading: 'Live home power rack listings',
    listingsLead:
      'Full racks, half racks, squat stands and folding wall-mounted racks listed on Equipd by private sellers, dealers and refurbishers across the UK.',
    listingsCta: 'Browse all home power racks',
    categoryHeading: 'Other home strength to consider',
    categoryLead:
      'A rack needs a bar, plates and a bench. Look at home benches, dumbbells and multi-gyms to complete a garage or spare-room setup.',
    brandLead:
      'Mirafit, Bodymax, Titan, Force USA, Rogue and Eleiko all appear used in the UK, alongside ex-commercial racks from gym brands. Upright size and hole pattern matter most, because they decide which attachments you can add later.',
    benefitsHeading: 'Why buy a used home power rack on Equipd?',
    benefits: Object.freeze([
      Object.freeze({
        id: 'train-alone-safely',
        title: 'Squat and press alone, safely',
        body: 'A rack with proper safety bars lets you train heavy without a spotter, which is the single most important piece of equipment for anyone serious about barbell training at home.',
      }),
      Object.freeze({
        id: 'steel-lasts',
        title: 'Steel that will outlast the house',
        body: 'A rack is welded steel with a few consumable liners and pins. Unless it has been physically damaged, a used rack performs exactly like a new one, which makes second-hand the obvious way to buy.',
      }),
      Object.freeze({
        id: 'attachments-included',
        title: 'Often sold with the extras',
        body: 'Home gym clearances usually include J-cups, safeties, a pull-up bar and sometimes plates and a bar. Attachments bought separately add up quickly, so a complete rack is worth more than the frame alone.',
      }),
      Object.freeze({
        id: 'protection',
        title: 'Secure payment on a collection deal',
        body: 'Racks are almost always collected. Paying through Equipd means funds are held until handover is confirmed, with Buyer Protection on eligible purchases rather than money sent before you have seen the steel.',
      }),
    ]),
    valuationEyebrow: 'Clearing a garage gym?',
    valuationHeading: 'Value a home power rack free',
    valuationCopy:
      'Rack prices depend far more on brand, upright size and included attachments than on age, which is why apparently similar racks are advertised at wildly different money. The free Equipd valuation gives you a realistic UK range for the model and condition, so you can price a garage clearance fairly or judge whether a listing is worth the drive.',
    valuationSteps: Object.freeze([
      Object.freeze({ label: 'Search', body: 'Find the rack model or brand' }),
      Object.freeze({ label: 'Details', body: 'Add upright size, age and attachments' }),
      Object.freeze({ label: 'Estimate', body: 'See a realistic used range' }),
      Object.freeze({ label: 'Decide', body: 'Sell it or make an offer', emphasize: true }),
    ]),
    guideNote: 'Buying guide',
    guideHeading: 'Used home power rack buying guide',
    guideIntro:
      'A power rack is the piece of equipment that turns a room with weights in it into a gym you can genuinely train hard in. It lets you squat, press and bench alone with safeties underneath you, and because it is nothing more than welded steel with a handful of liners and pins, a used rack is functionally identical to a new one. The decisions that matter are physical rather than mechanical: whether the rack fits under your ceiling, whether your floor can be drilled or the rack is stable without it, whether the upright size gives you access to the attachments you will want in two years, and how much noise a dropped bar will send to whoever lives below or next door. This guide covers rack types, specification, damage checks, ceiling height and floors, noise, attachments, ex-commercial options and how to move one.',
    guideSections: Object.freeze([
      Object.freeze({
        id: 'rack-types',
        heading: 'Full racks, half racks, squat stands and folding racks',
        paragraphs: Object.freeze([
          'A full power rack with four uprights and enclosed safety bars is the safest option and the right choice for anyone training alone. You can bail out of a failed squat or bench press onto the safeties, and the frame doubles as a pull-up station. It is the largest and heaviest option, and it needs the most ceiling height.',
          'Half racks and squat stands take up less depth and are easier to fit into a small garage, but they offer less safety margin — spotter arms on a half rack are not the same as being inside a full rack. Squat stands in particular are best suited to lifters who are experienced and honest about what they will attempt alone.',
          'Folding wall-mounted racks are the space-saving answer and are genuinely clever: they bolt to a wall, fold flat to a few inches deep when not in use, and give you a proper rack in a garage you still need to park in. They require a suitable structural wall and careful fixing, which is the main constraint.',
          'Rack and bench combinations or racks with integrated lat pulldowns pack more into a footprint, which suits people who want cable work as well as barbell training. The compromise is complexity and usually a smaller usable rack space, so if barbell lifting is the priority, keep the rack simple and add attachments later.',
        ]),
      }),
      Object.freeze({
        id: 'specification',
        heading: 'Upright size, hole spacing and steel',
        paragraphs: Object.freeze([
          'Upright size is the specification that follows you for the life of the rack. Home racks commonly use 50mm or 60mm square uprights, while premium and commercial racks use 75mm. Bigger uprights are stiffer and feel more solid, and crucially they determine which attachments will fit — accessories are not interchangeable between sizes.',
          'Hole spacing and diameter matter for the same reason. Closer spacing through the bench and squat range lets you set J-cups and safeties exactly where you want them, which is a real quality-of-life difference. Hole diameter dictates which pins and attachments fit, and unusual patterns are why some older racks cannot be extended.',
          'Steel thickness varies between racks with identical outside dimensions, and the thinner ones flex more and are more likely to deform around the holes over years of heavy J-cup use. Rack weight is a reasonable proxy if the specification is not available — a heavier rack of the same size is built from thicker steel.',
          'Check the safety system and the rated capacity. Pin-and-pipe safeties, flip-down bars and strap safeties all work; straps are kinder to bars and floors while steel is more robust. Rated capacities on home racks vary a great deal, and a rack rated for modest loads is not the one to buy if you intend to squat heavy.',
        ]),
      }),
      Object.freeze({
        id: 'damage-checks',
        heading: 'Checking a used rack for damage',
        paragraphs: Object.freeze([
          'Sight along each upright from top to bottom looking for bowing or bending. Uprights get damaged by repeated heavy loading onto safeties or by rough handling during a previous move, and a visibly bent upright compromises the whole structure. Given how many sound racks are available used, walk away from a bent one.',
          'Examine the holes in the bench and squat range, where J-cups spend their life. Ovalled or torn holes let attachments move under load and indicate years of heavy use with metal-on-metal cups. Some wear is cosmetic; holes that have visibly opened up are a genuine concern.',
          'Check the welds at the base and at every cross member for cracks or amateur repairs, and look closely for rust if the rack has lived in a garage — surface rust is cosmetic and easily treated, but deep pitting on a bar-contact surface or at a weld is not.',
          'Then check what comes with it. J-cups should have intact plastic or UHMW liners, since bare metal chews bars and uprights, safeties should be straight and complete, pins should all be present, and the pull-up bar should be secure with serviceable knurling. Count everything, because attachments are a large part of a rack\'s value.',
        ]),
      }),
      Object.freeze({
        id: 'ceiling-and-floor',
        heading: 'Ceiling height, garage floors and bolting down',
        paragraphs: Object.freeze([
          'Ceiling height decides which racks you can even consider. Home racks are commonly 2.1 to 2.3m tall, and you need clearance above that to use a pull-up bar, plus enough headroom to press overhead inside the rack. Garages with low beams, up-and-over door mechanisms and loft rooms are where this most often fails, so measure to the lowest obstruction first.',
          'A short rack is a legitimate answer to a low ceiling. Many manufacturers make shorter versions, and losing the pull-up bar is a reasonable trade for having a rack at all. Check the height with the bar racked at your press height, not just the frame height.',
          'Bolting down improves stability considerably and is essential for folding wall racks and most half racks. On a concrete garage floor it is straightforward with the right anchors. If you cannot drill — a rented property, underfloor heating, a suspended timber floor — favour a heavy full rack with a wide footprint, or one with a base frame designed to be loaded with plates for stability.',
          'Protect the floor and think about level. Rubber matting or a small lifting platform under the rack protects concrete from dropped plates, reduces noise and gives you a consistent surface. Garage floors are often slightly sloped towards the door, which is worth checking before you decide where the rack sits.',
        ]),
      }),
      Object.freeze({
        id: 'noise',
        heading: 'Noise, neighbours and dropping weights',
        paragraphs: Object.freeze([
          'Barbell training is the loudest thing you can do at home, and the noise is impact rather than airborne. A bar racked hard into J-cups or set down onto safeties sends a sharp bang through the structure of the building, and in a terrace or a flat that is exactly the noise neighbours object to.',
          'Rubber matting under the rack is the minimum, and a proper platform of plywood and rubber is much better if you can build one. Rubber-coated or bumper plates are far quieter than bare iron for both racking and setting down, and are worth the difference in a shared building.',
          'Change how you lift rather than only what you lift on. Lowering the bar under control onto safeties instead of dropping it, setting the safeties at a height that means a short fall, and avoiding deadlifts dropped from the top all reduce the noise dramatically. Deadlifting is the hardest movement to make quiet at home.',
          'Be pragmatic about timing and location. A detached garage on a concrete slab is a very different proposition from an upstairs room in a converted house, and if you are in the latter a rack may simply not be the right choice — dumbbells and a multi-gym make far less noise.',
        ]),
      }),
      Object.freeze({
        id: 'attachments',
        heading: 'Attachments, compatibility and building the setup',
        paragraphs: Object.freeze([
          'The attachment ecosystem is worth thinking about before you buy the rack. Dip bars, landmines, lat pulldown units, plate horns and extra J-cups all extend a rack over time, but only if they are made for your upright size and hole pattern. A rack using a widespread standard is much easier and cheaper to live with.',
          'J-cup liners are consumables. Once a liner wears through, the cup starts marking your bar and the uprights, so replacing liners is cheap protection for an expensive barbell. Check the liners on any used rack and factor in a set if they are worn.',
          'Buy the bar and plates with the rack if you can. Home gym clearances often include a barbell, plates, collars and a bench, and buying it all together is cheaper than sourcing separately and means you know everything fits. It also saves several collection trips.',
          'Think about what you will add in a year. A rack with an accessible attachment range gives you room to grow, whereas an orphan rack with an unusual hole pattern leaves you making do with whatever came with it. That single consideration is often what separates a good used rack purchase from a frustrating one.',
        ]),
      }),
      Object.freeze({
        id: 'ex-commercial-and-moving',
        heading: 'Ex-commercial racks, transport and inspection',
        paragraphs: Object.freeze([
          'Ex-commercial racks are excellent value for a home gym if the space suits. They use heavier uprights, thicker steel and better attachment systems than most home racks, and used prices from gym clearances can be very reasonable. The obstacles are height, weight and the fact that commercial racks assume they will be bolted to a solid floor.',
          'Whichever route you choose, racks dismantle for transport, which makes them straightforward to move. Most come apart into uprights, cross members and attachments that fit in a van or even a large estate. The critical detail is that every bolt, pin and attachment travels with the rack, so agree who dismantles and insist the hardware is bagged.',
          'Inspect before you pay, ideally with a bar. Rack a bar in the J-cups to see that it sits properly, check the safeties are straight and engage well, try the pull-up bar and look along the uprights for bends. Photograph the uprights, the holes in the working range, the welds and the full set of attachments.',
          'Plan the rebuild. Racks are simple to assemble but heavy and awkward with two people, and getting one square before tightening everything makes a noticeable difference to how it feels. Have the matting down and the position decided before it arrives.',
          'Confirm handover only once the rack is up in your space and you are satisfied with what arrived, since confirmation is what starts the Buyer Protection window on eligible purchases and missing attachments are the most common issue with used racks.',
        ]),
      }),
    ]),
    faqNote: 'Common questions',
    faqIntro:
      'Ceiling height, bolting down, noise for neighbours and attachment compatibility — the questions that decide which used rack suits your space.',
    faqItems: Object.freeze([
      Object.freeze({
        question: 'How much ceiling height do I need for a power rack?',
        answer:
          'Home racks are commonly 2.1 to 2.3m tall, and you need clearance above that to use a pull-up bar plus headroom to press overhead inside the rack. Measure to the lowest obstruction — garage beams, up-and-over door mechanisms and light fittings all count. Shorter racks are a legitimate answer to a low ceiling.',
      }),
      Object.freeze({
        question: 'Do I have to bolt a home rack to the floor?',
        answer:
          'Not always, but it improves stability considerably and is essential for folding wall racks and most half racks. If you cannot drill because you rent or have a suspended floor, favour a heavy full rack with a wide footprint, or one with a base frame designed to be loaded with plates for stability.',
      }),
      Object.freeze({
        question: 'Can I use a power rack in an upstairs room or a flat?',
        answer:
          'It is the hardest equipment to make work in a shared building, because racking a bar and setting weights down sends sharp impacts through the structure. Matting, bumper plates and controlled lifting help a great deal, but if you are above a neighbour, dumbbells or a multi-gym are far more considerate choices.',
      }),
      Object.freeze({
        question: 'Does upright size really matter on a home rack?',
        answer:
          'Yes. Larger uprights are stiffer and feel more solid, and the size determines which attachments will fit — accessories are not interchangeable between 50mm, 60mm and 75mm racks. Choosing a rack that uses a widespread standard means you can add dip bars, landmines and extra J-cups later.',
      }),
      Object.freeze({
        question: 'How do I check a used rack for damage?',
        answer:
          'Sight along each upright for bowing, examine the holes in the bench and squat range for ovalling or tearing, and check the welds at the base and cross members for cracks or repairs. Surface rust is cosmetic and treatable; bent uprights and cracked welds are reasons to look elsewhere.',
      }),
      Object.freeze({
        question: 'Are folding wall-mounted racks any good?',
        answer:
          'They are genuinely useful if you need the floor space back — they fold to a few inches deep and still give you a proper rack. The requirement is a suitable structural wall and careful fixing, which is the main constraint, so check the wall construction before you buy one.',
      }),
      Object.freeze({
        question: 'What attachments should come with a used rack?',
        answer:
          'J-cups with intact liners, a complete undamaged set of safeties, all pins, the pull-up bar and any dip bars or plate horns, plus every bolt from the dismantle. Attachments are a large share of a rack\'s value, so list what is included in Equipd messages and count everything before confirming handover.',
      }),
      Object.freeze({
        question: 'Are ex-commercial racks worth buying for home use?',
        answer:
          'If your space suits them, yes — heavier uprights, thicker steel and better attachment systems than most home racks, often at reasonable used prices from gym clearances. The obstacles are height, weight and the fact that commercial racks generally assume they will be bolted to a solid floor.',
      }),
      Object.freeze({
        question: 'Should I use strap or steel safeties at home?',
        answer:
          'Straps are gentler on the bar and the floor and absorb a dropped bar more kindly, which suits a garage or any space where noise matters. Steel safeties are more robust and simpler. What matters most is that the set is complete, undamaged and set at a height that means a short fall.',
      }),
      Object.freeze({
        question: 'How difficult is it to move a power rack?',
        answer:
          'Straightforward, because racks dismantle into uprights, cross members and attachments that fit in a van or large estate. Two people and a measured route are enough. Insist every bolt and pin is bagged, and have the matting down and the position decided before it arrives so you can build it square.',
      }),
    ]),
    midCtaHeading: 'Ready to find a home power rack?',
    midCtaLead:
      'Browse used full racks, half racks, squat stands and folding wall racks listed by sellers across the UK.',
    midCtaLabel: 'Browse Home Power Racks',
    exploreLead:
      'Continue through home strength and home cardio categories, plus the Equipd guides to buying, selling and valuing used equipment.',
    heroTrustItems: Object.freeze([
      'Full, half and folding racks',
      'Buyer Protection on eligible orders',
      'Secure Stripe payments',
    ]),
  }),
})
