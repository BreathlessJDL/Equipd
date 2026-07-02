import { resolveAppBaseUrl, DEFAULT_EMAIL_LOGO_URL } from '../../supabase/functions/_shared/transactionalEmailCore.js'
import { composeMarketplaceEmailSubject } from '../../supabase/functions/_shared/marketplaceEmailCore.js'
import {
  ALL_EMAIL_TEMPLATES,
  buildEmailPreviewData,
  buildPhase2PreviewData,
} from '../templates/index.js'

const baseDefaults = (overrides = {}) => {
  const base_url = overrides.base_url ?? 'https://equipd.co.uk'

  return {
    base_url,
    logo_url: DEFAULT_EMAIL_LOGO_URL,
    year: String(new Date().getFullYear()),
    tagline: 'The UK marketplace for used gym equipment.',
    preheader: 'Equipd notification preview.',
    cta_text: 'View in Equipd',
    cta_url: `${base_url}/hub`,
    secondary_text: 'Visit the Help Centre',
    secondary_url: `${base_url}/help`,
    ...overrides,
    base_url,
    logo_url: DEFAULT_EMAIL_LOGO_URL,
    year: String(new Date().getFullYear()),
  }
}

/** Mock dynamic_template_data for local HTML previews (not production copy). */
export const EMAIL_PREVIEW_MOCK_DATA = {
  master_test: baseDefaults({
    preheader: 'Equipd master template test send preview.',
    title: 'Equipd email test',
    subtitle: 'This is a test of the approved master transactional layout.',
    body: `
      <p>If you received this email, SendGrid plumbing is working.</p>
      <p>Dynamic content will appear here in future transactional emails.</p>
    `.trim(),
    cta_text: 'Open Equipd',
    cta_url: 'https://equipd.co.uk',
  }),

}

for (const template of ALL_EMAIL_TEMPLATES) {
  const mock = template.buildPreviewData('https://equipd.co.uk')
  EMAIL_PREVIEW_MOCK_DATA[template.key] = {
    ...mock,
    subject:
      mock.subject ??
      composeMarketplaceEmailSubject(template.key, mock.listing_title, {
        recipientRole: mock.recipient_role,
      }),
  }
}

export function getPreviewMockData(templateKey, getEnv = (key) => process.env[key] ?? '') {
  const base_url = resolveAppBaseUrl(getEnv)
  const preview = buildEmailPreviewData(templateKey, base_url) ?? buildPhase2PreviewData(templateKey, base_url)
  if (preview) {
    return {
      ...preview,
      subject:
        preview.subject ??
        composeMarketplaceEmailSubject(templateKey, preview.listing_title, {
          recipientRole: preview.recipient_role,
        }),
      logo_url: DEFAULT_EMAIL_LOGO_URL,
      year: String(new Date().getFullYear()),
    }
  }

  const mock = EMAIL_PREVIEW_MOCK_DATA[templateKey]
  if (!mock) return null

  return {
    ...mock,
    base_url,
    logo_url: DEFAULT_EMAIL_LOGO_URL,
    year: String(new Date().getFullYear()),
    cta_url: mock.cta_url?.replace('https://equipd.co.uk', base_url) ?? `${base_url}/hub`,
    secondary_url: mock.secondary_url?.replace('https://equipd.co.uk', base_url) ?? `${base_url}/help`,
  }
}
