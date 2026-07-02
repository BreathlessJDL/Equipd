import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const payoutReleasedTemplate = {
  key: 'payout_released',
  label: 'Payout released (seller)',
  description: 'Sent when seller payout is released after order completion.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_PAYOUT_RELEASED',
  contentFields: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'seller_service_fee',
    'seller_net_payout',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = '33333333-3333-3333-3333-333333333333'
    const order_number = '33333333'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const body = `
      <p>Hi sarahlifts,</p>
      <p>Your payout for <strong>${listing_title}</strong> has been released.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        'Seller Service Fee': '£8.50',
        "You'll receive": '£416.50',
      })}
      <p>Funds are on the way to your connected payout account. Open the order for full details.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: `Payout released for ${listing_title}.`,
      title: 'Payout released',
      subtitle: 'Your seller payout has been released.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      listing_title,
      order_id,
      order_number,
      seller_service_fee: '£8.50',
      seller_net_payout: '£416.50',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your payout for {{listing_title}} has been released.

Order number: {{order_number}}
Seller Service Fee: {{seller_service_fee}}
You'll receive: {{seller_net_payout}}

Funds are on the way to your connected payout account. Open the order for full details.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
