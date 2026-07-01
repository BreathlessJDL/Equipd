import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const courierDispatchedTemplate = {
  key: 'courier_dispatched',
  label: 'Courier dispatched (buyer)',
  description: 'Sent to the buyer when the seller submits courier handover evidence.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_COURIER_DISPATCHED',
  contentFields: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'seller_name',
    'courier_name',
    'courier_company',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'A91F3C20'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const seller_name = 'sarahlifts'
    const courier_name = 'Dave'
    const courier_company = 'APC Overnight'

    const body = `
      <p>Hi jamesgym,</p>
      <p><strong>${seller_name}</strong> has dispatched <strong>${listing_title}</strong> via courier. Your item is now in transit.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        Seller: seller_name,
        Courier: courier_name,
        Company: courier_company,
      })}
      <p>Confirm delivery in your order once the item arrives to start your Buyer Protection window.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `${listing_title} is on its way — courier handover submitted.`,
      title: 'Your order is on its way',
      subtitle: 'The seller has dispatched your item via courier.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
      seller_name,
      courier_name,
      courier_company,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{seller_name}} has dispatched {{listing_title}} via courier. Your item is now in transit.

Order number: {{order_number}}
Seller: {{seller_name}}
Courier: {{courier_name}}
Company: {{courier_company}}

Confirm delivery in your order once the item arrives to start your Buyer Protection window.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
