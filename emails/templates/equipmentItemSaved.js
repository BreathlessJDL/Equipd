import { appUrl, detailRowsHtml, layoutDefaults, sendGridPlainTextFooter } from './shared.js'

/** @type {import('./types.js').EmailTemplateDefinition} */
export const equipmentItemSavedTemplate = {
  key: 'equipment_item_saved',
  label: 'Equipment item saved (seller)',
  description: 'Sent to the listing owner when another user saves their listing.',
  sendGridEnvVar: 'SENDGRID_TEMPLATE_EQUIPMENT_ITEM_SAVED',
  contentFields: ['first_name', 'listing_title', 'save_count_text'],
  requiredFields: ['preheader', 'title', 'cta_text', 'cta_url'],
  buildPreviewData(baseUrl) {
    const listing_title = 'Life Fitness E5 Cross-Trainer'
    const first_name = 'sarahlifts'
    const save_count_text = '2 people have saved this item'

    const body = `
      <p>Hi ${first_name},</p>
      <p>Someone has saved your listing <strong>${listing_title}</strong>.</p>
      ${detailRowsHtml({
        Listing: listing_title,
        Interest: save_count_text,
      })}
      <p>Your equipment is getting noticed on Equipd.</p>
    `.trim()

    return layoutDefaults(baseUrl, {
      subject: `Someone saved your ${listing_title}`,
      preheader: `Someone has saved your ${listing_title} on Equipd.`,
      title: 'Someone saved your listing',
      subtitle: 'Your equipment is getting noticed on Equipd.',
      body,
      cta_text: 'View your listing',
      cta_url: appUrl(baseUrl, '/listings/life-fitness-e5-cross-trainer'),
      first_name,
      listing_title,
      save_count_text,
    })
  },
  buildSendGridPlainText() {
    return `{{title}}
{{subtitle}}

Hi {{first_name}},

Someone has saved your listing {{listing_title}}.

{{save_count_text}}

{{cta_text}}: {{cta_url}}

{{secondary_text}}: {{secondary_url}}

${sendGridPlainTextFooter()}`
  },
}
