import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const reviewAvailableTemplate = {
  key: 'review_available',
  label: 'Review available (buyer)',
  description: 'Sent when an order is complete and the buyer can leave a review.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_REVIEW_AVAILABLE',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number', 'seller_name'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>Your order for <strong>${listing_title}</strong> is complete.</p>
      ${detailRowsHtml({ 'Order number': order_number, Seller: 'sarahlifts' })}
      <p>Leave a review to help other buyers and recognise a great seller experience.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Leave a review for ${listing_title}.`,
      title: 'Leave a review',
      subtitle: 'Your order is complete.',
      body,
      cta_text: 'Leave review',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
      seller_name: 'sarahlifts',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your order for {{listing_title}} is complete.

Order number: {{order_number}}
Seller: {{seller_name}}

Leave a review to help other buyers and recognise a great seller experience.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
