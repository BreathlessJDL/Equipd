import { appUrl, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const passwordChangedTemplate = {
  key: 'password_changed',
  label: 'Password changed (account)',
  description: 'Sent when a user changes their account password.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_PASSWORD_CHANGED',
  contentFields: ['recipient_first_name'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const body = `
      <p>Hi jamesgym,</p>
      <p>Your Equipd account password was changed successfully.</p>
      <p>If you did not make this change, reset your password and contact Equipd Support immediately.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: 'Your Equipd password was updated.',
      title: 'Password updated',
      subtitle: 'Your account password has changed.',
      body,
      cta_text: 'Account settings',
      cta_url: appUrl(baseUrl, '/settings'),
      recipient_first_name: 'jamesgym',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Your Equipd account password was changed successfully.

If you did not make this change, reset your password and contact Equipd Support immediately.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
