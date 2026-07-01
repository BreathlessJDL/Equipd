import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const paymentSuccessfulTemplate = {
  key: 'payment_successful',
  label: 'Payment successful (buyer)',
  description: 'Sent to the buyer when payment for an order is confirmed.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_PAYMENT_SUCCESSFUL',
  contentFields: [
    'recipient_first_name',
    'order_id',
    'order_number',
    'listing_title',
    'order_total',
    'seller_name',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'EQ-10482'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const order_total = '£437.25'
    const seller_name = 'Sarah Mitchell'

    const body = `
      <p>Hi James,</p>
      <p>Your payment for <strong>${listing_title}</strong> was successful. Your order is confirmed.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        Total: order_total,
        Seller: seller_name,
      })}
      <p>Follow the next steps in your order to arrange collection or delivery with the seller.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `Payment confirmed for order ${order_number} — ${listing_title}.`,
      title: 'Payment successful',
      subtitle: 'Your order is confirmed.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'James',
      order_id,
      order_number,
      listing_title,
      order_total,
      seller_name,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your payment for {{listing_title}} was successful. Your order is confirmed.

Order number: {{order_number}}
Total: {{order_total}}
Seller: {{seller_name}}

Follow the next steps in your order to arrange collection or delivery with the seller.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
