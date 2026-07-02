import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const returnAuthorisedTemplate = {
  key: 'return_authorised',
  label: 'Return authorised (buyer & seller)',
  description: 'Sent when Equipd authorises a return for a Buyer Protection case.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_RETURN_AUTHORISED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number', 'counterparty_name'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi jamesgym,</p>
      <p>Equipd has authorised a return for <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({ 'Order number': order_number, Seller: 'sarahlifts' })}
      <p>The seller must arrange and pay for collection within 7 calendar days. Make the equipment reasonably available for collection.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Return authorised for ${listing_title}.`,
      title: 'Return authorised',
      subtitle: 'Next steps for equipment collection.',
      body,
      cta_text: 'View case',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
      counterparty_name: 'sarahlifts',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Equipd has authorised a return for {{listing_title}}.

Order number: {{order_number}}

The seller must arrange and pay for collection within 7 calendar days. Make the equipment reasonably available for collection.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
