import { appUrl, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const welcomeTemplate = {
  key: 'welcome',
  label: 'Welcome (new user)',
  description: 'Sent when a new Equipd account is created.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_WELCOME',
  contentFields: ['recipient_first_name'],
  requiredFields: ['preheader', 'title', 'body', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const body = `
      <p>Hi jamesgym,</p>
      <p>Welcome to Equipd — the UK marketplace for used gym equipment.</p>
      <p>Browse listings, make offers, and buy or sell with Buyer Protection on every order.</p>
    `.trim()
    return layoutDefaults(baseUrl, {
      preheader: 'Welcome to Equipd.',
      title: 'Welcome to Equipd',
      subtitle: 'Your account is ready.',
      body,
      cta_text: 'Start browsing',
      cta_url: appUrl(baseUrl, '/browse'),
      recipient_first_name: 'jamesgym',
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{recipient_first_name}},

Welcome to Equipd — the UK marketplace for used gym equipment.

Browse listings, make offers, and buy or sell with Buyer Protection on every order.

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
