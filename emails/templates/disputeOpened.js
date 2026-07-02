import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const disputeOpenedTemplate = {
  key: 'dispute_opened',
  label: 'Dispute opened (buyer & seller)',
  description: 'Sent when a Buyer Protection case is opened for an order.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_DISPUTE_OPENED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number', 'counterparty_name'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>jamesgym</strong> has reported a problem with <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({ 'Order number': order_number, Buyer: 'jamesgym' })}
      <p>Payout is on hold while Equipd reviews the issue. Open the order for case updates.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Buyer reported a problem with ${listing_title}.`,
      title: 'Buyer reported a problem',
      subtitle: 'A Buyer Protection case has been opened.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
      counterparty_name: 'jamesgym',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{counterparty_name}} has reported a problem with {{listing_title}}.

Order number: {{order_number}}

Payout is on hold while Equipd reviews the issue. Open the order for case updates.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
