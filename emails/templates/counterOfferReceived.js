import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const counterOfferReceivedTemplate = {
  key: 'counter_offer_received',
  label: 'Counter offer received',
  description: 'Sent when a buyer or seller sends a counter offer during negotiation.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_COUNTER_OFFER_RECEIVED',
  contentFields: [
    'recipient_first_name',
    'sender_name',
    'listing_title',
    'offer_amount',
    'listing_price',
    'offer_id',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const sender_name = 'Jordan Smith'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const offer_amount = '£410.00'
    const listing_price = '£495.00'

    const body = `
      <p>Hi Alex,</p>
      <p><strong>${sender_name}</strong> sent a counter offer on <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        'Counter offer': offer_amount,
        'Asking price': listing_price,
        From: sender_name,
      })}
      <p>Review the counter offer in My Hub to accept, decline, or respond.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `${sender_name} countered with ${offer_amount} on ${listing_title}.`,
      title: 'New counter offer',
      subtitle: 'Review and respond when you are ready.',
      body,
      cta_text: 'View counter offer',
      cta_url: appUrl(baseUrl, '/hub?section=buying&tab=offers'),
      recipient_first_name: 'Alex',
      sender_name,
      listing_title,
      offer_amount,
      listing_price,
      offer_id: 'off_counter_1',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{sender_name}} sent a counter offer on {{listing_title}}.

Counter offer: {{offer_amount}}
Asking price: {{listing_price}}
From: {{sender_name}}

Review the counter offer in My Hub to accept, decline, or respond.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
