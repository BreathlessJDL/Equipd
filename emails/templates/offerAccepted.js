import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const offerAcceptedTemplate = {
  key: 'offer_accepted',
  label: 'Offer accepted (buyer)',
  description: 'Sent to the buyer when a seller accepts their offer.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_OFFER_ACCEPTED',
  contentFields: [
    'recipient_first_name',
    'seller_name',
    'listing_title',
    'offer_amount',
    'payment_deadline',
    'offer_id',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const seller_name = 'Sarah Mitchell'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const offer_amount = '£425.00'
    const payment_deadline = '48 hours'

    const body = `
      <p>Hi James,</p>
      <p><strong>${seller_name}</strong> accepted your offer on <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        'Your offer': offer_amount,
        Seller: seller_name,
        'Pay within': payment_deadline,
      })}
      <p>Complete payment to secure the item. If payment is not completed in time, the offer may be cancelled.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `${seller_name} accepted your ${offer_amount} offer. Complete payment within ${payment_deadline}.`,
      title: 'Offer accepted',
      subtitle: 'Complete payment to secure your purchase.',
      body,
      cta_text: 'Complete payment',
      cta_url: appUrl(baseUrl, '/hub?section=buying&tab=awaiting_payment'),
      recipient_first_name: 'James',
      seller_name,
      listing_title,
      offer_amount,
      payment_deadline,
      offer_id: 'off_8f2c91a4',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{seller_name}} accepted your offer on {{listing_title}}.

Your offer: {{offer_amount}}
Seller: {{seller_name}}
Pay within: {{payment_deadline}}

Complete payment to secure the item. If payment is not completed in time, the offer may be cancelled.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
