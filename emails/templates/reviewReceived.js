import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const reviewReceivedTemplate = {
  key: 'review_received',
  label: 'Review received (reviewed party)',
  description: 'Sent when someone leaves a review on a completed order.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_REVIEW_RECEIVED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number', 'reviewer_name', 'review_rating'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>jamesgym</strong> left you a <strong>5-star</strong> review on <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({ 'Order number': order_number, Rating: '5 stars' })}
      <p>Open the order to read the full review.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `jamesgym left you a review on ${listing_title}.`,
      title: 'You received a review',
      subtitle: 'Someone reviewed your completed order.',
      body,
      cta_text: 'View review',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
      reviewer_name: 'jamesgym',
      review_rating: '5',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{reviewer_name}} left you a {{review_rating}}-star review on {{listing_title}}.

Order number: {{order_number}}

Open the order to read the full review.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
