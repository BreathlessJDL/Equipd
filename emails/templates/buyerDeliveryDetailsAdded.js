import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const buyerDeliveryDetailsAddedTemplate = {
  key: 'buyer_delivery_details_added',
  label: 'Buyer delivery details added (seller)',
  description: 'Sent to the seller when the buyer submits delivery details for a seller-delivery order.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_BUYER_DELIVERY_DETAILS_ADDED',
  contentFields: [
    'recipient_first_name',
    'buyer_name',
    'listing_title',
    'order_id',
    'order_number',
    'delivery_contact_name',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const order_id = 'ord_a91f3c20-7b4e-4d1a-9c8f-2e6b5d4a1f90'
    const order_number = 'A91F3C20'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const buyer_name = 'jamesgym'
    const delivery_contact_name = 'James Carter'

    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>${buyer_name}</strong> has submitted delivery details for <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        'Order number': order_number,
        'Delivery contact': delivery_contact_name,
        Buyer: buyer_name,
      })}
      <p>Review the details in your order and arrange delivery when you are ready.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      preheader: `${buyer_name} added delivery details for ${listing_title}.`,
      title: 'Delivery details added',
      subtitle: 'The buyer has submitted delivery information.',
      body,
      cta_text: 'View order',
      cta_url: appUrl(baseUrl, `/orders/${order_id}`),
      recipient_first_name: 'sarahlifts',
      buyer_name,
      listing_title,
      order_id,
      order_number,
      delivery_contact_name,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{buyer_name}} has submitted delivery details for {{listing_title}}.

Order number: {{order_number}}
Delivery contact: {{delivery_contact_name}}
Buyer: {{buyer_name}}

Review the details in your order and arrange delivery when you are ready.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
