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

function adminOrdersUrl(): string {
  return `${appBaseUrl()}/admin/orders`
}

function orderPath(orderId: unknown): string {
  const id = String(orderId ?? '').trim()
  return id ? `/orders/${id}` : ''
}

function formatEvidenceDetails(metadata: Record<string, unknown>): { count: string; list: string } {
  const rawPaths = metadata.evidence_paths
  if (Array.isArray(rawPaths) && rawPaths.length > 0) {
    return {
      count: String(rawPaths.length),
      list: rawPaths.map((path, index) => `${index + 1}. ${String(path)}`).join('\n'),
    }
  }

  const count = metadata.evidence_count
  return {
    count: count != null && count !== '' ? String(count) : '0',
    list: '',
  }
}

function contactLabel(name: unknown, email: unknown, fallbackId?: unknown): string {
  const safeName = String(name ?? '').trim()
  const safeEmail = String(email ?? '').trim()
  if (safeName && safeEmail) return `${safeName} <${safeEmail}>`
  if (safeEmail) return safeEmail
  if (safeName) return safeName
  if (fallbackId != null && fallbackId !== '') return String(fallbackId)
  return ''
}

function orderUrl(orderId: string): string {
  return `${appBaseUrl()}${orderPath(orderId)}`
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
  const orderId = String(metadata.order_id ?? '')
  const evidence = formatEvidenceDetails(metadata)
  const reporterName = metadata.reporter_name ?? metadata.opened_by_label
  const reporterEmail = metadata.reporter_email
  const description = metadata.description ?? metadata.message
  const subject = `New support request: ${listingTitle}`
  const intro = 'A transaction support request was raised on Equipd and needs review.'
  const rows = [
    detailRow('Request ID', metadata.request_id),
    detailRow('Order ID', orderId),
    detailRow('Listing', listingTitle),
    detailRow('Reason', metadata.reason),
    detailRow('Reporter', contactLabel(reporterName, reporterEmail, metadata.opened_by)),
    detailRow('Reporter email', reporterEmail),
    detailRow('Buyer', contactLabel(metadata.buyer_name, metadata.buyer_email, metadata.buyer_id)),
    detailRow('Buyer email', metadata.buyer_email),
    detailRow('Seller', contactLabel(metadata.seller_name, metadata.seller_email, metadata.seller_id)),
    detailRow('Seller email', metadata.seller_email),
    detailRow('Evidence files', evidence.count),
    detailRow('Evidence paths', evidence.list),
    detailRow('Description', description),
    detailRow('Order page', orderId ? orderUrl(orderId) : ''),
    detailRow('Admin orders', adminOrdersUrl()),
  ].join('')

  const shell = buildEmailShell(
    'New transaction support request',
    intro,
    rows,
    orderId ? 'View order' : 'Open Admin Support',
    orderId ? orderUrl(orderId) : adminSupportUrl(),
  )

  const text = [
    'New transaction support request',
    '',
    intro,
    '',
    `Request ID: ${metadata.request_id ?? ''}`,
    `Order ID: ${orderId}`,
    `Listing: ${listingTitle}`,
    `Reason: ${metadata.reason ?? ''}`,
    `Reporter: ${contactLabel(reporterName, reporterEmail, metadata.opened_by)}`,
    `Reporter email: ${reporterEmail ?? ''}`,
    `Buyer: ${contactLabel(metadata.buyer_name, metadata.buyer_email, metadata.buyer_id)}`,
    `Buyer email: ${metadata.buyer_email ?? ''}`,
    `Seller: ${contactLabel(metadata.seller_name, metadata.seller_email, metadata.seller_id)}`,
    `Seller email: ${metadata.seller_email ?? ''}`,
    `Evidence files: ${evidence.count}`,
    evidence.list ? `Evidence paths:\n${evidence.list}` : '',
    '',
    'Description:',
    String(description ?? ''),
    '',
    orderId ? `Order: ${orderUrl(orderId)}` : '',
    `Admin orders: ${adminOrdersUrl()}`,
    `Admin support: ${adminSupportUrl()}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, text, html: shell.html }
}

function buildDisputeEmail(metadata: Record<string, unknown>): EmailContent {
  const listingTitle = String(metadata.listing_title ?? 'Order')
  const orderId = String(metadata.order_id ?? '')
  const evidence = formatEvidenceDetails(metadata)
  const reporterName = metadata.reporter_name ?? metadata.buyer_name
  const reporterEmail = metadata.reporter_email ?? metadata.buyer_email
  const subject = `New Buyer Protection dispute: ${listingTitle}`
  const intro =
    'A buyer opened a Buyer Protection dispute. Seller payout is on hold until Equipd reviews the case.'
  const rows = [
    detailRow('Dispute ID', metadata.dispute_id),
    detailRow('Order ID', orderId),
    detailRow('Listing', listingTitle),
    detailRow('Order type', metadata.order_type),
    detailRow('Reason', metadata.reason),
    detailRow('Reporter', contactLabel(reporterName, reporterEmail, metadata.buyer_id)),
    detailRow('Reporter email', reporterEmail),
    detailRow('Buyer', contactLabel(metadata.buyer_name, metadata.buyer_email, metadata.buyer_id)),
    detailRow('Buyer email', metadata.buyer_email),
    detailRow('Seller', contactLabel(metadata.seller_name, metadata.seller_email, metadata.seller_id)),
    detailRow('Seller email', metadata.seller_email),
    detailRow('Evidence files', evidence.count),
    detailRow('Evidence paths', evidence.list),
    detailRow('Description', metadata.description),
    detailRow('Order page', orderId ? orderUrl(orderId) : ''),
    detailRow('Admin orders', adminOrdersUrl()),
  ].join('')

  const shell = buildEmailShell(
    'New Buyer Protection dispute',
    intro,
    rows,
    orderId ? 'View order' : 'Open Admin Support',
    orderId ? orderUrl(orderId) : adminSupportUrl(),
  )

  const text = [
    'New Buyer Protection dispute',
    '',
    intro,
    '',
    `Dispute ID: ${metadata.dispute_id ?? ''}`,
    `Order ID: ${orderId}`,
    `Listing: ${listingTitle}`,
    `Order type: ${metadata.order_type ?? ''}`,
    `Reason: ${metadata.reason ?? ''}`,
    `Reporter: ${contactLabel(reporterName, reporterEmail, metadata.buyer_id)}`,
    `Reporter email: ${reporterEmail ?? ''}`,
    `Buyer: ${contactLabel(metadata.buyer_name, metadata.buyer_email, metadata.buyer_id)}`,
    `Buyer email: ${metadata.buyer_email ?? ''}`,
    `Seller: ${contactLabel(metadata.seller_name, metadata.seller_email, metadata.seller_id)}`,
    `Seller email: ${metadata.seller_email ?? ''}`,
    `Evidence files: ${evidence.count}`,
    evidence.list ? `Evidence paths:\n${evidence.list}` : '',
    '',
    'Description:',
    String(metadata.description ?? ''),
    '',
    orderId ? `Order: ${orderUrl(orderId)}` : '',
    `Admin orders: ${adminOrdersUrl()}`,
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
