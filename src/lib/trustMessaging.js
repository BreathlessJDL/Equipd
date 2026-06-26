export const BUYER_PROTECTION_HELP_PATH = '/help/buyer-protection'

export const TRUST_LINKS = {
  buyerProtection: BUYER_PROTECTION_HELP_PATH,
}

export const BUYER_PROTECTION_MODAL_CONTENT = {
  title: 'Buyer Protection',
  buttonLabel: 'Sounds good',
  sections: [
    {
      id: 'refunds',
      title: "What's covered",
      intro: 'Buyer Protection may apply if your item:',
      bullets: [
        "Doesn't arrive",
        'Arrives damaged',
        'Is significantly different from the listing description',
        'Is not working as described',
      ],
      footnotes: [
        'If you believe there\'s a problem, you must raise a case and provide supporting evidence during the 24-hour Buyer Protection period following confirmed collection or delivery.',
        'Where appropriate, Equipd may request information from both buyer and seller before reaching a decision.',
      ],
      policyLink: {
        label: 'See full Buyer Protection details',
        to: BUYER_PROTECTION_HELP_PATH,
      },
    },
    {
      id: 'secure',
      title: 'How your payment is protected',
      intro: 'Your payment remains protected throughout the transaction.',
      bullets: [
        'Funds are held securely until the transaction is successfully completed',
        'Collection orders use Equipd QR code confirmation to verify handover',
        'Courier orders use collection and handover evidence to support the transaction record',
        'Payments are encrypted and securely processed by Stripe',
        'Seller payouts are held during the Buyer Protection period',
      ],
      footnotes: [
        'For collection orders, buyers can inspect and test equipment before confirming collection. Buyer Protection then remains active for a further 24 hours after confirmation.',
      ],
    },
    {
      id: 'support',
      title: 'Support',
      intro: 'Need help?',
      paragraphs: [
        'Our team reviews Buyer Protection claims, delivery issues and disputes on a case-by-case basis to help reach a fair outcome for both buyers and sellers.',
        'If you experience an issue, contact Equipd support as soon as possible and provide any relevant evidence to help us investigate.',
      ],
    },
  ],
}

export const LISTING_BUYER_PROTECTION_CARD = {
  title: 'Buyer Protection Included',
  subtitle: 'Your payment is protected when buying through Equipd.',
  ctaLabel: 'Learn about Buyer Protection',
  benefits: [
    {
      id: 'secure-checkout',
      title: 'Secure checkout via Stripe',
      description: 'Pay safely through Equipd.',
    },
    {
      id: 'protected-funds',
      title: 'Seller paid after collection or delivery',
      description: 'Funds remain protected until handover is confirmed.',
    },
    {
      id: 'protection-window',
      title: '24-hour Buyer Protection',
      description: 'Report an issue if something is wrong.',
    },
    {
      id: 'uk-support',
      title: 'UK-based support',
      description: 'Equipd reviews disputes before releasing seller funds.',
    },
  ],
}

export const TRUST_VARIANTS = {
  listing: {
    title: 'Buy with confidence on Equipd',
    points: [
      'Pay securely through Equipd when your offer is accepted.',
      'Funds are held by Equipd until you confirm receipt.',
      'Raise a support request from the order page if something goes wrong.',
    ],
  },
  payment: {
    title: 'Before you pay',
    points: [
      'Payment goes through Equipd checkout — funds are held by Equipd, not sent straight to the seller.',
      'Confirm receipt on the order page once you have the item.',
      'Keep collection or delivery arrangements in Equipd messages.',
    ],
  },
  orderBuyer: {
    title: 'How this order is protected',
    points: [
      'Your payment is held by Equipd until you confirm you have received the item.',
      'Confirm receipt only when you are satisfied — this releases the seller payout.',
      'If there is a problem, raise a support request from this order page.',
    ],
  },
  orderSeller: {
    title: 'How payouts work on Equipd',
    points: [
      'The buyer pays through Equipd and funds are held until they confirm receipt.',
      'After confirmation, your payout is released if payout setup is complete.',
      'If there is a problem, either party can raise a support request on this order.',
    ],
  },
  seller: {
    title: 'Selling safely on Equipd',
    points: [
      'The buyer pays through Equipd before collection or delivery.',
      'Funds are held by Equipd until the buyer confirms receipt.',
      'Your payout is released after confirmation and payout setup.',
    ],
  },
}
