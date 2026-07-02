import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const evidenceRequestedTemplate = {
  key: 'evidence_requested',
  label: 'Evidence requested (buyer or seller)',
  description: 'Sent when Equipd requests additional evidence for a case.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_EVIDENCE_REQUESTED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>Equipd needs more evidence from you for <strong>${listing_title}</strong> before this case can be resolved.</p>
      ${detailRowsHtml({ 'Order number': order_number })}
      <p>Upload supporting photos or documents in your order case as soon as you can.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `More evidence needed for ${listing_title}.`,
      title: 'More evidence needed',
      subtitle: 'Equipd has requested additional information.',
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

Equipd needs more evidence from you for {{listing_title}} before this case can be resolved.

Order number: {{order_number}}

Upload supporting photos or documents in your order case as soon as you can.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
