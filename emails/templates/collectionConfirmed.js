import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const collectionConfirmedTemplate = {
  key: 'collection_confirmed',
  label: 'Collection / handover confirmed (buyer & seller)',
  description: 'Sent when the buyer confirms in-person collection or seller delivery handover.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_COLLECTION_CONFIRMED',
  contentFields: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
    'fulfilment_label',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'A91F3C20'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const counterparty_name = 'jamesgym'

    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>${counterparty_name}</strong> has confirmed collection for <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        Buyer: counterparty_name,
      })}
      <p>Payout is held during the Buyer Protection window. Open the order for full details.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `Collection confirmed for ${listing_title} (order ${order_number}).`,
      title: 'Collection confirmed',
      subtitle: 'The buyer confirmed receipt of the item.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
      counterparty_name,
      fulfilment_label: 'Collection',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{counterparty_name}} has confirmed {{fulfilment_label}} for {{listing_title}}.

Order number: {{order_number}}

Payout is held during the Buyer Protection window. Open the order for full details.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
