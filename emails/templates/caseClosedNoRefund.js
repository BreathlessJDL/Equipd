import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const caseClosedNoRefundTemplate = {
  key: 'case_closed_no_refund',
  label: 'Case closed — no refund (buyer & seller)',
  description: 'Sent when a Buyer Protection case is closed without a refund.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_CASE_CLOSED_NO_REFUND',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>Your Buyer Protection case for <strong>${listing_title}</strong> has been closed.</p>
      ${detailRowsHtml({ 'Order number': order_number })}
      <p>No refund was issued for this case. Open the order for the full outcome and any next steps.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Case closed for ${listing_title}.`,
      title: 'Case closed',
      subtitle: 'This case has been resolved.',
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

Your Buyer Protection case for {{listing_title}} has been closed.

Order number: {{order_number}}

No refund was issued for this case. Open the order for the full outcome and any next steps.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
