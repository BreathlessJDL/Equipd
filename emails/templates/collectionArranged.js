import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const collectionArrangedTemplate = {
  key: 'collection_arranged',
  label: 'Return collection arranged (buyer & seller)',
  description: 'Sent when return collection has been arranged for a case.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_COLLECTION_ARRANGED',
  contentFields: ['recipient_first_name', 'listing_title', 'order_id', 'order_number', 'collection_date'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const collection_date = '5 Jul 2026'
    const body = `
      <p>Hi jamesgym,</p>
      <p>Return collection has been arranged for <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({ 'Order number': order_number, 'Collection date': collection_date })}
      <p>Please make the equipment available for collection on the agreed date.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Return collection arranged for ${listing_title}.`,
      title: 'Return collection arranged',
      subtitle: 'Collection details are confirmed.',
      body,
      cta_text: 'View case',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
      collection_date,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Return collection has been arranged for {{listing_title}}.

Order number: {{order_number}}
Collection date: {{collection_date}}

Please make the equipment available for collection on the agreed date.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
