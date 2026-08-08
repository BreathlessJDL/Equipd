import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const messageReceivedTemplate = {
  key: 'message_received',
  label: 'New message received',
  description: 'Sent when another user sends a text message in a conversation.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_MESSAGE_RECEIVED',
  contentFields: [
    'recipient_first_name',
    'sender_name',
    'listing_title',
    'message_preview',
    'conversation_id',
    'message_id',
  ],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const sender_name = 'jamesgym'
    const listing_title = 'Rogue Ohio Bar — 20kg'
    const message_preview = 'Is this still available for collection this weekend?'

    const body = `
      <p>Hi sarahlifts,</p>
      <p><strong>${sender_name}</strong> sent you a message about <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        From: sender_name,
        Listing: listing_title,
        Message: message_preview,
      })}
      <p>Reply in Messages to continue the conversation.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      subject: `New message about ${listing_title} on Equipd`,
      preheader: `${sender_name} messaged you about ${listing_title}.`,
      title: 'New message',
      subtitle: 'Someone replied on Equipd.',
      body,
      cta_text: 'View message',
      cta_url: appUrl(baseUrl, '/messages/conv_preview_1'),
      recipient_first_name: 'sarahlifts',
      sender_name,
      listing_title,
      message_preview,
      conversation_id: 'conv_preview_1',
      message_id: 'msg_preview_1',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

{{sender_name}} sent you a message about {{listing_title}}.

Message: {{message_preview}}

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
