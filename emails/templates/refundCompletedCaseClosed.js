import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const refundCompletedCaseClosedTemplate = {
  key: 'refund_completed_case_closed',
  label: 'Refund completed & case closed (buyer & seller)',
  description: 'Sent when a refund is completed and the Buyer Protection case is closed.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_REFUND_COMPLETED_CASE_CLOSED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>The refund for <strong>${listing_title}</strong> has been completed and your Buyer Protection case is now closed.</p>
      ${detailRowsHtml({ 'Order number': order_number })}
      <p>Funds should appear according to your payment provider timelines. Open the order if you need the full case history.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Refund completed and case closed for ${listing_title}.`,
      title: 'Refund completed',
      subtitle: 'Your case has been closed.',
      body,
      cta_text: 'View order',
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

The refund for {{listing_title}} has been completed and your Buyer Protection case is now closed.

Order number: {{order_number}}

Funds should appear according to your payment provider timelines. Open the order if you need the full case history.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
