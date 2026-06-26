const DEFAULT_SUPPORT_TO = 'support@equipd.co.uk'
const DEFAULT_FROM = 'Equipd Support <notifications@equipd.co.uk>'

export type SupportEmailEventType =
  | 'support_request'
  | 'buyer_protection_dispute'
  | 'trust_safety_report'
  | 'general_support'

export type SupportEmailPayload = {
  eventType: SupportEmailEventType
  metadata: Record<string, unknown>
}

type EmailContent = {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function appBaseUrl(): string {
  return (Deno.env.get('EQUIPD_APP_URL') ?? 'https://equipd.co.uk').replace(/\/$/, '')
}

function adminSupportUrl(): string {
  return `${appBaseUrl()}/admin/support`
}

function orderUrl(orderId: string): string {
  return `${appBaseUrl()}/orders/${orderId}`
}

function detailRow(label: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  return `<tr><th align="left" style="padding:4px 12px 4px 0;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
}

function buildEmailShell(title: string, intro: string, rows: string, actionLabel: string, actionHref: string) {
  const table = rows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">${rows}</table>`
    : ''

  return {
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#1a2744;max-width:640px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
        ${table}
        <p style="margin:24px 0 0;">
          <a href="${escapeHtml(actionHref)}" style="color:#e85d04;font-weight:600;">${escapeHtml(actionLabel)}</a>
        </p>
      </div>
    `.trim(),
  }
}

function buildSupportRequestEmail(metadata: Record<string, unknown>): EmailContent {
  const listingTitle = String(metadata.listing_title ?? 'Listing')
  const subject = `New support request: ${listingTitle}`
  const intro = 'A transaction support request was raised on Equipd and needs review.'
  const rows = [
    detailRow('Request ID', metadata.request_id),
    detailRow('Order ID', metadata.order_id),
    detailRow('Listing', listingTitle),
    detailRow('Reason', metadata.reason),
    detailRow('Opened by', metadata.opened_by_label),
    detailRow('Buyer ID', metadata.buyer_id),
    detailRow('Seller ID', metadata.seller_id),
    detailRow('Message', metadata.message),
  ].join('')

  const shell = buildEmailShell(
    'New transaction support request',
    intro,
    rows,
    'Open Admin Support',
    adminSupportUrl(),
  )

  const text = [
    'New transaction support request',
    '',
    intro,
    '',
    `Request ID: ${metadata.request_id ?? ''}`,
    `Order ID: ${metadata.order_id ?? ''}`,
    `Listing: ${listingTitle}`,
    `Reason: ${metadata.reason ?? ''}`,
    `Opened by: ${metadata.opened_by_label ?? ''}`,
    `Buyer ID: ${metadata.buyer_id ?? ''}`,
    `Seller ID: ${metadata.seller_id ?? ''}`,
    '',
    'Message:',
    String(metadata.message ?? ''),
    '',
    `Admin Support: ${adminSupportUrl()}`,
    metadata.order_id ? `Order: ${orderUrl(String(metadata.order_id))}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, text, html: shell.html }
}

function buildDisputeEmail(metadata: Record<string, unknown>): EmailContent {
  const listingTitle = String(metadata.listing_title ?? 'Order')
  const subject = `New Buyer Protection dispute: ${listingTitle}`
  const intro =
    'A buyer opened a Buyer Protection dispute. Seller payout is on hold until Equipd reviews the case.'
  const rows = [
    detailRow('Dispute ID', metadata.dispute_id),
    detailRow('Order ID', metadata.order_id),
    detailRow('Listing', listingTitle),
    detailRow('Order type', metadata.order_type),
    detailRow('Reason', metadata.reason),
    detailRow('Buyer ID', metadata.buyer_id),
    detailRow('Seller ID', metadata.seller_id),
    detailRow('Evidence files', metadata.evidence_count),
    detailRow('Description', metadata.description),
  ].join('')

  const orderId = String(metadata.order_id ?? '')
  const shell = buildEmailShell(
    'New Buyer Protection dispute',
    intro,
    rows,
    'View order',
    orderId ? orderUrl(orderId) : adminSupportUrl(),
  )

  const text = [
    'New Buyer Protection dispute',
    '',
    intro,
    '',
    `Dispute ID: ${metadata.dispute_id ?? ''}`,
    `Order ID: ${metadata.order_id ?? ''}`,
    `Listing: ${listingTitle}`,
    `Order type: ${metadata.order_type ?? ''}`,
    `Reason: ${metadata.reason ?? ''}`,
    `Evidence files: ${metadata.evidence_count ?? ''}`,
    '',
    'Description:',
    String(metadata.description ?? ''),
    '',
    orderId ? `Order: ${orderUrl(orderId)}` : `Admin Support: ${adminSupportUrl()}`,
  ].join('\n')

  return { subject, text, html: shell.html }
}

function buildReportEmail(metadata: Record<string, unknown>): EmailContent {
  const subject = `New Trust & Safety report: ${metadata.report_type ?? 'report'}`
  const intro = 'A new Trust & Safety report was submitted on Equipd.'
  const rows = [
    detailRow('Report ID', metadata.report_id),
    detailRow('Type', metadata.report_type),
    detailRow('Reason', metadata.reason),
    detailRow('Reporter ID', metadata.reporter_id),
    detailRow('Reporter', metadata.reporter_label),
    detailRow('Reported user ID', metadata.reported_user_id),
    detailRow('Listing ID', metadata.listing_id),
    detailRow('Listing', metadata.listing_title),
    detailRow('Conversation ID', metadata.conversation_id),
    detailRow('Message ID', metadata.message_id),
    detailRow('Description', metadata.description),
  ].join('')

  const shell = buildEmailShell(
    'New Trust & Safety report',
    intro,
    rows,
    'Open Admin Support',
    adminSupportUrl(),
  )

  const text = [
    'New Trust & Safety report',
    '',
    intro,
    '',
    `Report ID: ${metadata.report_id ?? ''}`,
    `Type: ${metadata.report_type ?? ''}`,
    `Reason: ${metadata.reason ?? ''}`,
    `Reporter: ${metadata.reporter_label ?? metadata.reporter_id ?? ''}`,
    `Reported user ID: ${metadata.reported_user_id ?? ''}`,
    `Listing ID: ${metadata.listing_id ?? ''}`,
    `Conversation ID: ${metadata.conversation_id ?? ''}`,
    `Message ID: ${metadata.message_id ?? ''}`,
    '',
    'Description:',
    String(metadata.description ?? '(none)'),
    '',
    `Admin Support: ${adminSupportUrl()}`,
  ].join('\n')

  return { subject, text, html: shell.html }
}

function buildGeneralSupportEmail(metadata: Record<string, unknown>): EmailContent {
  const subjectLine = String(metadata.subject ?? 'General support enquiry')
  const subject = `General support: ${subjectLine}`
  const intro = 'A new message was submitted through the Equipd guided support flow.'
  const rows = [
    detailRow('Category', metadata.category),
    detailRow('Subcategory', metadata.subcategory),
    detailRow('Name', metadata.name),
    detailRow('Email', metadata.email),
    detailRow('Subject', metadata.subject),
    detailRow('User ID', metadata.user_id),
    detailRow('Message', metadata.message),
  ].join('')

  const shell = buildEmailShell(
    'New general support enquiry',
    intro,
    rows,
    'Open Admin Support',
    adminSupportUrl(),
  )

  const text = [
    'New general support enquiry',
    '',
    intro,
    '',
    `Category: ${metadata.category ?? ''}`,
    `Subcategory: ${metadata.subcategory ?? ''}`,
    `Name: ${metadata.name ?? ''}`,
    `Email: ${metadata.email ?? ''}`,
    `Subject: ${metadata.subject ?? ''}`,
    '',
    'Message:',
    String(metadata.message ?? ''),
    '',
    `Admin Support: ${adminSupportUrl()}`,
  ].join('\n')

  return { subject, text, html: shell.html }
}

export function buildSupportEmailContent(payload: SupportEmailPayload): EmailContent {
  switch (payload.eventType) {
    case 'support_request':
      return buildSupportRequestEmail(payload.metadata)
    case 'buyer_protection_dispute':
      return buildDisputeEmail(payload.metadata)
    case 'trust_safety_report':
      return buildReportEmail(payload.metadata)
    case 'general_support':
      return buildGeneralSupportEmail(payload.metadata)
    default:
      throw new Error(`Unsupported support email event type: ${payload.eventType}`)
  }
}

export async function sendSupportEmail(payload: SupportEmailPayload): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')

  if (!apiKey) {
    console.warn('send-support-email: RESEND_API_KEY is not configured; skipping email')
    return
  }

  const to = Deno.env.get('SUPPORT_EMAIL_TO') ?? DEFAULT_SUPPORT_TO
  const from = Deno.env.get('SUPPORT_EMAIL_FROM') ?? DEFAULT_FROM
  const { subject, text, html } = buildSupportEmailContent(payload)

  // TEMP: debug sender address passed to Resend — remove after email audit
  console.log('send-support-email: Resend from address', from)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend API error (${response.status}): ${body}`)
  }
}
