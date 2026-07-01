import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const newOrderReceivedTemplate = {
  key: 'new_order_received',
  label: 'New order received (seller)',
  description: 'Sent to the seller when a buyer pays for their listing.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_NEW_ORDER_RECEIVED',
  contentFields: [
    'recipient_first_name',
    'order_id',
    'order_number',
    'listing_title',
    'order_total',
    'buyer_name',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'EQ-10482'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const order_total = '£425.00'
    const buyer_name = 'James Carter'

    const body = `
      <p>Hi Sarah,</p>
      <p><strong>${buyer_name}</strong> has paid for <strong>${listing_title}</strong>. You have a new order to fulfil.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        'Sale amount': order_total,
        Buyer: buyer_name,
      })}
      <p>Open the order to confirm handover details and complete the next fulfilment steps.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `New paid order ${order_number} — ${buyer_name} bought your ${listing_title}.`,
      title: 'New order received',
      subtitle: 'A buyer has paid for your listing.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'Sarah',
      order_id,
      order_number,
      listing_title,
      order_total,
      buyer_name,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{buyer_name}} has paid for {{listing_title}}. You have a new order to fulfil.

Order number: {{order_number}}
Sale amount: {{order_total}}
Buyer: {{buyer_name}}

Open the order to confirm handover details and complete the next fulfilment steps.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
