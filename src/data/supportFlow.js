import { getHelpArticleBySlug } from './helpArticles'

export const SUPPORT_FLOW_CATEGORIES = [
  {
    id: 'buying',
    title: 'Buying',
    description: 'Orders, delivery, and purchases',
    issuePrompt: 'What is your issue?',
    issues: [
      {
        id: 'help-with-order',
        title: 'Help with an order',
        articleSlugs: ['how-buying-works', 'buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'collection-seller-delivery',
        title: 'Collection or seller delivery',
        articleSlugs: ['collection-orders', 'buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'courier-delivery',
        title: 'Courier delivery',
        articleSlugs: ['courier-orders', 'buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'making-a-purchase',
        title: 'Making a purchase',
        articleSlugs: ['how-buying-works', 'buyer-protection'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['how-buying-works', 'buyer-protection'],
      },
    ],
  },
  {
    id: 'selling',
    title: 'Selling',
    description: 'Offers, sales, and payouts',
    issues: [
      {
        id: 'receiving-offers',
        title: 'Receiving offers',
        articleSlugs: ['receiving-offers', 'how-selling-works'],
      },
      {
        id: 'accepted-sale',
        title: 'Accepted sale',
        articleSlugs: ['accepted-sales', 'how-selling-works', 'collection-orders'],
      },
      {
        id: 'getting-paid',
        title: 'Getting paid',
        articleSlugs: ['getting-paid', 'seller-payouts', 'stripe-payout-setup'],
      },
      {
        id: 'stripe-payout-setup',
        title: 'Stripe payout setup',
        articleSlugs: ['stripe-payout-setup', 'seller-payouts', 'getting-paid'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['how-selling-works', 'getting-paid'],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    description: 'Profile, settings, and sign-in',
    issues: [
      {
        id: 'creating-account',
        title: 'Creating an account',
        articleSlugs: ['creating-an-account'],
      },
      {
        id: 'account-settings',
        title: 'Account settings',
        articleSlugs: ['account-settings', 'profile-pictures'],
      },
      {
        id: 'profile-picture',
        title: 'Profile picture',
        articleSlugs: ['profile-pictures', 'account-settings'],
      },
      {
        id: 'location-settings',
        title: 'Location settings',
        articleSlugs: ['updating-default-location', 'account-settings'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['creating-an-account', 'account-settings'],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    description: 'Fees, payouts, and Stripe',
    issues: [
      {
        id: 'buyer-protection-fee',
        title: 'Buyer Protection fee',
        articleSlugs: ['buyer-protection-fee', 'buyer-protection'],
      },
      {
        id: 'seller-payouts',
        title: 'Seller payouts',
        articleSlugs: ['seller-payouts', 'getting-paid', 'stripe-payout-setup'],
      },
      {
        id: 'stripe-onboarding',
        title: 'Stripe onboarding',
        articleSlugs: ['stripe-payout-setup', 'seller-payouts'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['buyer-protection-fee', 'seller-payouts'],
      },
    ],
  },
  {
    id: 'buyer-protection',
    title: 'Buyer Protection',
    description: 'Disputes, claims, and protection windows',
    issues: [
      {
        id: 'open-dispute',
        title: 'Open dispute',
        articleSlugs: ['buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'existing-dispute',
        title: 'Existing dispute',
        articleSlugs: ['buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'eligible-claims',
        title: 'Eligible claims',
        articleSlugs: ['buyer-protection', 'refunds-and-returns'],
      },
      {
        id: 'protection-period',
        title: 'Protection period',
        articleSlugs: ['buyer-protection', 'collection-orders', 'courier-orders'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['buyer-protection'],
      },
    ],
  },
  {
    id: 'refunds-returns',
    title: 'Refunds & Returns',
    description: 'Refunds, returns, and seller issues',
    issues: [
      {
        id: 'return-item',
        title: 'Return an item',
        articleSlugs: ['refunds-and-returns', 'buyer-protection'],
      },
      {
        id: 'refund-request',
        title: 'Refund request',
        articleSlugs: ['refunds-and-returns', 'buyer-protection'],
      },
      {
        id: 'partial-refund',
        title: 'Partial refund',
        articleSlugs: ['refunds-and-returns'],
      },
      {
        id: 'seller-not-responding',
        title: 'Seller not responding',
        articleSlugs: ['refunds-and-returns', 'buyer-protection', 'how-buying-works'],
      },
      {
        id: 'something-else',
        title: 'Something else',
        articleSlugs: ['refunds-and-returns'],
      },
    ],
  },
]

const categoriesById = new Map(SUPPORT_FLOW_CATEGORIES.map((category) => [category.id, category]))

export function getSupportFlowCategory(categoryId) {
  return categoriesById.get(categoryId) ?? null
}

export function getSupportFlowIssue(categoryId, issueId) {
  const category = getSupportFlowCategory(categoryId)
  if (!category) return null
  return category.issues.find((issue) => issue.id === issueId) ?? null
}

export function getRecommendedSupportArticles(categoryId, issueId) {
  const issue = getSupportFlowIssue(categoryId, issueId)
  if (!issue) return []

  const seen = new Set()
  const articles = []

  for (const slug of issue.articleSlugs) {
    if (seen.has(slug)) continue
    const article = getHelpArticleBySlug(slug)
    if (!article) continue
    seen.add(slug)
    articles.push(article)
  }

  return articles.slice(0, 4)
}
