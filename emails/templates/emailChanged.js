import { appUrl, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const emailChangedTemplate = {
  key: 'email_changed',
  label: 'Email address changed (account)',
  description: 'Sent when a user changes their account email address.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_EMAIL_CHANGED',
  contentFields: ['recipient_first_name', 'new_email'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const body = `
      <p>Hi jamesgym,</p>
      <p>Your Equipd account email address was changed to <strong>new.email@example.com</strong>.</p>
      <p>If you did not make this change, contact Equipd Support immediately.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: 'Your Equipd email address was updated.',
      title: 'Email address updated',
      subtitle: 'Your sign-in email has changed.',
      body,
      cta_text: 'Account settings',
      cta_url: appUrl(baseUrl, '/settings'),
      recipient_first_name: 'jamesgym',
      new_email: 'new.email@example.com',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your Equipd account email address was changed to {{new_email}}.

If you did not make this change, contact Equipd Support immediately.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
