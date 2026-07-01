import { resolveAppBaseUrl, DEFAULT_EMAIL_LOGO_URL } from '../../supabase/functions/_shared/transactionalEmailCore.js'
import {
  PHASE2_EMAIL_TEMPLATES,
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

  buyer_delivery_details_added: baseDefaults({
    title: 'Delivery details added',
    subtitle: 'The buyer has submitted delivery information.',
    body: '<p>Review the details and continue fulfilment when ready.</p>',
    cta_text: 'View order',
    cta_url: 'https://equipd.co.uk/hub',
  }),

  collection_confirmed: baseDefaults({
    title: 'Collection confirmed',
    subtitle: 'The buyer confirmed receipt of the item.',
    body: '<p>Buyer Protection will end on schedule and payout will follow if eligible.</p>',
    cta_text: 'View order',
    cta_url: 'https://equipd.co.uk/hub',
  }),

  dispute_opened: baseDefaults({
    title: 'Case opened',
    subtitle: 'A Buyer Protection case has been opened.',
    body: '<p>Review the case details and respond with any requested information.</p>',
    cta_text: 'View case',
    cta_url: 'https://equipd.co.uk/hub',
  }),

  refund_completed: baseDefaults({
    title: 'Refund completed',
    subtitle: 'A refund has been processed for this order.',
    body: '<p>Funds should return to the buyer according to their payment provider timelines.</p>',
    cta_text: 'View order',
    cta_url: 'https://equipd.co.uk/hub',
  }),

  case_closed: baseDefaults({
    title: 'Case closed',
    subtitle: 'The support case for this order has been closed.',
    body: '<p>No further action is required unless Equipd Support contacts you.</p>',
    cta_text: 'View order',
    cta_url: 'https://equipd.co.uk/hub',
  }),

  payout_released: baseDefaults({
    title: 'Payout released',
    subtitle: 'Your seller payout has been released.',
    body: '<p>Funds are on the way to your connected payout account.</p>',
    cta_text: 'View order',
    cta_url: 'https://equipd.co.uk/hub',
  }),
}

for (const template of PHASE2_EMAIL_TEMPLATES) {
  EMAIL_PREVIEW_MOCK_DATA[template.key] = template.buildPreviewData('https://equipd.co.uk')
}

export function getPreviewMockData(templateKey, getEnv = (key) => process.env[key] ?? '') {
  const base_url = resolveAppBaseUrl(getEnv)
  const phase2 = buildPhase2PreviewData(templateKey, base_url)
  if (phase2) {
    return {
      ...phase2,
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
