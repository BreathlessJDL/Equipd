import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const buyerProtectionStartedTemplate = {
  key: 'buyer_protection_started',
  label: 'Buyer Protection started (buyer)',
  description: 'Sent to the buyer when the 24-hour Buyer Protection window begins.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_BUYER_PROTECTION_STARTED',
  contentFields: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'protection_hours',
    'protection_ends_at',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'A91F3C20'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const protection_hours = '24'
    const protection_ends_at = '29 Jun 2026, 14:30'

    const body = `
      <p>Hi jamesgym,</p>
      <p>Your <strong>${protection_hours}-hour</strong> Buyer Protection window for <strong>${listing_title}</strong> has started.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        'Protection ends': protection_ends_at,
      })}
      <p>If something is not right with your order, open a case before the window ends.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `Buyer Protection started for ${listing_title} — ends ${protection_ends_at}.`,
      title: 'Buyer Protection started',
      subtitle: 'Your protection window is now active.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'jamesgym',
      listing_title,
      order_id,
      order_number,
      protection_hours,
      protection_ends_at,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your {{protection_hours}}-hour Buyer Protection window for {{listing_title}} has started.

Order number: {{order_number}}
Protection ends: {{protection_ends_at}}

If something is not right with your order, open a case before the window ends.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
