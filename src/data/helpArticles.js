export const HELP_CENTRE_HERO = {
  title: 'Help Centre',
  subtitle: 'Find answers about buying, selling, payments and Buyer Protection.',
  searchPlaceholder: 'Search for help articles...',
  emptySearchMessage:
    'No articles found. Try searching for buying, selling, refunds or payouts.',
}

export const HELP_CATEGORY_SECTIONS = [
  {
    id: 'buying',
    title: 'Buying',
    articleSlugs: [
      'how-buying-works',
      'buyer-protection',
      'collection-orders',
      'courier-orders',
      'refunds-and-returns',
    ],
  },
  {
    id: 'selling',
    title: 'Selling',
    articleSlugs: [
      'how-selling-works',
      'receiving-offers',
      'accepted-sales',
      'getting-paid',
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    articleSlugs: ['buyer-protection-fee', 'seller-payouts', 'stripe-payout-setup'],
  },
  {
    id: 'account',
    title: 'Account',
    articleSlugs: [
      'creating-an-account',
      'account-settings',
      'updating-default-location',
      'profile-pictures',
    ],
  },
  {
    id: 'policies',
    title: 'Policies',
    articleSlugs: [
      'buyer-protection',
      'refunds-and-returns',
      'terms-and-conditions',
      'privacy-policy',
      'cookie-policy',
    ],
  },
]

export const HELP_ARTICLES = [
  {
    slug: 'how-buying-works',
    title: 'How Buying Works',
    category: 'buying',
    updatedAt: '2026-06-24',
    excerpt:
      'Find equipment, make offers, pay securely through Equipd, arrange fulfilment, and complete your purchase with Buyer Protection.',
    content: [
      {
        type: 'paragraph',
        text: 'Equipd makes buying used gym equipment simple, secure, and transparent.',
      },
      {
        type: 'paragraph',
        text: "Whether you're purchasing a single dumbbell set or a full commercial gym, the process follows the same straightforward steps.",
      },
      {
        type: 'heading',
        text: 'Step 1: Find equipment',
      },
      {
        type: 'paragraph',
        text: 'Browse listings using categories, search, or filters.',
      },
      {
        type: 'paragraph',
        text: 'You can search by:',
      },
      {
        type: 'list',
        items: [
          'Equipment type',
          'Brand',
          'Condition',
          'Price',
          'Location',
        ],
      },
      {
        type: 'paragraph',
        text: 'You can also sort listings by newest, price, and distance.',
      },
      {
        type: 'heading',
        text: 'Step 2: Review the listing',
      },
      {
        type: 'paragraph',
        text: 'Before making an offer, review the listing carefully.',
      },
      {
        type: 'paragraph',
        text: 'Pay particular attention to:',
      },
      {
        type: 'list',
        items: [
          'Photos',
          'Description',
          'Condition rating',
          'Collection or delivery options',
          'Seller information',
        ],
      },
      {
        type: 'paragraph',
        text: 'If you need additional information, you can contact the seller directly through Equipd.',
      },
      {
        type: 'heading',
        text: 'Step 3: Make an offer',
      },
      {
        type: 'paragraph',
        text: 'Most listings allow buyers to submit offers.',
      },
      {
        type: 'paragraph',
        text: 'The seller can:',
      },
      {
        type: 'list',
        items: [
          'Accept the offer',
          'Decline the offer',
          'Send a counter offer',
        ],
      },
      {
        type: 'paragraph',
        text: 'Both parties can continue negotiating until an agreement is reached.',
      },
      {
        type: 'heading',
        text: 'Step 4: Complete checkout',
      },
      {
        type: 'paragraph',
        text: "Once an offer is accepted, you'll be able to complete secure checkout.",
      },
      {
        type: 'paragraph',
        text: 'Your total includes:',
      },
      {
        type: 'list',
        items: ['Item price', 'Buyer Protection fee'],
      },
      {
        type: 'paragraph',
        text: 'Payments are processed securely through Stripe.',
      },
      {
        type: 'heading',
        text: 'Step 5: Arrange fulfilment',
      },
      {
        type: 'paragraph',
        text: 'Depending on the listing, the order will proceed as one of the following:',
      },
      {
        type: 'heading',
        text: 'In-person handover orders',
      },
      {
        type: 'paragraph',
        text: 'Collection and Seller Delivery are both in-person handover orders. The buyer is present, can inspect the equipment, and confirms handover using Equipd\'s QR confirmation system.',
      },
      {
        type: 'list',
        items: [
          'Collection — the buyer collects from the seller.',
          'Seller Delivery — the seller delivers to the buyer.',
        ],
      },
      {
        type: 'heading',
        text: 'Courier orders',
      },
      {
        type: 'paragraph',
        text: 'For buyer-arranged courier orders, the buyer is not present at handover. Courier evidence and delivery confirmation apply instead of QR confirmation.',
      },
      {
        type: 'paragraph',
        text: 'The seller and buyer should communicate through Equipd to arrange the next steps.',
      },
      {
        type: 'heading',
        text: 'Step 6: Receive your equipment',
      },
      {
        type: 'paragraph',
        text: 'Inspect the equipment as soon as possible.',
      },
      {
        type: 'paragraph',
        text: 'For in-person handover orders (collection and seller delivery), inspect and test equipment before confirming via QR.',
      },
      {
        type: 'paragraph',
        text: 'For courier orders, inspect equipment after delivery and confirm through the order page.',
      },
      {
        type: 'heading',
        text: 'Step 7: Buyer Protection',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection helps protect your purchase if something goes wrong.',
      },
      {
        type: 'paragraph',
        text: 'Protection may apply if:',
      },
      {
        type: 'list',
        items: [
          'The item does not arrive',
          'The item arrives damaged',
          'The item is significantly different from the listing description',
          'The item is not working as described',
        ],
      },
      {
        type: 'heading',
        text: 'Step 8: Order completion',
      },
      {
        type: 'paragraph',
        text: 'Once Buyer Protection requirements have been satisfied, the order is completed and seller payout is released.',
      },
      {
        type: 'paragraph',
        text: "Equipd's goal is to provide a safe and transparent marketplace for used gym equipment.",
      },
    ],
  },
  {
    slug: 'buyer-protection',
    title: 'Buyer Protection',
    category: 'buying',
    updatedAt: '2026-06-24',
    excerpt:
      'How Equipd protects buyers and sellers with secure payments, QR handover confirmation, delivery confirmation, and a 24-hour protection window.',
    content: [
      {
        type: 'heading',
        text: 'Buy and sell with confidence',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection is built into every Equipd purchase. It helps buyers complete transactions with confidence, while giving sellers reassurance that payment is secure before handover.',
      },
      {
        type: 'paragraph',
        text: 'Whether you are buying your first set of dumbbells or clearing an entire commercial gym, Equipd holds your payment safely until the transaction is successfully completed.',
      },
      {
        type: 'heading',
        text: 'How Buyer Protection works',
      },
      {
        type: 'paragraph',
        text: 'When your offer is accepted, you pay through Equipd checkout. Your payment is processed securely and linked to the order.',
      },
      {
        type: 'paragraph',
        text: 'Funds are held by Equipd while you arrange fulfilment with the seller. They are not paid out to the seller immediately.',
      },
      {
        type: 'paragraph',
        text: 'Once fulfilment is confirmed (via QR handover confirmation for in-person orders, or delivery confirmation for courier orders), a 24-hour Buyer Protection window begins. Seller payout remains on hold during this period.',
      },
      {
        type: 'paragraph',
        text: 'If no dispute is opened during the protection window, the transaction proceeds towards completion and the seller payout is released (subject to payout setup being complete).',
      },
      {
        type: 'heading',
        text: 'What is covered',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection may apply if your item:',
      },
      {
        type: 'list',
        items: [
          "Doesn't arrive",
          'Arrives damaged',
          'Is significantly different from the listing description',
          'Is not working as described',
        ],
      },
      {
        type: 'paragraph',
        text: 'If you believe there is a problem, you must raise a dispute and provide supporting evidence during the active 24-hour Buyer Protection period.',
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'For full details on refunds, returns, and evidence requirements, see our ' },
          { link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } },
          { text: ' article.' },
        ],
      },
      {
        type: 'heading',
        text: 'Collection & Seller Delivery handovers',
      },
      {
        type: 'paragraph',
        text: 'Collection and Seller Delivery are both in-person handover orders. The buyer is physically present, and can inspect and test equipment where practical before confirming receipt.',
      },
      {
        type: 'paragraph',
        text: 'The handover process:',
      },
      {
        type: 'list',
        items: [
          'The buyer inspects the equipment at handover.',
          'The seller shows their Equipd QR code.',
          'The buyer scans the QR code while logged in and confirms handover.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection starts after QR confirmation, not before. It then remains active for 24 hours. Seller payout stays on hold during this period.',
      },
      {
        type: 'note',
        text: 'Buyers should only confirm handover via QR once they are satisfied with the equipment. For collection orders, inspect before confirming. For seller delivery orders, inspect after the equipment has been unloaded.',
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'See our ' },
          { link: { label: 'Collection & Seller Delivery Orders', to: '/help/collection-orders' } },
          { text: ' article for the full handover process.' },
        ],
      },
      {
        type: 'heading',
        text: 'Courier orders',
      },
      {
        type: 'paragraph',
        text: 'Courier orders are different because the buyer is not present at handover. A third-party courier transports the equipment instead.',
      },
      {
        type: 'paragraph',
        text: 'These orders use courier evidence and delivery confirmation rather than in-person QR confirmation. The seller provides handover evidence when the courier collects the item, and the buyer confirms delivery once the equipment arrives.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection starts once delivery is confirmed and remains active for 24 hours. Seller payout stays on hold during this period.',
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'See our ' },
          { link: { label: 'Courier Orders', to: '/help/courier-orders' } },
          { text: ' article for the full courier process.' },
        ],
      },
      {
        type: 'heading',
        text: 'Secure payments',
      },
      {
        type: 'paragraph',
        text: 'Your payment remains protected throughout the transaction.',
      },
      {
        type: 'list',
        items: [
          'Funds are held securely by Equipd until the transaction is successfully completed',
          'In-person handover orders use Equipd QR code confirmation to verify handover',
          'Courier orders use collection and handover evidence to support the transaction record',
          'Payments are encrypted and securely processed by Stripe',
          'Seller payouts are held during the Buyer Protection period',
        ],
      },
      {
        type: 'heading',
        text: 'Disputes and support',
      },
      {
        type: 'paragraph',
        text: 'If something goes wrong, open a dispute from the order page during the active Buyer Protection window.',
      },
      {
        type: 'paragraph',
        text: 'Once a dispute is opened:',
      },
      {
        type: 'list',
        items: [
          'The order is paused',
          'Seller payout is placed on hold',
          'Equipd reviews the issue and may request evidence from both parties',
        ],
      },
      {
        type: 'paragraph',
        text: 'Evidence must be submitted within 48 hours of opening a dispute. Equipd reviews cases on a case-by-case basis to help reach a fair outcome.',
      },
      {
        type: 'paragraph',
        text: 'If you need help outside of a dispute, you can also raise a support request from the order page.',
      },
      {
        type: 'heading',
        text: 'The Equipd difference',
      },
      {
        type: 'paragraph',
        text: 'Buying and selling used gym equipment carries unique challenges: large items, specialist equipment, and in-person handovers. Equipd is designed specifically for this market.',
      },
      {
        type: 'list',
        items: [
          'Secure payments held by Equipd, not sent directly to the seller',
          'QR handover confirmation for in-person collection and seller delivery orders',
          'Courier evidence and delivery confirmation for remote transactions',
          'A clear 24-hour Buyer Protection window after handover or delivery',
          'Seller payouts held until protection requirements are satisfied',
          'Dispute review with evidence from both buyer and seller',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd helps both buyers and sellers complete transactions with confidence, from first offer to final payout.',
      },
    ],
  },
  {
    slug: 'collection-orders',
    title: 'Collection & Seller Delivery Orders',
    category: 'buying',
    updatedAt: '2026-06-24',
    excerpt:
      'How collection and seller delivery orders work on Equipd, including in-person handover, inspection, QR confirmation, and Buyer Protection.',
    content: [
      {
        type: 'paragraph',
        text: 'In-person handover orders are the most common way to buy and sell gym equipment on Equipd.',
      },
      {
        type: 'paragraph',
        text: 'Equipd supports two in-person handover order types:',
      },
      {
        type: 'list',
        items: [
          'Collection orders — the buyer travels to the seller to collect the equipment.',
          'Seller delivery orders — the seller travels to the buyer to deliver the equipment.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Although who transports the equipment differs, both follow the same in-person handover process: the buyer inspects the equipment, confirms receipt via QR, and Buyer Protection then applies.',
      },
      {
        type: 'paragraph',
        text: 'Large and heavy equipment can often be difficult or expensive to ship, which is why many transactions are completed in person. Equipd has been designed to make in-person handover orders as secure as possible for both buyers and sellers.',
      },
      {
        type: 'note',
        text: 'Courier orders are a separate process. The buyer is not present at handover, and a different confirmation flow applies. See our Courier Orders article for details.',
      },
      {
        type: 'heading',
        text: 'Collection vs Seller Delivery',
      },
      {
        type: 'paragraph',
        text: 'Collection:',
      },
      {
        type: 'list',
        items: [
          'Buyer travels to seller.',
          'Buyer inspects equipment.',
          'Buyer scans QR.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Seller Delivery:',
      },
      {
        type: 'list',
        items: [
          'Seller travels to buyer.',
          'Buyer inspects equipment after unloading.',
          'Buyer scans QR.',
        ],
      },
      {
        type: 'paragraph',
        text: 'For both:',
      },
      {
        type: 'list',
        items: [
          'Buyer Protection starts after QR confirmation.',
          'Buyer Protection remains active for 24 hours.',
          'Seller payout remains on hold during the protection period.',
        ],
      },
      {
        type: 'heading',
        text: 'Before handover',
      },
      {
        type: 'paragraph',
        text: 'Once payment has been completed, the buyer and seller should arrange a suitable handover date and time through Equipd messaging.',
      },
      {
        type: 'paragraph',
        text: 'For collection orders, before travelling, buyers should ensure they:',
      },
      {
        type: 'list',
        items: [
          'Understand the dimensions of the equipment',
          'Have a suitable vehicle',
          'Bring any equipment required for loading',
          'Confirm whether the item is assembled or dismantled',
          'Ask any questions about access restrictions',
        ],
      },
      {
        type: 'paragraph',
        text: 'For seller delivery orders, buyers should confirm access, unloading space, and any delivery restrictions. Sellers should confirm they can reach the agreed address and unload safely.',
      },
      {
        type: 'paragraph',
        text: 'Sellers should ensure the equipment is ready for in-person handover (collection or seller delivery) and accurately matches the listing description.',
      },
      {
        type: 'heading',
        text: 'Inspecting the equipment',
      },
      {
        type: 'paragraph',
        text: 'One of the advantages of in-person handover orders is that buyers can inspect equipment before confirming handover via QR.',
      },
      {
        type: 'paragraph',
        text: 'For collection orders, inspection takes place at the seller\'s location before the buyer leaves. For seller delivery orders, inspection takes place after the equipment has been unloaded at the buyer\'s location.',
      },
      {
        type: 'paragraph',
        text: 'We strongly recommend checking:',
      },
      {
        type: 'list',
        items: [
          'Overall condition',
          'Visible damage',
          'Included accessories or attachments',
          'Functionality where applicable',
          'Serial numbers, if relevant',
        ],
      },
      {
        type: 'paragraph',
        text: 'For powered equipment, buyers should test the item where reasonably possible before confirming handover.',
      },
      {
        type: 'heading',
        text: 'Handover confirmation',
      },
      {
        type: 'paragraph',
        text: "When the buyer is satisfied, in-person handover is confirmed using Equipd's QR code handover system. The same QR confirmation process applies to both collection and seller delivery orders.",
      },
      {
        type: 'paragraph',
        text: 'The seller shows the QR code. The buyer scans it while logged in, completes the inspection checks, and confirms handover.',
      },
      {
        type: 'paragraph',
        text: 'This creates a secure record that the equipment has been handed over.',
      },
      {
        type: 'paragraph',
        text: 'Buyers should only confirm handover once they are satisfied with the equipment they are receiving.',
      },
      {
        type: 'heading',
        text: 'Buyer Protection after handover',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection starts after QR confirmation, not before. It remains active for 24 hours after in-person handover (collection or seller delivery) is confirmed.',
      },
      {
        type: 'paragraph',
        text: 'Buyers then have a further period to identify issues that may not have been obvious during inspection.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection may apply if the item:',
      },
      {
        type: 'list',
        items: [
          'Is significantly different from the listing description',
          'Is not working as described',
          'Has undisclosed issues that could not reasonably have been identified during in-person handover',
        ],
      },
      {
        type: 'heading',
        text: 'Raising a dispute',
      },
      {
        type: 'paragraph',
        text: 'If an issue is discovered, a dispute must be opened during the active Buyer Protection period.',
      },
      {
        type: 'paragraph',
        text: 'Once a dispute is opened:',
      },
      {
        type: 'list',
        items: [
          'The order is paused',
          'Seller payout is placed on hold',
          'Equipd may request evidence from both parties',
        ],
      },
      {
        type: 'paragraph',
        text: 'Evidence must be provided within 48 hours of opening a dispute.',
      },
      {
        type: 'heading',
        text: 'After Buyer Protection ends',
      },
      {
        type: 'paragraph',
        text: 'If no dispute is opened during the Buyer Protection period, the transaction proceeds towards completion and seller payout.',
      },
      {
        type: 'paragraph',
        text: 'At this stage the order is considered successfully completed.',
      },
      {
        type: 'heading',
        text: 'Best practices',
      },
      {
        type: 'paragraph',
        text: 'For buyers:',
      },
      {
        type: 'list',
        items: [
          'Inspect equipment carefully before confirming handover via QR',
          'Test equipment where possible',
          'Ask questions before confirming handover',
          'Do not scan the QR code until satisfied',
        ],
      },
      {
        type: 'paragraph',
        text: 'For sellers:',
      },
      {
        type: 'list',
        items: [
          'Accurately describe equipment',
          'Disclose known faults',
          'Be available for the agreed handover time',
          'Show your QR code only after the buyer has had the opportunity to inspect',
          'Keep communication clear and professional',
        ],
      },
      {
        type: 'paragraph',
        text: 'In-person handover orders (collection or seller delivery) offer the highest level of confidence because buyers can inspect equipment in person before confirming handover via QR. Courier orders follow a different process because the buyer is not present at handover.',
      },
    ],
  },
  {
    slug: 'courier-orders',
    title: 'Courier Orders',
    category: 'buying',
    updatedAt: '2026-06-24',
    excerpt:
      'How courier orders work on Equipd, including handover evidence, delivery confirmation, Buyer Protection, and returns.',
    content: [
      {
        type: 'paragraph',
        text: 'Equipd supports courier delivery for buyers who cannot be present at handover.',
      },
      {
        type: 'paragraph',
        text: 'Courier orders are not the same as Seller Delivery. Seller Delivery is an in-person handover order where the buyer inspects equipment and confirms receipt via QR. Courier orders are used when a third-party courier transports the equipment and the buyer is not present at handover.',
      },
      {
        type: 'paragraph',
        text: 'Because gym equipment is often large, heavy, and specialist, courier orders require additional care from both buyers and sellers.',
      },
      {
        type: 'heading',
        text: 'Arranging a courier',
      },
      {
        type: 'paragraph',
        text: 'Unless otherwise agreed, the buyer is responsible for arranging the courier.',
      },
      {
        type: 'paragraph',
        text: 'Before booking a courier, buyers should confirm:',
      },
      {
        type: 'list',
        items: [
          'Equipment dimensions',
          'Equipment weight',
          'Collection address',
          'Collection availability',
          'Loading requirements',
        ],
      },
      {
        type: 'paragraph',
        text: "It is the buyer's responsibility to ensure the chosen courier is suitable for transporting the equipment.",
      },
      {
        type: 'heading',
        text: 'Preparing equipment for collection',
      },
      {
        type: 'paragraph',
        text: 'Sellers should ensure equipment is ready for collection.',
      },
      {
        type: 'paragraph',
        text: 'This may include:',
      },
      {
        type: 'list',
        items: [
          'Dismantling equipment if agreed',
          'Securing loose components',
          'Providing access for collection',
          'Making the item available during the agreed collection window',
        ],
      },
      {
        type: 'heading',
        text: 'Courier handover evidence',
      },
      {
        type: 'paragraph',
        text: 'To protect both parties, Equipd requires courier handover evidence.',
      },
      {
        type: 'paragraph',
        text: 'Depending on the order, this may include:',
      },
      {
        type: 'list',
        items: [
          'Collection photographs',
          'Equipment photographs before collection',
          'Courier information',
          'Tracking details',
          'Handover confirmation',
        ],
      },
      {
        type: 'paragraph',
        text: 'This evidence creates a record of the equipment condition and collection process.',
      },
      {
        type: 'heading',
        text: 'Delivery confirmation',
      },
      {
        type: 'paragraph',
        text: 'Once the equipment has been delivered, the buyer can confirm delivery through Equipd.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection becomes active once delivery is confirmed.',
      },
      {
        type: 'heading',
        text: 'Buyer Protection',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection remains active for 24 hours following confirmed delivery.',
      },
      {
        type: 'paragraph',
        text: 'During this period, buyers should inspect and test the equipment as soon as possible.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection may apply if:',
      },
      {
        type: 'list',
        items: [
          'The item arrives damaged',
          'The item is significantly different from the listing description',
          'The item is not working as described',
          'Important parts are missing',
        ],
      },
      {
        type: 'heading',
        text: 'Reporting an issue',
      },
      {
        type: 'paragraph',
        text: 'If a problem is identified, a dispute must be opened during the active Buyer Protection period.',
      },
      {
        type: 'paragraph',
        text: 'Once a dispute is opened:',
      },
      {
        type: 'list',
        items: [
          'Seller payout is paused',
          'The order enters dispute review',
          'Evidence may be requested from both parties',
        ],
      },
      {
        type: 'paragraph',
        text: 'Evidence must be submitted within 48 hours of opening the dispute.',
      },
      {
        type: 'heading',
        text: 'Returns',
      },
      {
        type: 'paragraph',
        text: 'In some cases, Equipd may determine that a return is required before a refund can be issued.',
      },
      {
        type: 'paragraph',
        text: 'Where a return is required:',
      },
      {
        type: 'list',
        items: [
          'Equipd will provide instructions to both parties',
          'The seller will usually be expected to arrange or cooperate with the return process',
          'Equipd may request evidence that return arrangements have been made',
          'Equipd may request tracking or courier information',
        ],
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'For full details, please see our ' },
          { link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } },
          { text: ' article.' },
        ],
      },
      {
        type: 'heading',
        text: 'Best practices',
      },
      {
        type: 'paragraph',
        text: 'For buyers:',
      },
      {
        type: 'list',
        items: [
          'Keep all courier records',
          'Photograph damage immediately',
          'Test equipment promptly after delivery',
        ],
      },
      {
        type: 'paragraph',
        text: 'For sellers:',
      },
      {
        type: 'list',
        items: [
          'Photograph equipment before collection',
          'Provide accurate descriptions',
          'Retain courier records until the order is completed',
        ],
      },
      {
        type: 'paragraph',
        text: 'Courier orders involve more logistics than collection orders, but Buyer Protection helps provide security throughout the process.',
      },
    ],
  },
  {
    slug: 'refunds-and-returns',
    title: 'Refunds & Returns',
    category: 'buying',
    updatedAt: '2026-06-24',
    excerpt:
      'When refunds and returns may apply on Equipd, how to report an issue, evidence requirements, and what to expect during dispute review.',
    content: [
      {
        type: 'paragraph',
        text: 'This article explains when refunds and returns may apply on Equipd and how the process works for both buyers and sellers.',
      },
      {
        type: 'paragraph',
        text: 'Refunds are considered when Buyer Protection applies and a dispute is raised with supporting evidence during the active protection window.',
      },
      {
        type: 'heading',
        text: 'What is covered',
      },
      {
        type: 'paragraph',
        text: 'A refund may be considered if Buyer Protection applies and the issue falls within eligible categories, such as:',
      },
      {
        type: 'list',
        items: [
          "The item doesn't arrive",
          'The item arrives damaged',
          'The item is significantly different from the listing description',
          'The item is not working as described',
          'Important parts are missing',
          'A significant undisclosed fault is discovered after handover or delivery',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd reviews each case individually and may request information from both buyer and seller before reaching a decision.',
      },
      {
        type: 'heading',
        text: 'What is not covered',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection and refunds generally do not apply to:',
      },
      {
        type: 'list',
        items: [
          'Issues discovered after the Buyer Protection window has ended',
          'Disputes opened without supporting evidence',
          'Buyer\'s remorse or change of mind',
          'Minor wear consistent with the listed condition',
          'Issues that could reasonably have been identified during in-person inspection before QR confirmation',
          'Damage caused after confirmed handover or delivery',
          'Problems arising from buyer misuse, incorrect assembly, or failure to follow manufacturer guidance',
          'Courier damage where the buyer failed to inspect and report issues during the protection window',
        ],
      },
      {
        type: 'note',
        text: 'For collection and seller delivery orders, buyers should inspect and test equipment carefully before confirming via QR. Once handover is confirmed, Buyer Protection covers issues that could not reasonably have been identified during inspection.',
      },
      {
        type: 'heading',
        text: 'Collection & Seller Delivery Orders',
      },
      {
        type: 'paragraph',
        text: 'Collection and seller delivery orders are both in-person handover orders. Although who transports the equipment differs, both use the same QR confirmation process.',
      },
      {
        type: 'paragraph',
        text: 'Collection orders:',
      },
      {
        type: 'list',
        items: [
          'Buyer travels to seller',
          'Buyer inspects equipment',
          'Buyer confirms handover using QR',
        ],
      },
      {
        type: 'paragraph',
        text: 'Seller delivery orders:',
      },
      {
        type: 'list',
        items: [
          'Seller travels to buyer',
          'Buyer inspects equipment after unloading',
          'Buyer confirms handover using QR',
        ],
      },
      {
        type: 'paragraph',
        text: 'For both collection and seller delivery orders, Buyer Protection remains active for 24 hours after QR confirmation. Any eligible dispute must be opened during this protection period.',
      },
      {
        type: 'paragraph',
        text: 'If an issue is discovered during this period, such as a significant undisclosed fault, the buyer should open a dispute from the order page with supporting evidence.',
      },
      {
        type: 'heading',
        text: 'Courier orders',
      },
      {
        type: 'paragraph',
        text: 'For courier orders, the buyer is not present at handover. The seller provides handover evidence when the courier collects the item, and the buyer confirms delivery once the equipment arrives.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection starts once delivery is confirmed and remains active for 24 hours. Buyers should inspect the equipment promptly and photograph any visible damage.',
      },
      {
        type: 'paragraph',
        text: 'If a problem is identified during the protection window, open a dispute from the order page with photos and any relevant courier records.',
      },
      {
        type: 'heading',
        text: 'Reporting an issue',
      },
      {
        type: 'paragraph',
        text: 'To report an issue:',
      },
      {
        type: 'list',
        items: [
          'Open the order page while logged in as the buyer',
          'Select the appropriate dispute reason',
          'Describe the issue clearly',
          'Attach photos, videos or other supporting evidence',
          'Respond promptly if Equipd requests further information',
        ],
      },
      {
        type: 'paragraph',
        text: 'Once a dispute is opened, the order is paused and seller payout is placed on hold while Equipd reviews the case.',
      },
      {
        type: 'heading',
        text: '24-hour Buyer Protection window',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection is a 24-hour window that begins after fulfilment is confirmed:',
      },
      {
        type: 'list',
        items: [
          'In-person handover orders (collection and seller delivery): after the buyer confirms handover via QR',
          'Courier orders: after the buyer confirms delivery',
        ],
      },
      {
        type: 'paragraph',
        text: 'A dispute must be opened during this window for Buyer Protection to apply. After the window ends, the transaction proceeds towards completion and seller payout if no dispute was opened.',
      },
      {
        type: 'heading',
        text: '48-hour evidence requirement',
      },
      {
        type: 'paragraph',
        text: 'After opening a dispute, supporting evidence must be submitted within 48 hours.',
      },
      {
        type: 'paragraph',
        text: 'Useful evidence may include:',
      },
      {
        type: 'list',
        items: [
          'Photographs or video of the issue',
          'Screenshots of the original listing',
          'Messages exchanged on Equipd',
          'Courier tracking or delivery records (for courier orders)',
          'Any other documentation that supports your case',
        ],
      },
      {
        type: 'paragraph',
        text: 'Failure to provide evidence within 48 hours may affect the outcome of the dispute.',
      },
      {
        type: 'heading',
        text: 'Partial refunds',
      },
      {
        type: 'paragraph',
        text: 'In some cases, Equipd may determine that a partial refund is appropriate rather than a full refund.',
      },
      {
        type: 'paragraph',
        text: 'This may apply when:',
      },
      {
        type: 'list',
        items: [
          'The item is usable but has a minor undisclosed issue',
          'A non-essential part is missing but the core equipment functions',
          'Damage is limited to a specific component',
          'Both parties share responsibility for the outcome',
        ],
      },
      {
        type: 'paragraph',
        text: 'Partial refunds are assessed on a case-by-case basis. Equipd will communicate the proposed resolution to both parties.',
      },
      {
        type: 'heading',
        text: 'Returns & full refunds',
      },
      {
        type: 'paragraph',
        text: 'In some cases, Equipd may determine that a return is required before a full refund can be issued.',
      },
      {
        type: 'paragraph',
        text: 'Where a return is required:',
      },
      {
        type: 'list',
        items: [
          'Equipd will provide instructions to both parties',
          'The buyer is usually expected to arrange return transport',
          'The seller will usually be expected to cooperate with the return process',
          'Equipd may request evidence that return arrangements have been made',
          'Equipd may request tracking or courier information',
        ],
      },
      {
        type: 'paragraph',
        text: 'A full refund may be issued once the return is completed and Equipd has reviewed the evidence, subject to the outcome of the dispute review.',
      },
      {
        type: 'heading',
        text: 'Seller cooperation requirements',
      },
      {
        type: 'paragraph',
        text: 'Sellers are expected to cooperate during dispute review. This may include:',
      },
      {
        type: 'list',
        items: [
          'Responding to Equipd requests for information within the stated timeframe',
          'Providing original listing details or additional photographs if requested',
          'Cooperating with return arrangements where a return is required',
          'Retaining courier records until the order is completed (for courier orders)',
          'Keeping communication professional and on Equipd',
        ],
      },
      {
        type: 'paragraph',
        text: 'Failure to cooperate may affect the outcome of a dispute review.',
      },
      {
        type: 'heading',
        text: 'Support',
      },
      {
        type: 'paragraph',
        text: 'Our team reviews Buyer Protection claims, delivery issues, and disputes on a case-by-case basis to help reach a fair outcome for both buyers and sellers.',
      },
      {
        type: 'paragraph',
        text: 'If you experience an issue, open a dispute from the order page as soon as possible during the Buyer Protection window and provide any relevant evidence to help us investigate.',
      },
      {
        type: 'paragraph',
        text: 'If you need help outside of a dispute, you can also raise a support request from the order page.',
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'For an overview of how Buyer Protection works, see our ' },
          { link: { label: 'Buyer Protection', to: '/help/buyer-protection' } },
          { text: ' article.' },
        ],
      },
    ],
  },
  {
    slug: 'how-selling-works',
    title: 'How Selling Works',
    category: 'selling',
    updatedAt: '2026-06-24',
    excerpt:
      'Create listings, receive offers, arrange fulfilment, and receive payouts securely through Equipd.',
    content: [
      {
        type: 'paragraph',
        text: 'Selling used gym equipment on Equipd is designed to be simple, secure, and transparent.',
      },
      {
        type: 'paragraph',
        text: "Whether you're selling a single treadmill or clearing an entire commercial facility, Equipd helps connect you with buyers while handling payments securely.",
      },
      {
        type: 'heading',
        text: 'Step 1: Create your listing',
      },
      {
        type: 'paragraph',
        text: 'Start by creating a listing for your equipment.',
      },
      {
        type: 'paragraph',
        text: 'The more information you provide, the more likely buyers are to engage with your listing.',
      },
      {
        type: 'paragraph',
        text: 'We recommend including:',
      },
      {
        type: 'list',
        items: [
          'Clear photographs from multiple angles',
          'Accurate equipment name and model',
          'Honest condition information',
          'Any faults or defects',
          'Collection or delivery options',
          'Relevant dimensions where possible',
        ],
      },
      {
        type: 'paragraph',
        text: 'Listings that accurately describe equipment are more likely to sell and less likely to result in disputes.',
      },
      {
        type: 'heading',
        text: 'Step 2: Receive enquiries and offers',
      },
      {
        type: 'paragraph',
        text: 'Buyers can contact you through Equipd messaging or submit offers on your listing.',
      },
      {
        type: 'paragraph',
        text: 'You will receive notifications when:',
      },
      {
        type: 'list',
        items: [
          'A buyer sends a message',
          'An offer is received',
          'A counter offer is received',
          'An offer is accepted',
        ],
      },
      {
        type: 'paragraph',
        text: 'All communication should take place through Equipd where possible.',
      },
      {
        type: 'heading',
        text: 'Step 3: Accept an offer',
      },
      {
        type: 'paragraph',
        text: 'When you accept an offer:',
      },
      {
        type: 'list',
        items: [
          'The listing becomes reserved',
          'The buyer is invited to complete payment',
          'The order process begins',
        ],
      },
      {
        type: 'paragraph',
        text: 'The equipment should remain available until payment has been completed.',
      },
      {
        type: 'heading',
        text: 'Step 4: Arrange fulfilment',
      },
      {
        type: 'paragraph',
        text: 'Depending on the order type:',
      },
      {
        type: 'heading',
        text: 'Collection (in-person handover)',
      },
      {
        type: 'paragraph',
        text: 'Arrange a collection date and time with the buyer. The buyer inspects equipment and confirms handover via Equipd\'s QR confirmation system.',
      },
      {
        type: 'heading',
        text: 'Seller delivery (in-person handover)',
      },
      {
        type: 'paragraph',
        text: 'Arrange delivery directly with the buyer. After unloading, the buyer inspects the equipment and confirms receipt via Equipd\'s QR confirmation system. This follows the same handover model as collection.',
      },
      {
        type: 'heading',
        text: 'Buyer-arranged courier',
      },
      {
        type: 'paragraph',
        text: 'Coordinate with the buyer and courier to ensure collection can take place smoothly. Courier orders use handover evidence and delivery confirmation, not QR confirmation.',
      },
      {
        type: 'heading',
        text: 'Step 5: Buyer Protection period',
      },
      {
        type: 'paragraph',
        text: 'After handover is confirmed (via QR for in-person orders, or via delivery confirmation for courier orders), Buyer Protection becomes active.',
      },
      {
        type: 'paragraph',
        text: 'During this period:',
      },
      {
        type: 'list',
        items: [
          'Funds remain securely held',
          'Buyers may raise disputes if eligible',
          'Equipd may request additional information if needed',
        ],
      },
      {
        type: 'heading',
        text: 'Step 6: Receive your payout',
      },
      {
        type: 'paragraph',
        text: 'Once the order has been successfully completed and Buyer Protection requirements have been met, your payout is released to your connected Stripe account.',
      },
      {
        type: 'paragraph',
        text: 'You can monitor order and payout progress through your Hub.',
      },
      {
        type: 'heading',
        text: 'Best practices',
      },
      {
        type: 'paragraph',
        text: 'Successful sellers typically:',
      },
      {
        type: 'list',
        items: [
          'Provide accurate descriptions',
          'Respond promptly to buyers',
          'Upload high-quality photographs',
          'Disclose known faults',
          'Maintain clear communication',
        ],
      },
      {
        type: 'paragraph',
        text: 'Honest listings help create a better marketplace experience for everyone.',
      },
    ],
  },
  {
    slug: 'receiving-offers',
    title: 'Receiving Offers',
    category: 'selling',
    updatedAt: '2026-06-24',
    excerpt:
      'How offers and counter offers work on Equipd, and what happens when you accept, decline, or negotiate.',
    content: [
      {
        type: 'paragraph',
        text: 'Offers allow buyers and sellers to negotiate pricing directly through Equipd.',
      },
      {
        type: 'heading',
        text: 'How offers work',
      },
      {
        type: 'paragraph',
        text: 'When a buyer finds equipment they are interested in, they may choose to submit an offer instead of paying the listed price.',
      },
      {
        type: 'paragraph',
        text: 'The seller is then notified and can review the offer.',
      },
      {
        type: 'heading',
        text: 'Your options',
      },
      {
        type: 'paragraph',
        text: 'When an offer is received, you can:',
      },
      {
        type: 'heading',
        text: 'Accept',
      },
      {
        type: 'paragraph',
        text: 'Accepting an offer reserves the listing and allows the buyer to complete payment.',
      },
      {
        type: 'heading',
        text: 'Decline',
      },
      {
        type: 'paragraph',
        text: 'Declining an offer closes that negotiation.',
      },
      {
        type: 'paragraph',
        text: 'The buyer may still submit another offer in the future.',
      },
      {
        type: 'heading',
        text: 'Counter offer',
      },
      {
        type: 'paragraph',
        text: 'A counter offer allows you to suggest a different price.',
      },
      {
        type: 'paragraph',
        text: 'The buyer can then:',
      },
      {
        type: 'list',
        items: ['Accept', 'Decline', 'Submit another counter offer'],
      },
      {
        type: 'heading',
        text: 'When does an offer become a sale?',
      },
      {
        type: 'paragraph',
        text: 'An accepted offer does not immediately create a completed sale.',
      },
      {
        type: 'paragraph',
        text: 'The buyer must still:',
      },
      {
        type: 'list',
        items: ['Complete checkout', 'Successfully pay for the order'],
      },
      {
        type: 'paragraph',
        text: 'Only then does the order move into the fulfilment process.',
      },
      {
        type: 'heading',
        text: 'Best practices',
      },
      {
        type: 'paragraph',
        text: 'When reviewing offers, consider:',
      },
      {
        type: 'list',
        items: [
          'Equipment demand',
          'Listing age',
          'Current market value',
          'Collection or delivery requirements',
        ],
      },
      {
        type: 'paragraph',
        text: 'Responding promptly generally improves buyer confidence and increases the chance of completing a sale.',
      },
    ],
  },
  {
    slug: 'accepted-sales',
    title: 'Accepted Sales',
    category: 'selling',
    updatedAt: '2026-06-24',
    excerpt:
      'What happens after an offer is accepted and the buyer pays, including fulfilment and Buyer Protection.',
    content: [
      {
        type: 'paragraph',
        text: 'An accepted sale is created when:',
      },
      {
        type: 'list',
        items: [
          'A seller accepts an offer',
          'The buyer successfully completes payment',
        ],
      },
      {
        type: 'paragraph',
        text: 'At this stage the order moves into fulfilment.',
      },
      {
        type: 'heading',
        text: 'What happens next?',
      },
      {
        type: 'paragraph',
        text: 'The next steps depend on how the equipment will be transferred.',
      },
      {
        type: 'heading',
        text: 'In-person handover orders',
      },
      {
        type: 'paragraph',
        text: 'Collection and Seller Delivery both follow the same handover model:',
      },
      {
        type: 'list',
        items: [
          'Collection — buyer and seller arrange a collection date and time.',
          'Seller Delivery — seller delivers equipment to the buyer.',
          'Buyer inspects and tests equipment where practical.',
          'Buyer confirms handover via Equipd\'s QR confirmation system.',
        ],
      },
      {
        type: 'heading',
        text: 'Courier orders',
      },
      {
        type: 'paragraph',
        text: 'The buyer arranges a suitable courier. Handover evidence and delivery confirmation apply instead of QR confirmation.',
      },
      {
        type: 'heading',
        text: 'Buyer Protection',
      },
      {
        type: 'paragraph',
        text: 'After handover is confirmed (QR for in-person orders, delivery confirmation for courier orders), Buyer Protection becomes active for 24 hours.',
      },
      {
        type: 'paragraph',
        text: 'During this period:',
      },
      {
        type: 'list',
        items: [
          'Funds remain securely held',
          'Seller payouts are not yet released',
          'Eligible disputes may be raised',
        ],
      },
      {
        type: 'heading',
        text: 'Monitoring progress',
      },
      {
        type: 'paragraph',
        text: 'Order progress can be viewed through your Hub.',
      },
      {
        type: 'paragraph',
        text: "You'll be able to see:",
      },
      {
        type: 'list',
        items: [
          'Awaiting collection or seller delivery',
          'Awaiting courier collection',
          'Buyer Protection active',
          'Payout pending',
          'Completed',
        ],
      },
      {
        type: 'heading',
        text: 'Important',
      },
      {
        type: 'paragraph',
        text: 'Do not arrange payment outside Equipd.',
      },
      {
        type: 'paragraph',
        text: 'Keeping payments within Equipd ensures Buyer Protection and seller payout protections remain available.',
      },
    ],
  },
  {
    slug: 'getting-paid',
    title: 'Getting Paid',
    category: 'selling',
    updatedAt: '2026-06-24',
    excerpt:
      'How seller payouts work on Equipd, including Stripe setup, Buyer Protection holds, and payout timing.',
    content: [
      {
        type: 'paragraph',
        text: 'Equipd uses Stripe Connect to securely process seller payouts.',
      },
      {
        type: 'paragraph',
        text: 'This allows funds to be transferred safely while ensuring Buyer Protection remains active throughout the transaction.',
      },
      {
        type: 'heading',
        text: 'Before you can receive payouts',
      },
      {
        type: 'paragraph',
        text: 'Before funds can be released, you must complete Stripe payout setup.',
      },
      {
        type: 'paragraph',
        text: 'This information is required by Stripe and may include:',
      },
      {
        type: 'list',
        items: [
          'Your name',
          'Date of birth',
          'Address',
          'Bank account details',
          'Identity verification',
        ],
      },
      {
        type: 'paragraph',
        text: 'Until setup is complete, payouts cannot be released.',
      },
      {
        type: 'heading',
        text: 'How payouts work',
      },
      {
        type: 'paragraph',
        text: 'When a buyer completes payment:',
      },
      {
        type: 'list',
        items: [
          'Funds are securely held.',
          'Handover is completed (QR confirmation for in-person orders, or delivery confirmation for courier orders).',
          'Buyer Protection becomes active for 24 hours.',
          'Any disputes are resolved.',
          'Funds are released to the seller.',
        ],
      },
      {
        type: 'paragraph',
        text: 'This process helps protect both buyers and sellers.',
      },
      {
        type: 'heading',
        text: 'In-person handover orders',
      },
      {
        type: 'paragraph',
        text: 'For collection and seller delivery orders, Buyer Protection starts after the buyer confirms handover via QR. It remains active for 24 hours. If no dispute is raised, the order proceeds towards completion and payout release.',
      },
      {
        type: 'heading',
        text: 'Courier orders',
      },
      {
        type: 'paragraph',
        text: 'After delivery is confirmed, Buyer Protection remains active for 24 hours. If no dispute is raised, payout release can proceed.',
      },
      {
        type: 'heading',
        text: 'Delayed payouts',
      },
      {
        type: 'paragraph',
        text: 'Payouts may be delayed if:',
      },
      {
        type: 'list',
        items: [
          'Stripe verification is incomplete',
          'A dispute has been opened',
          'Additional information is required',
          'Buyer Protection requirements have not yet been met',
        ],
      },
      {
        type: 'heading',
        text: 'Checking payout status',
      },
      {
        type: 'paragraph',
        text: 'You can view payout and order progress at any time from your Hub.',
      },
      {
        type: 'paragraph',
        text: 'Statuses will update automatically as your transaction progresses.',
      },
    ],
  },
  {
    slug: 'buyer-protection-fee',
    title: 'Buyer Protection Fee',
    category: 'payments',
    updatedAt: '2026-06-24',
    excerpt:
      'What the Buyer Protection fee covers, how it is calculated, and what it includes at checkout.',
    content: [
      {
        type: 'paragraph',
        text: 'Equipd charges a Buyer Protection fee on purchases completed through the platform.',
      },
      {
        type: 'heading',
        text: 'Why is there a Buyer Protection fee?',
      },
      {
        type: 'paragraph',
        text: 'The fee helps fund the systems and services that make Equipd safer than traditional marketplaces.',
      },
      {
        type: 'paragraph',
        text: 'This includes:',
      },
      {
        type: 'list',
        items: [
          'Secure payment processing',
          'Buyer Protection',
          'Dispute resolution',
          'QR collection confirmation',
          'Courier evidence handling',
          'Platform support',
        ],
      },
      {
        type: 'heading',
        text: 'How much is the fee?',
      },
      {
        type: 'paragraph',
        text: 'Equipd currently charges a Buyer Protection fee of 5% of the item price.',
      },
      {
        type: 'paragraph',
        text: 'The fee is shown clearly before checkout so buyers know exactly what they are paying.',
      },
      {
        type: 'heading',
        text: 'What does the fee include?',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection may apply if:',
      },
      {
        type: 'list',
        items: [
          'An item does not arrive',
          'An item arrives damaged',
          'An item is significantly different from the listing description',
          'An item is not working as described',
        ],
      },
      {
        type: 'paragraph',
        text: 'The fee also supports the secure transaction process used throughout the platform.',
      },
      {
        type: 'heading',
        text: 'Does the seller receive the fee?',
      },
      {
        type: 'paragraph',
        text: 'No.',
      },
      {
        type: 'paragraph',
        text: "The Buyer Protection fee is separate from the seller's sale proceeds and is retained by Equipd.",
      },
      {
        type: 'heading',
        text: 'Learn more',
      },
      {
        type: 'paragraph',
        text: 'For full details, please see:',
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Buyer Protection', to: '/help/buyer-protection' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } }],
      },
      {
        type: 'paragraph',
        segments: [
          {
            link: {
              label: 'Collection & Seller Delivery Orders',
              to: '/help/collection-orders',
            },
          },
        ],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Courier Orders', to: '/help/courier-orders' } }],
      },
    ],
  },
  {
    slug: 'seller-payouts',
    title: 'Seller Payouts',
    category: 'payments',
    updatedAt: '2026-06-24',
    excerpt:
      'Why Equipd holds seller payouts, when funds are released, and how disputes affect payout timing.',
    content: [
      {
        type: 'paragraph',
        text: 'Seller payouts are processed securely through Stripe Connect.',
      },
      {
        type: 'heading',
        text: 'Why payouts are held',
      },
      {
        type: 'paragraph',
        text: 'Unlike traditional marketplaces, Equipd does not immediately release funds after payment.',
      },
      {
        type: 'paragraph',
        text: 'Funds remain securely held while:',
      },
      {
        type: 'list',
        items: [
          'Collection or in-person handover takes place',
          'Buyer Protection remains active',
          'Any disputes are reviewed',
        ],
      },
      {
        type: 'paragraph',
        text: 'This helps create a safer marketplace for both buyers and sellers.',
      },
      {
        type: 'heading',
        text: 'Payout release',
      },
      {
        type: 'paragraph',
        text: 'Payouts are released once:',
      },
      {
        type: 'list',
        items: [
          'The order has been successfully fulfilled',
          'Buyer Protection requirements have been satisfied',
          'No active dispute is preventing payout',
        ],
      },
      {
        type: 'paragraph',
        text: 'Once released, Stripe transfers the funds to your connected bank account.',
      },
      {
        type: 'heading',
        text: 'Active disputes',
      },
      {
        type: 'paragraph',
        text: 'If a dispute is opened:',
      },
      {
        type: 'list',
        items: [
          'Payout release is paused',
          'The order enters dispute review',
          'Equipd may request information from both parties',
        ],
      },
      {
        type: 'paragraph',
        text: 'Payouts cannot be released while a dispute remains unresolved.',
      },
      {
        type: 'heading',
        text: 'Stripe processing times',
      },
      {
        type: 'paragraph',
        text: 'After Equipd releases a payout, Stripe may require additional time to process and transfer funds.',
      },
      {
        type: 'paragraph',
        text: 'Processing times vary depending on your bank and Stripe account status.',
      },
      {
        type: 'heading',
        text: 'Important',
      },
      {
        type: 'paragraph',
        text: 'Always ensure your Stripe account information is accurate and up to date.',
      },
      {
        type: 'paragraph',
        text: 'Incomplete payout information may delay the transfer of funds.',
      },
    ],
  },
  {
    slug: 'stripe-payout-setup',
    title: 'Stripe payout setup',
    category: 'payments',
    updatedAt: '2026-06-01',
    excerpt: 'Connect Stripe to receive seller payouts on Equipd.',
    content: [
      {
        type: 'paragraph',
        text: 'Equipd uses Stripe to process payments and send seller payouts securely. Complete Stripe onboarding from Settings before your first sale.',
      },
      {
        type: 'list',
        items: [
          'Open Settings and follow the Stripe Connect setup flow.',
          'Provide the details Stripe requires for identity and payout verification.',
          'Return to Equipd once setup is complete.',
        ],
      },
    ],
  },
  {
    slug: 'creating-an-account',
    title: 'Creating an Account',
    category: 'account',
    updatedAt: '2026-06-24',
    excerpt:
      'How to register for an Equipd account, set your location, and complete your profile.',
    content: [
      {
        type: 'paragraph',
        text: 'Creating an Equipd account is free and only takes a few minutes.',
      },
      {
        type: 'heading',
        text: 'Registering',
      },
      {
        type: 'paragraph',
        text: 'To create an account:',
      },
      {
        type: 'list',
        items: [
          'Select Sign Up.',
          'Enter your details.',
          'Verify your email address.',
          'Complete your profile.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Once registered, you can begin browsing, buying, and selling immediately.',
      },
      {
        type: 'heading',
        text: 'Choosing your location',
      },
      {
        type: 'paragraph',
        text: 'Your location helps Equipd show relevant equipment nearby.',
      },
      {
        type: 'paragraph',
        text: 'This location is also used when sorting listings by distance.',
      },
      {
        type: 'paragraph',
        text: 'You can update your location at any time from your account settings.',
      },
      {
        type: 'heading',
        text: 'Profile information',
      },
      {
        type: 'paragraph',
        text: 'We recommend completing your profile to help build trust within the marketplace.',
      },
      {
        type: 'paragraph',
        text: 'This may include:',
      },
      {
        type: 'list',
        items: ['Profile picture', 'Display name', 'Location'],
      },
      {
        type: 'heading',
        text: 'Account security',
      },
      {
        type: 'paragraph',
        text: 'Keep your login details secure and never share your password with anyone.',
      },
      {
        type: 'paragraph',
        text: 'Equipd staff will never ask for your password.',
      },
      {
        type: 'heading',
        text: 'Need help?',
      },
      {
        type: 'paragraph',
        text: "If you're experiencing problems creating an account, please contact Equipd support.",
      },
    ],
  },
  {
    slug: 'account-settings',
    title: 'Account Settings',
    category: 'account',
    updatedAt: '2026-06-24',
    excerpt:
      'Manage your Equipd profile, location, notifications, Stripe payouts, and account security.',
    content: [
      {
        type: 'paragraph',
        text: 'Your account settings allow you to manage your profile, preferences, and payout information.',
      },
      {
        type: 'heading',
        text: 'Updating your profile',
      },
      {
        type: 'paragraph',
        text: 'You can update:',
      },
      {
        type: 'list',
        items: [
          'Display name',
          'Profile picture',
          'Location',
          'Contact preferences',
        ],
      },
      {
        type: 'paragraph',
        text: 'Keeping your information up to date helps improve your experience on Equipd.',
      },
      {
        type: 'heading',
        text: 'Location settings',
      },
      {
        type: 'paragraph',
        text: 'Your saved location is used for:',
      },
      {
        type: 'list',
        items: [
          'Distance-based search results',
          'Nearest-first sorting',
          'Local marketplace discovery',
        ],
      },
      {
        type: 'paragraph',
        text: 'You can change your location at any time.',
      },
      {
        type: 'heading',
        text: 'Notifications',
      },
      {
        type: 'paragraph',
        text: 'Notification settings allow you to manage updates relating to:',
      },
      {
        type: 'list',
        items: ['Messages', 'Offers', 'Orders', 'Buyer Protection cases'],
      },
      {
        type: 'heading',
        text: 'Stripe payouts',
      },
      {
        type: 'paragraph',
        text: 'Sellers can also manage payout information through their connected Stripe account.',
      },
      {
        type: 'paragraph',
        text: 'If payout setup is incomplete, Equipd will guide you through the remaining steps.',
      },
      {
        type: 'heading',
        text: 'Security',
      },
      {
        type: 'paragraph',
        text: 'If you believe your account has been accessed without permission, contact Equipd support immediately.',
      },
    ],
  },
  {
    slug: 'updating-default-location',
    title: 'Updating Your Location',
    category: 'account',
    updatedAt: '2026-06-24',
    excerpt:
      'How your saved location affects search and sorting, and how to update it on Equipd.',
    content: [
      {
        type: 'paragraph',
        text: 'Your saved location helps Equipd show equipment that is relevant to your area.',
      },
      {
        type: 'heading',
        text: 'Why your location matters',
      },
      {
        type: 'paragraph',
        text: 'Your location is used for:',
      },
      {
        type: 'list',
        items: [
          'Nearest-first sorting',
          'Distance calculations',
          'Local equipment discovery',
        ],
      },
      {
        type: 'paragraph',
        text: 'Providing an accurate location helps improve search results.',
      },
      {
        type: 'heading',
        text: 'Updating your location',
      },
      {
        type: 'paragraph',
        text: 'To update your location:',
      },
      {
        type: 'list',
        items: [
          'Open Account Settings.',
          'Select your location field.',
          'Search for your new location.',
          'Save your changes.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Your new location will be used immediately throughout the platform.',
      },
      {
        type: 'heading',
        text: 'Moving to a new area',
      },
      {
        type: 'paragraph',
        text: 'If you relocate, we recommend updating your location as soon as possible to keep local search results accurate.',
      },
      {
        type: 'heading',
        text: 'Privacy',
      },
      {
        type: 'paragraph',
        text: 'Equipd uses location information to improve marketplace functionality.',
      },
      {
        type: 'paragraph',
        text: 'Your exact address is not displayed publicly to other users unless specifically shared as part of a transaction.',
      },
    ],
  },
  {
    slug: 'profile-pictures',
    title: 'Profile Pictures',
    category: 'account',
    updatedAt: '2026-06-24',
    excerpt:
      'Why profile pictures matter on Equipd and how to upload, change, or remove yours.',
    content: [
      {
        type: 'paragraph',
        text: 'Adding a profile picture helps build trust between buyers and sellers.',
      },
      {
        type: 'heading',
        text: 'Why add a profile picture?',
      },
      {
        type: 'paragraph',
        text: 'Profiles with pictures often feel more trustworthy and personal.',
      },
      {
        type: 'paragraph',
        text: 'A profile picture can help buyers and sellers feel more confident when communicating through Equipd.',
      },
      {
        type: 'heading',
        text: 'Uploading a picture',
      },
      {
        type: 'paragraph',
        text: 'You can upload a profile picture from your account settings.',
      },
      {
        type: 'paragraph',
        text: 'Supported image formats may include:',
      },
      {
        type: 'list',
        items: ['JPG', 'JPEG', 'PNG', 'WEBP'],
      },
      {
        type: 'heading',
        text: 'Choosing a suitable image',
      },
      {
        type: 'paragraph',
        text: 'We recommend using:',
      },
      {
        type: 'list',
        items: [
          'A clear photograph',
          'A professional image',
          'A recent picture',
        ],
      },
      {
        type: 'paragraph',
        text: 'Avoid:',
      },
      {
        type: 'list',
        items: [
          'Offensive content',
          'Copyrighted images you do not own',
          'Images that violate Equipd policies',
        ],
      },
      {
        type: 'heading',
        text: 'Changing or removing your picture',
      },
      {
        type: 'paragraph',
        text: 'You can update or replace your profile picture at any time through account settings.',
      },
    ],
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    category: 'policies',
    updatedAt: '2026-06-01',
    excerpt:
      'Equipd Terms & Conditions governing use of the marketplace, Buyer Protection, payments, listings, disputes, and account responsibilities.',
    content: [
      {
        type: 'heading',
        text: '1. Introduction',
      },
      {
        type: 'paragraph',
        text: 'Welcome to Equipd.',
      },
      {
        type: 'paragraph',
        text: 'These Terms & Conditions govern your use of the Equipd platform, including our website, services, Buyer Protection programme, messaging system, payment processing, and marketplace features.',
      },
      {
        type: 'paragraph',
        text: 'By creating an account, browsing listings, buying equipment, selling equipment, or otherwise using Equipd, you agree to be bound by these Terms.',
      },
      {
        type: 'paragraph',
        text: 'If you do not agree with these Terms, you must not use Equipd.',
      },
      {
        type: 'heading',
        text: '2. About Equipd',
      },
      {
        type: 'paragraph',
        text: 'Equipd is an online marketplace that connects buyers and sellers of used gym equipment.',
      },
      {
        type: 'paragraph',
        text: 'Equipd is not the owner, seller, reseller, manufacturer, or supplier of equipment listed on the platform unless explicitly stated otherwise.',
      },
      {
        type: 'paragraph',
        text: 'Contracts for the sale of equipment are formed directly between buyers and sellers.',
      },
      {
        type: 'paragraph',
        text: 'Equipd facilitates:',
      },
      {
        type: 'list',
        items: [
          'Listings',
          'Messaging',
          'Offers',
          'Payments',
          'Buyer Protection',
          'Dispute resolution',
          'Order management',
        ],
      },
      {
        type: 'heading',
        text: '3. Eligibility',
      },
      {
        type: 'paragraph',
        text: 'You must be at least 18 years old to create an account or use Equipd.',
      },
      {
        type: 'paragraph',
        text: 'By using Equipd, you confirm that:',
      },
      {
        type: 'list',
        items: [
          'You are at least 18 years old.',
          'You have the legal capacity to enter into binding agreements.',
          'All information you provide is accurate and up to date.',
        ],
      },
      {
        type: 'heading',
        text: '4. User Accounts',
      },
      {
        type: 'paragraph',
        text: 'You are responsible for:',
      },
      {
        type: 'list',
        items: [
          'Maintaining the security of your account.',
          'Keeping your login details confidential.',
          'Ensuring information on your account remains accurate.',
        ],
      },
      {
        type: 'paragraph',
        text: 'You must not:',
      },
      {
        type: 'list',
        items: [
          'Create fraudulent accounts.',
          'Impersonate another person or business.',
          'Use Equipd for unlawful purposes.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd may suspend or permanently remove accounts that violate these Terms.',
      },
      {
        type: 'heading',
        text: '5. Listings',
      },
      {
        type: 'paragraph',
        text: 'Sellers are responsible for ensuring listings are accurate and truthful.',
      },
      {
        type: 'paragraph',
        text: 'Listings should accurately describe:',
      },
      {
        type: 'list',
        items: [
          'Condition',
          'Functionality',
          'Age, where known',
          'Included accessories',
          'Known faults or defects',
          'Delivery or collection arrangements',
        ],
      },
      {
        type: 'paragraph',
        text: 'Sellers must have the legal right to sell any equipment listed.',
      },
      {
        type: 'paragraph',
        text: 'Equipd may remove listings that:',
      },
      {
        type: 'list',
        items: [
          'Appear fraudulent',
          'Breach applicable laws',
          'Violate platform policies',
          'Misrepresent equipment',
        ],
      },
      {
        type: 'heading',
        text: '6. Buying Equipment',
      },
      {
        type: 'paragraph',
        text: 'Buyers may browse listings, contact sellers through Equipd, and make offers.',
      },
      {
        type: 'paragraph',
        text: "Once an offer is accepted and payment is completed, the order becomes subject to Equipd's Buyer Protection process and order fulfilment procedures.",
      },
      {
        type: 'paragraph',
        text: 'Buyers should carefully review listings before purchasing.',
      },
      {
        type: 'heading',
        text: '7. Payments',
      },
      {
        type: 'paragraph',
        text: 'All payments must be made through Equipd.',
      },
      {
        type: 'paragraph',
        text: 'Payments are securely processed by trusted payment providers, including Stripe.',
      },
      {
        type: 'paragraph',
        text: 'Buyers and sellers must not attempt to arrange payment outside the platform.',
      },
      {
        type: 'paragraph',
        text: 'Transactions completed outside Equipd:',
      },
      {
        type: 'list',
        items: [
          'Are not covered by Buyer Protection.',
          'Are not covered by Equipd dispute resolution processes.',
          "Are undertaken entirely at the users' own risk.",
        ],
      },
      {
        type: 'heading',
        text: '8. Off-Platform Transactions',
      },
      {
        type: 'paragraph',
        text: 'Users must not attempt to bypass Equipd by:',
      },
      {
        type: 'list',
        items: [
          'Requesting payment outside the platform.',
          'Sharing payment details before payment has been completed.',
          'Encouraging another user to complete a transaction elsewhere.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Contact details may only be exchanged once payment has been completed through Equipd and where necessary to fulfil the order.',
      },
      {
        type: 'paragraph',
        text: 'Attempting to move transactions off-platform may result in:',
      },
      {
        type: 'list',
        items: [
          'Listing removal',
          'Account suspension',
          'Permanent account closure',
        ],
      },
      {
        type: 'heading',
        text: '9. Buyer Protection',
      },
      {
        type: 'paragraph',
        text: 'Eligible purchases completed through Equipd are covered by Buyer Protection.',
      },
      {
        type: 'paragraph',
        text: 'A Buyer Protection fee is charged at checkout.',
      },
      {
        type: 'paragraph',
        text: 'Buyer Protection helps provide:',
      },
      {
        type: 'list',
        items: [
          'Secure payments',
          'Dispute resolution',
          'Payment holding',
          'Order verification processes',
        ],
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'Full details can be found in the ' },
          { link: { label: 'Buyer Protection', to: '/help/buyer-protection' } },
          { text: ' article and ' },
          { link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } },
          { text: ' article.' },
        ],
      },
      {
        type: 'heading',
        text: '10. Collection & Seller Delivery Orders',
      },
      {
        type: 'paragraph',
        text: 'Collection and Seller Delivery orders are treated as in-person handover transactions.',
      },
      {
        type: 'paragraph',
        text: 'Collection Orders:',
      },
      {
        type: 'list',
        items: [
          'Buyer travels to the seller.',
          'Buyer inspects equipment.',
          'Buyer confirms receipt via Equipd QR confirmation.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Seller Delivery Orders:',
      },
      {
        type: 'list',
        items: [
          'Seller delivers equipment to the buyer.',
          'Buyer inspects equipment after unloading.',
          'Buyer confirms receipt via Equipd QR confirmation.',
        ],
      },
      {
        type: 'paragraph',
        text: 'For both order types:',
      },
      {
        type: 'list',
        items: [
          'Buyers should inspect and test equipment where practical before confirming receipt.',
          'Buyer Protection begins after QR confirmation.',
          'Seller payouts remain on hold during the Buyer Protection period.',
        ],
      },
      {
        type: 'heading',
        text: '11. Courier Orders',
      },
      {
        type: 'paragraph',
        text: 'For courier orders:',
      },
      {
        type: 'list',
        items: [
          'Collection and delivery evidence may be required.',
          'Delivery confirmation is used to progress the order.',
          'Buyer Protection begins after delivery confirmation.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Additional evidence may be requested during dispute investigations.',
      },
      {
        type: 'heading',
        text: '12. Disputes & Returns',
      },
      {
        type: 'paragraph',
        text: 'If a buyer believes an eligible issue exists, they may open a dispute during the applicable Buyer Protection period.',
      },
      {
        type: 'paragraph',
        text: 'Equipd may request:',
      },
      {
        type: 'list',
        items: [
          'Photographs',
          'Videos',
          'Screenshots',
          'Courier evidence',
          'Additional supporting information',
        ],
      },
      {
        type: 'paragraph',
        text: 'Users agree to cooperate with reasonable requests during dispute investigations.',
      },
      {
        type: 'paragraph',
        segments: [
          { text: 'Full details can be found in the ' },
          { link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } },
          { text: ' article.' },
        ],
      },
      {
        type: 'heading',
        text: '13. Seller Payouts',
      },
      {
        type: 'paragraph',
        text: 'Seller payouts are processed through Stripe Connect.',
      },
      {
        type: 'paragraph',
        text: 'Funds may be held while:',
      },
      {
        type: 'list',
        items: [
          'Buyer Protection remains active.',
          'Disputes are under review.',
          'Verification requirements are incomplete.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd is not responsible for delays caused by banking providers, payment processors, or verification requirements.',
      },
      {
        type: 'heading',
        text: '14. Prohibited Items',
      },
      {
        type: 'paragraph',
        text: 'Users must not list:',
      },
      {
        type: 'list',
        items: [
          'Stolen property',
          'Counterfeit goods',
          'Illegal items',
          'Dangerous or prohibited products',
          'Items they do not have the legal right to sell',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd reserves the right to remove prohibited listings without notice.',
      },
      {
        type: 'heading',
        text: '15. Platform Availability',
      },
      {
        type: 'paragraph',
        text: 'While we aim to keep Equipd available at all times, we do not guarantee uninterrupted access.',
      },
      {
        type: 'paragraph',
        text: 'We may:',
      },
      {
        type: 'list',
        items: [
          'Perform maintenance',
          'Update platform features',
          'Suspend services where necessary',
        ],
      },
      {
        type: 'paragraph',
        text: 'without prior notice.',
      },
      {
        type: 'heading',
        text: '16. Limitation of Liability',
      },
      {
        type: 'paragraph',
        text: 'To the fullest extent permitted by law, Equipd shall not be liable for:',
      },
      {
        type: 'list',
        items: [
          'Loss of profits',
          'Indirect losses',
          'Consequential losses',
          'User-to-user disputes',
          'Misrepresentations made by users',
        ],
      },
      {
        type: 'paragraph',
        text: 'Nothing in these Terms excludes liability that cannot legally be excluded under applicable law.',
      },
      {
        type: 'heading',
        text: '17. Account Suspension & Termination',
      },
      {
        type: 'paragraph',
        text: 'Equipd may suspend or permanently terminate accounts that:',
      },
      {
        type: 'list',
        items: [
          'Breach these Terms.',
          'Engage in fraud.',
          'Abuse platform features.',
          'Attempt to move transactions off-platform.',
          'Provide false information.',
          'Repeatedly violate marketplace policies.',
        ],
      },
      {
        type: 'paragraph',
        text: 'We may remove listings and restrict access where necessary to protect the platform and its users.',
      },
      {
        type: 'heading',
        text: '18. Changes to These Terms',
      },
      {
        type: 'paragraph',
        text: 'Equipd may update these Terms from time to time.',
      },
      {
        type: 'paragraph',
        text: 'Continued use of the platform after changes take effect constitutes acceptance of the updated Terms.',
      },
      {
        type: 'heading',
        text: '19. Governing Law',
      },
      {
        type: 'paragraph',
        text: 'These Terms are governed by the laws of England and Wales.',
      },
      {
        type: 'paragraph',
        text: 'Any dispute arising in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.',
      },
      {
        type: 'heading',
        text: '20. Contact Us',
      },
      {
        type: 'paragraph',
        text: 'If you have any questions regarding these Terms, please contact Equipd support through the platform.',
      },
      {
        type: 'paragraph',
        text: 'Relevant policies:',
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Buyer Protection', to: '/help/buyer-protection' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Privacy Policy', to: '/help/privacy-policy' } }],
      },
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    category: 'policies',
    updatedAt: '2026-06-01',
    excerpt:
      'How Equipd collects, uses, stores, and protects your personal information, including account data, payments, messaging, and Buyer Protection.',
    content: [
      {
        type: 'heading',
        text: '1. Introduction',
      },
      {
        type: 'paragraph',
        text: 'Equipd is committed to protecting your privacy and handling your personal information responsibly.',
      },
      {
        type: 'paragraph',
        text: 'This Privacy Policy explains what information we collect, how we use it, who we share it with, and the rights you have regarding your personal information.',
      },
      {
        type: 'paragraph',
        text: 'By creating an account or using Equipd, you agree to the collection and use of information in accordance with this Privacy Policy.',
      },
      {
        type: 'paragraph',
        text: 'If you do not agree with this Privacy Policy, you should not use the platform.',
      },
      {
        type: 'heading',
        text: '2. Who We Are',
      },
      {
        type: 'paragraph',
        text: 'Equipd is an online marketplace that connects buyers and sellers of used gym equipment.',
      },
      {
        type: 'paragraph',
        text: 'For the purposes of UK data protection law, Equipd is the data controller responsible for the personal information described in this Privacy Policy.',
      },
      {
        type: 'heading',
        text: '3. Information We Collect',
      },
      {
        type: 'paragraph',
        text: 'We may collect the following information when you use Equipd.',
      },
      {
        type: 'heading',
        text: 'Account Information',
      },
      {
        type: 'paragraph',
        text: 'When creating an account, we may collect:',
      },
      {
        type: 'list',
        items: [
          'Name',
          'Email address',
          'Username or display name',
          'Profile picture',
          'Location',
        ],
      },
      {
        type: 'heading',
        text: 'Marketplace Activity',
      },
      {
        type: 'paragraph',
        text: 'When using Equipd, we may collect:',
      },
      {
        type: 'list',
        items: [
          'Listings you create',
          'Messages sent through the platform',
          'Offers submitted or received',
          'Saved listings',
          'Order history',
          'Buyer Protection cases',
          'Dispute information',
        ],
      },
      {
        type: 'heading',
        text: 'Payment Information',
      },
      {
        type: 'paragraph',
        text: 'Payments are processed by Stripe and other trusted payment providers.',
      },
      {
        type: 'paragraph',
        text: 'We may receive information such as:',
      },
      {
        type: 'list',
        items: [
          'Payment status',
          'Transaction identifiers',
          'Payout status',
          'Stripe account information',
        ],
      },
      {
        type: 'paragraph',
        text: 'Equipd does not store full payment card details.',
      },
      {
        type: 'heading',
        text: 'Technical Information',
      },
      {
        type: 'paragraph',
        text: 'We may automatically collect:',
      },
      {
        type: 'list',
        items: [
          'IP address',
          'Browser type',
          'Device information',
          'Operating system',
          'Website usage information',
          'Log and diagnostic information',
        ],
      },
      {
        type: 'heading',
        text: '4. How We Use Your Information',
      },
      {
        type: 'paragraph',
        text: 'We use personal information to:',
      },
      {
        type: 'list',
        items: [
          'Create and manage user accounts',
          'Facilitate buying and selling transactions',
          'Process payments and payouts',
          'Provide Buyer Protection services',
          'Operate messaging features',
          'Investigate disputes',
          'Detect fraud and abuse',
          'Improve platform functionality',
          'Provide customer support',
          'Comply with legal obligations',
        ],
      },
      {
        type: 'paragraph',
        text: 'We only use personal information where we have a lawful basis to do so.',
      },
      {
        type: 'heading',
        text: '5. Location Information',
      },
      {
        type: 'paragraph',
        text: 'Equipd uses location information to improve marketplace functionality.',
      },
      {
        type: 'paragraph',
        text: 'Your location may be used to:',
      },
      {
        type: 'list',
        items: [
          'Show relevant equipment nearby',
          'Calculate approximate distances',
          'Power nearest-first search and sorting',
          'Improve local marketplace discovery',
        ],
      },
      {
        type: 'paragraph',
        text: 'Your exact address is not publicly displayed to other users unless it is shared as part of an order fulfilment process.',
      },
      {
        type: 'paragraph',
        text: 'You can update your location at any time through your account settings.',
      },
      {
        type: 'heading',
        text: '6. Payments & Stripe',
      },
      {
        type: 'paragraph',
        text: 'Equipd uses Stripe and other trusted payment providers to process payments securely.',
      },
      {
        type: 'paragraph',
        text: 'When making purchases or receiving payouts, certain information may be shared with Stripe, including:',
      },
      {
        type: 'list',
        items: [
          'Name',
          'Contact details',
          'Transaction information',
          'Verification information',
          'Bank account details for payouts',
        ],
      },
      {
        type: 'paragraph',
        text: 'Stripe is responsible for processing this information in accordance with its own privacy practices.',
      },
      {
        type: 'paragraph',
        text: 'Equipd does not store full card details.',
      },
      {
        type: 'heading',
        text: '7. Messages & Communications',
      },
      {
        type: 'paragraph',
        text: 'Equipd provides messaging features to allow buyers and sellers to communicate.',
      },
      {
        type: 'paragraph',
        text: 'Messages sent through Equipd may be stored and processed for purposes including:',
      },
      {
        type: 'list',
        items: [
          'Providing messaging functionality',
          'Investigating disputes',
          'Fraud prevention',
          'Enforcing marketplace rules',
          'Customer support',
        ],
      },
      {
        type: 'paragraph',
        text: 'Users should avoid sharing sensitive personal information unless necessary to complete a transaction.',
      },
      {
        type: 'heading',
        text: '8. Buyer Protection & Disputes',
      },
      {
        type: 'paragraph',
        text: 'When a dispute is raised, Equipd may collect and review additional information, including:',
      },
      {
        type: 'list',
        items: [
          'Photographs',
          'Videos',
          'Screenshots',
          'Courier evidence',
          'Order information',
          'Communication records',
        ],
      },
      {
        type: 'paragraph',
        text: 'This information may be used to:',
      },
      {
        type: 'list',
        items: [
          'Investigate claims',
          'Verify evidence',
          'Resolve disputes',
          'Prevent fraud',
          'Enforce platform policies',
        ],
      },
      {
        type: 'paragraph',
        text: 'By using Equipd, you acknowledge that information submitted as part of a dispute may be reviewed by Equipd support staff.',
      },
      {
        type: 'heading',
        text: '9. Marketplace Safety & Fraud Prevention',
      },
      {
        type: 'paragraph',
        text: 'Protecting users and maintaining trust on the platform is important to us.',
      },
      {
        type: 'paragraph',
        text: 'We may use information relating to:',
      },
      {
        type: 'list',
        items: [
          'Listings',
          'Messages',
          'Offers',
          'Orders',
          'QR confirmations',
          'Courier evidence',
          'Buyer Protection claims',
        ],
      },
      {
        type: 'paragraph',
        text: 'to:',
      },
      {
        type: 'list',
        items: [
          'Detect suspicious activity',
          'Investigate fraud',
          'Enforce marketplace rules',
          'Protect users',
          'Improve platform security',
        ],
      },
      {
        type: 'paragraph',
        text: 'Where necessary, accounts may be restricted, suspended or permanently removed.',
      },
      {
        type: 'heading',
        text: '10. Sharing Your Information',
      },
      {
        type: 'paragraph',
        text: 'We may share information with:',
      },
      {
        type: 'heading',
        text: 'Service Providers',
      },
      {
        type: 'paragraph',
        text: 'Trusted third-party providers who help us operate Equipd, including:',
      },
      {
        type: 'list',
        items: [
          'Payment processors',
          'Hosting providers',
          'Analytics providers',
          'Customer support tools',
        ],
      },
      {
        type: 'heading',
        text: 'Legal Requirements',
      },
      {
        type: 'paragraph',
        text: 'We may disclose information where required by:',
      },
      {
        type: 'list',
        items: [
          'Law',
          'Court order',
          'Regulatory authority',
          'Law enforcement agency',
        ],
      },
      {
        type: 'heading',
        text: 'Business Transfers',
      },
      {
        type: 'paragraph',
        text: 'If Equipd is sold, merged, reorganised or transferred, relevant information may form part of that transaction.',
      },
      {
        type: 'heading',
        text: 'What We Do Not Do',
      },
      {
        type: 'paragraph',
        text: 'We do not sell your personal information to third parties.',
      },
      {
        type: 'heading',
        text: '11. Data Retention',
      },
      {
        type: 'paragraph',
        text: 'We retain information only for as long as necessary to:',
      },
      {
        type: 'list',
        items: [
          'Provide our services',
          'Process transactions',
          'Resolve disputes',
          'Prevent fraud',
          'Comply with legal obligations',
          'Enforce our agreements',
        ],
      },
      {
        type: 'paragraph',
        text: 'Retention periods may vary depending on the type of information and legal requirements.',
      },
      {
        type: 'heading',
        text: '12. Your Rights',
      },
      {
        type: 'paragraph',
        text: 'Depending on your circumstances, you may have rights under UK data protection laws, including the right to:',
      },
      {
        type: 'list',
        items: [
          'Access your personal information',
          'Correct inaccurate information',
          'Request deletion of information',
          'Restrict certain processing',
          'Object to certain processing',
          'Request a copy of your information',
          'Withdraw consent where applicable',
        ],
      },
      {
        type: 'paragraph',
        text: 'Some rights may be subject to legal limitations or exemptions.',
      },
      {
        type: 'heading',
        text: '13. Cookies & Similar Technologies',
      },
      {
        type: 'paragraph',
        text: 'Equipd uses cookies and similar browser storage (such as local storage and session storage) to run the marketplace, keep you signed in, and remember your cookie choices.',
      },
      {
        type: 'paragraph',
        text: 'Optional analytics and marketing technologies are not loaded unless you consent. For full details, see our Cookie Policy.',
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Cookie Policy', to: '/help/cookie-policy' } }],
      },
      {
        type: 'paragraph',
        text: 'You can change optional cookie categories at any time using Cookie Settings in the site footer or in Account Settings under Privacy & cookies. You can also control cookies through your browser, although some features may not work correctly if necessary storage is blocked.',
      },
      {
        type: 'heading',
        text: '14. Security',
      },
      {
        type: 'paragraph',
        text: 'We take reasonable technical and organisational measures to protect personal information.',
      },
      {
        type: 'paragraph',
        text: 'However, no internet-based service can guarantee absolute security.',
      },
      {
        type: 'paragraph',
        text: 'Users are responsible for maintaining the security of their accounts and passwords.',
      },
      {
        type: 'paragraph',
        text: 'If you believe your account has been compromised, please contact Equipd support immediately.',
      },
      {
        type: 'heading',
        text: "15. Children's Privacy",
      },
      {
        type: 'paragraph',
        text: 'Equipd is intended for users aged 18 and over.',
      },
      {
        type: 'paragraph',
        text: 'We do not knowingly collect personal information from individuals under the age of 18.',
      },
      {
        type: 'paragraph',
        text: 'If we become aware that information has been collected from a person under 18, we may remove the account and associated information.',
      },
      {
        type: 'heading',
        text: '16. Changes to This Privacy Policy',
      },
      {
        type: 'paragraph',
        text: 'We may update this Privacy Policy from time to time.',
      },
      {
        type: 'paragraph',
        text: 'When changes are made, the updated version will be published on Equipd and the "Last updated" date will be revised.',
      },
      {
        type: 'paragraph',
        text: 'Continued use of Equipd after changes take effect constitutes acceptance of the updated Privacy Policy.',
      },
      {
        type: 'heading',
        text: '17. Contact Us',
      },
      {
        type: 'paragraph',
        text: 'If you have questions about this Privacy Policy or how your information is handled, please contact Equipd support through the platform.',
      },
      {
        type: 'paragraph',
        text: 'Related policies:',
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Terms & Conditions', to: '/help/terms-and-conditions' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Buyer Protection', to: '/help/buyer-protection' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Refunds & Returns', to: '/help/refunds-and-returns' } }],
      },
    ],
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    category: 'Policies',
    updatedAt: '2026-06-24',
    excerpt:
      'How Equipd uses cookies and browser storage, what categories we offer, and how to manage your consent preferences.',
    content: [
      {
        type: 'paragraph',
        text: 'This Cookie Policy explains how Equipd uses cookies and similar technologies (including local storage and session storage) on equipd.com and related pages.',
      },
      {
        type: 'paragraph',
        text: 'When you first visit Equipd, we show a cookie banner and ask for your consent before loading optional cookies or third-party analytics or marketing scripts. Optional categories are not activated unless you choose to allow them. You can change your choices at any time using Cookie Settings in the site footer or in Account Settings under Privacy & cookies.',
      },
      {
        type: 'heading',
        text: 'How consent works',
      },
      {
        type: 'paragraph',
        text: 'Your choices are saved on your device in local storage under the key equipd_cookie_consent. The record includes which categories you enabled, the date you consented, and a consent version number. If we materially change how cookies are used, we may update the consent version and ask for your choices again.',
      },
      {
        type: 'paragraph',
        text: 'Equipd does not load optional analytics or marketing scripts before you give consent. Third-party tools such as Google Analytics, Microsoft Clarity, or Meta Pixel are not active on Equipd today.',
      },
      {
        type: 'heading',
        text: 'Cookie categories',
      },
      {
        type: 'paragraph',
        text: 'Cookie Settings groups technologies into the categories below. Only Necessary storage is always active.',
      },
      {
        type: 'list',
        items: [
          'Necessary — required for sign-in, security, checkout, payments hand-off, and remembering your cookie choices. Always enabled.',
          'Analytics — optional. Reserved for understanding how the site is used so we can improve Equipd. Not currently loaded; will only run if you consent when enabled in future.',
          'Marketing — optional. Reserved for measuring advertising and relevant promotions. Not currently loaded; will only run if you consent when enabled in future.',
          'Preferences — optional. Reserved for remembering choices such as saved filters or layout preferences beyond basic site operation. Not currently used for separate tracking cookies.',
        ],
      },
      {
        type: 'heading',
        text: 'Storage we use today',
      },
      {
        type: 'paragraph',
        text: 'The table below describes cookies and similar storage Equipd sets or relies on at the time of this policy. Names may include dynamic suffixes (for example, a Supabase project reference or conversation id).',
      },
      {
        type: 'heading',
        text: 'Necessary',
      },
      {
        type: 'list',
        items: [
          'Supabase authentication session (local storage) — keeps you signed in securely between visits.',
          'equipd_cookie_consent (local storage) — stores your cookie consent version, consent date, and enabled categories.',
          'equipd:message-safety-dismissed:* (session storage) — remembers that you dismissed the marketplace safety notice in a message thread.',
        ],
      },
      {
        type: 'heading',
        text: 'Operational session and local storage',
      },
      {
        type: 'paragraph',
        text: 'Equipd also uses short-lived browser storage to support core navigation and usability. These are not used for advertising or cross-site tracking:',
      },
      {
        type: 'list',
        items: [
          'equipd:hub-scroll-y (session storage) — restores your scroll position when returning to My Hub.',
          'equipd:browse-geolocation-status (session storage) — remembers whether a location prompt was shown or denied during browse.',
          'equipd-hub-tabs-scroll-nudge-v1 (local storage) — remembers that you have seen the My Hub tabs hint.',
        ],
      },
      {
        type: 'heading',
        text: 'Third-party services',
      },
      {
        type: 'paragraph',
        text: 'When you pay for an order or complete seller payout setup, you may be redirected to Stripe. Stripe may set its own cookies on stripe.com in accordance with Stripe’s policies. Equipd does not control cookies set on third-party domains.',
      },
      {
        type: 'paragraph',
        text: 'Google Fonts are loaded to display site typography. Your browser requests font files from Google; see Google’s privacy documentation for how they handle those requests.',
      },
      {
        type: 'heading',
        text: 'Optional categories (not active today)',
      },
      {
        type: 'paragraph',
        text: 'Analytics and Marketing toggles in Cookie Settings are ready for future tools. No Google Analytics, Microsoft Clarity, Meta Pixel, or similar advertising or analytics scripts are registered or loaded on Equipd at present. If we add them, they will only run after you opt in to the relevant category.',
      },
      {
        type: 'heading',
        text: 'Managing your choices',
      },
      {
        type: 'paragraph',
        text: 'Open Cookie Settings from the footer legal links or from Account Settings → Privacy & cookies. You can accept all cookies, reject non-essential cookies, or choose categories individually.',
      },
      {
        type: 'paragraph',
        text: 'You can also restrict cookies and storage through your browser settings. Blocking necessary storage may prevent sign-in, checkout, or other core features from working correctly.',
      },
      {
        type: 'heading',
        text: 'Related policies',
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Privacy Policy', to: '/help/privacy-policy' } }],
      },
      {
        type: 'paragraph',
        segments: [{ link: { label: 'Terms & Conditions', to: '/help/terms-and-conditions' } }],
      },
    ],
  },
]

const articlesBySlug = new Map(HELP_ARTICLES.map((article) => [article.slug, article]))

export function getHelpArticleBySlug(slug) {
  return articlesBySlug.get(slug) ?? null
}

export function getHelpArticlesForCategory(categoryId) {
  const section = HELP_CATEGORY_SECTIONS.find((category) => category.id === categoryId)
  if (!section) return []

  return section.articleSlugs
    .map((slug) => getHelpArticleBySlug(slug))
    .filter(Boolean)
}

function getBlockSearchText(block) {
  if (block.type === 'list') {
    return block.items.join(' ')
  }

  if (block.segments?.length) {
    return block.segments
      .map((segment) => segment.text ?? segment.link?.label ?? '')
      .join(' ')
  }

  return block.text ?? ''
}

function getArticleSearchText(article) {
  const contentText = article.content.map(getBlockSearchText).join(' ')

  return [article.title, article.excerpt, article.category, contentText].join(' ').toLowerCase()
}

export function searchHelpArticles(query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []

  return HELP_ARTICLES.filter((article) => {
    const haystack = getArticleSearchText(article)
    return terms.every((term) => haystack.includes(term))
  })
}

export function getHelpCategoryTitle(categoryId) {
  return HELP_CATEGORY_SECTIONS.find((category) => category.id === categoryId)?.title ?? categoryId
}
