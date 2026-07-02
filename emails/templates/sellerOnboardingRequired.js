import { appUrl, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const sellerOnboardingRequiredTemplate = {
  key: 'seller_onboarding_required',
  label: 'Seller onboarding required (seller)',
  description: 'Sent when a seller has a paid order but Stripe Connect onboarding is incomplete.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_SELLER_ONBOARDING_REQUIRED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi sarahlifts,</p>
      <p>You have a paid order for <strong>${listing_title}</strong>, but your payout account setup is not complete.</p>
      <p>Complete Stripe Connect onboarding in your Hub so Equipd can release your payout when the order completes.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Complete payout setup to receive funds for ${listing_title}.`,
      title: 'Complete payout setup',
      subtitle: 'Stripe Connect onboarding is required.',
      body,
      cta_text: 'Complete setup',
      cta_url: appUrl(baseUrl, '/hub?section=selling&tab=payouts'),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

You have a paid order for {{listing_title}}, but your payout account setup is not complete.

Complete Stripe Connect onboarding in your Hub so Equipd can release your payout when the order completes.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
