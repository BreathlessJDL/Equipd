import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const refundPendingTemplate = {
  key: 'refund_pending',
  label: 'Refund pending (buyer & seller)',
  description: 'Sent when a refund has been approved and is pending processing.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_REFUND_PENDING',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>A refund for <strong>${listing_title}</strong> has been approved and is being processed.</p>
      ${detailRowsHtml({ 'Order number': order_number })}
      <p>Funds will return according to your payment provider timelines. No further action is required unless Equipd contacts you.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Refund approved for ${listing_title} — processing.`,
      title: 'Refund approved',
      subtitle: 'Your refund is being processed.',
      body,
      cta_text: 'View case',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

A refund for {{listing_title}} has been approved and is being processed.

Order number: {{order_number}}

Funds will return according to your payment provider timelines. No further action is required unless Equipd contacts you.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
