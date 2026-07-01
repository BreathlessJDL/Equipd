import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const deliveryConfirmedTemplate = {
  key: 'delivery_confirmed',
  label: 'Delivery confirmed (buyer & seller)',
  description: 'Sent when the buyer confirms courier delivery.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_DELIVERY_CONFIRMED',
  contentFields: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
    'buyer_tracking_reference',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'A91F3C20'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const counterparty_name = 'jamesgym'
    const buyer_tracking_reference = 'APC123456789'

    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>${counterparty_name}</strong> has confirmed delivery of <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        Buyer: counterparty_name,
        'Tracking reference': buyer_tracking_reference,
      })}
      <p>Payout is held during the Buyer Protection window. Open the order for full details.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `Delivery confirmed for ${listing_title} (order ${order_number}).`,
      title: 'Delivery confirmed',
      subtitle: 'The buyer confirmed receipt of the item.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
      counterparty_name,
      buyer_tracking_reference,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{counterparty_name}} has confirmed delivery of {{listing_title}}.

Order number: {{order_number}}
Buyer: {{counterparty_name}}
Tracking reference: {{buyer_tracking_reference}}

Payout is held during the Buyer Protection window. Open the order for full details.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
