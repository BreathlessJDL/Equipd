import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const offerReceivedTemplate = {
  key: 'offer_received',
  label: 'Offer received (seller)',
  description: 'Sent to the seller when a buyer makes an offer on their listing.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_OFFER_RECEIVED',
  contentFields: [
    'recipient_first_name',
    'buyer_name',
    'listing_title',
    'offer_amount',
    'listing_price',
    'offer_id',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const buyer_name = 'James Carter'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const offer_amount = '£425.00'
    const listing_price = '£495.00'

    const body = `
      <p>Hi Sarah,</p>
      <p><strong>${buyer_name}</strong> has made an offer on <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        Offer: offer_amount,
        'Asking price': listing_price,
        Buyer: buyer_name,
      })}
      <p>You can accept, decline, or counter in My Hub. Offers are not binding until you accept.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `${buyer_name} offered ${offer_amount} on your ${listing_title} listing.`,
      title: 'New offer on your listing',
      subtitle: 'Review and respond when you are ready.',
      body,
      cta_text: 'View offer',
      cta_url: appUrl(baseUrl, '/hub?section=selling&tab=offers'),
      recipient_first_name: 'Sarah',
      buyer_name,
      listing_title,
      offer_amount,
      listing_price,
      offer_id: 'off_8f2c91a4',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{buyer_name}} has made an offer on {{listing_title}}.

Offer: {{offer_amount}}
Asking price: {{listing_price}}
Buyer: {{buyer_name}}

You can accept, decline, or counter in My Hub. Offers are not binding until you accept.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
