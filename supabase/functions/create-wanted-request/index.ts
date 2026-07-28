import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendTransactionalEmail } from '../_shared/transactionalEmail.ts'
import { isDryRunMode } from '../_shared/transactionalEmailCore.js'
import { reserveEmailLog } from '../_shared/marketplaceEmailCore.js'
import {
  EQUIPMENT_REQUEST_TEMPLATE_KEY,
  buildEquipmentRequestEmailDynamicData,
  buildEquipmentRequestIdempotencyKey,
  formatWantedRequestEquipmentName,
  isValidWantedRequestEmail,
  resolveEquipmentRequestSupportTo,
  sanitizeWantedRequestPlainText,
  wantedRequestBudgetToPence,
  wantedRequestRadiusToKm,
} from '../_shared/wantedRequestEmail.js'

const CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BODY_BYTES = 32_768
const MAX_TEXT_FIELD_LENGTH = 500
const MAX_NOTES_LENGTH = 2_000
const MAX_URL_LENGTH = 2_000
const GUEST_RATE_LIMIT_PER_EMAIL = 5
const GUEST_RATE_LIMIT_WINDOW_MINUTES = 60
const AUTH_RATE_LIMIT_PER_USER = 20
const AUTH_RATE_LIMIT_WINDOW_MINUTES = 60

type WantedRequestBody = {
  clientRequestId?: string
  entryMode?: string
  productId?: string | null
  canonicalProductKey?: string | null
  productName?: string | null
  brand?: string | null
  equipmentType?: string | null
  manualBrand?: string | null
  manualModelName?: string | null
  searchTerm?: string | null
  location?: string
  radius?: string
  maximumBudget?: number | null
  conditionPreference?: string
  notes?: string
  email?: string
  source?: string
  currentPageUrl?: string
  saveAsAlert?: boolean
}

function getEnv(key: string): string {
  return Deno.env.get(key) ?? ''
}

function log(message: string, detail?: string) {
  if (detail) {
    console.error(message, detail)
    return
  }
  console.error(message)
}

function truncateTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 120) return trimmed.length >= 3 ? trimmed : 'Wanted equipment'
  return `${trimmed.slice(0, 117).trimEnd()}...`
}

async function finalizeEmailLog(
  admin: ReturnType<typeof getSupabaseAdmin>,
  logId: string | null | undefined,
  patch: Record<string, unknown>,
) {
  if (!logId) return
  await admin.from('transactional_email_log').update(patch).eq('id', logId)
}

async function sendWantedRequestEmail(params: {
  admin: ReturnType<typeof getSupabaseAdmin>
  wantedRequestId: string
  recipientType: 'buyer' | 'support'
  to: string
  recipientUserId: string | null
  dynamicData: Record<string, unknown>
}) {
  const { admin, wantedRequestId, recipientType, to, recipientUserId, dynamicData } = params
  const idempotencyKey = buildEquipmentRequestIdempotencyKey(recipientType, wantedRequestId)

  const reservation = await reserveEmailLog(admin, {
    template_key: EQUIPMENT_REQUEST_TEMPLATE_KEY,
    recipient_user_id: recipientUserId,
    recipient_email: to,
    status: 'pending',
    idempotency_key: idempotencyKey,
  })

  if (reservation.action === 'error') {
    log('create-wanted-request email log reservation failed', `${recipientType} ${reservation.error}`)
    return { ok: false, recipientType, error: reservation.error, idempotencyKey }
  }

  if (reservation.action === 'skip') {
    log(
      'create-wanted-request email duplicate skipped',
      `${recipientType} requestId=${wantedRequestId} reason=${reservation.reason}`,
    )
    return {
      ok: true,
      skipped: true,
      recipientType,
      reason: reservation.reason,
      idempotencyKey,
    }
  }

  if (isDryRunMode(getEnv)) {
    await finalizeEmailLog(admin, reservation.logId, {
      status: 'skipped',
      error_message: 'Dry-run mode (SendGrid not configured or EMAIL_DRY_RUN enabled)',
    })
    log(
      'create-wanted-request email dry-run',
      JSON.stringify({
        recipientType,
        requestId: wantedRequestId,
        to,
        templateKey: EQUIPMENT_REQUEST_TEMPLATE_KEY,
        subject: dynamicData.subject,
      }),
    )
    return { ok: true, dryRun: true, recipientType, idempotencyKey }
  }

  const sendResult = await sendTransactionalEmail({
    to,
    templateKey: EQUIPMENT_REQUEST_TEMPLATE_KEY,
    dynamicData,
  })

  if (!sendResult.ok) {
    const statusMatch = String(sendResult.error ?? '').match(/SendGrid API (\d+)/)
    const status = statusMatch?.[1] ?? 'unknown'
    await finalizeEmailLog(admin, reservation.logId, {
      status: 'failed',
      error_message: sendResult.error || 'SendGrid send failed',
      failed_at: new Date().toISOString(),
    })
    log(
      'create-wanted-request email send failed',
      JSON.stringify({
        requestId: wantedRequestId,
        recipientType,
        sendGridStatus: status,
      }),
    )
    return { ok: false, recipientType, error: sendResult.error, idempotencyKey, sendGridStatus: status }
  }

  if (sendResult.dryRun) {
    await finalizeEmailLog(admin, reservation.logId, {
      status: 'skipped',
      error_message: 'Transactional sender dry-run',
    })
    return { ok: true, dryRun: true, recipientType, idempotencyKey }
  }

  await finalizeEmailLog(admin, reservation.logId, {
    status: 'sent',
    provider_message_id: sendResult.messageId ?? null,
    sent_at: new Date().toISOString(),
    error_message: null,
    failed_at: null,
  })

  return {
    ok: true,
    recipientType,
    idempotencyKey,
    messageId: sendResult.messageId,
  }
}

function truncateField(value: unknown, maxLength: number): string {
  return sanitizeWantedRequestPlainText(value).slice(0, maxLength)
}

function validateBody(body: WantedRequestBody): { ok: true } | { ok: false; error: string } {
  const clientRequestId = String(body.clientRequestId ?? '').trim()
  if (!CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
    return { ok: false, error: 'clientRequestId must be a valid UUID' }
  }

  const entryMode = String(body.entryMode ?? '').trim()
  if (entryMode !== 'catalogue' && entryMode !== 'manual') {
    return { ok: false, error: 'entryMode must be catalogue or manual' }
  }

  const boundedFields: Array<[unknown, number, string]> = [
    [body.productName, MAX_TEXT_FIELD_LENGTH, 'productName'],
    [body.brand, MAX_TEXT_FIELD_LENGTH, 'brand'],
    [body.manualBrand, MAX_TEXT_FIELD_LENGTH, 'manualBrand'],
    [body.manualModelName, MAX_TEXT_FIELD_LENGTH, 'manualModelName'],
    [body.equipmentType, MAX_TEXT_FIELD_LENGTH, 'equipmentType'],
    [body.searchTerm, MAX_TEXT_FIELD_LENGTH, 'searchTerm'],
    [body.location, MAX_TEXT_FIELD_LENGTH, 'location'],
    [body.notes, MAX_NOTES_LENGTH, 'notes'],
    [body.currentPageUrl, MAX_URL_LENGTH, 'currentPageUrl'],
    [body.source, MAX_TEXT_FIELD_LENGTH, 'source'],
  ]

  for (const [value, maxLength, label] of boundedFields) {
    if (value != null && String(value).length > maxLength) {
      return { ok: false, error: `${label} is too long` }
    }
  }

  if (entryMode === 'catalogue') {
    const productId = String(body.productId ?? '').trim()
    const canonicalKey = String(body.canonicalProductKey ?? '').trim()
    const productName = sanitizeWantedRequestPlainText(body.productName)
    if (!productId && !canonicalKey) {
      return { ok: false, error: 'Catalogue requests require a selected product' }
    }
    if (!productName) {
      return { ok: false, error: 'Catalogue requests require a product name' }
    }
  } else {
    const manualModel = sanitizeWantedRequestPlainText(body.manualModelName ?? body.productName)
    const manualBrand = sanitizeWantedRequestPlainText(body.manualBrand ?? body.brand)
    if (!manualModel) {
      return { ok: false, error: 'Manual requests require a model or equipment name' }
    }
    if (!manualBrand) {
      return { ok: false, error: 'Manual requests require a brand' }
    }
  }

  if (body.maximumBudget != null && body.maximumBudget !== undefined) {
    const amount = Number(body.maximumBudget)
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
      return { ok: false, error: 'maximumBudget must be a valid non-negative number' }
    }
  }

  return { ok: true }
}

async function enforceCreateRateLimit(params: {
  admin: ReturnType<typeof getSupabaseAdmin>
  recipientUserId: string | null
  buyerEmail: string
  isRetry: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (params.isRetry) return { ok: true }

  const windowMinutes = params.recipientUserId
    ? AUTH_RATE_LIMIT_WINDOW_MINUTES
    : GUEST_RATE_LIMIT_WINDOW_MINUTES
  const limit = params.recipientUserId ? AUTH_RATE_LIMIT_PER_USER : GUEST_RATE_LIMIT_PER_EMAIL
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  let query = params.admin
    .from('wanted_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (params.recipientUserId) {
    query = query.eq('user_id', params.recipientUserId)
  } else {
    query = query.eq('contact_email', params.buyerEmail).is('user_id', null)
  }

  const { count, error } = await query
  if (error) {
    log('create-wanted-request rate limit lookup failed', error.message)
    return { ok: false, error: 'Failed to validate request rate' }
  }

  if ((count ?? 0) >= limit) {
    return {
      ok: false,
      error: 'Too many wanted requests were submitted recently. Please try again later.',
    }
  }

  return { ok: true }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse('Request body is too large', 413)
  }

  const templateId = getEnv('SENDGRID_TEMPLATE_EQUIPMENT_REQUEST').trim()
  if (!templateId) {
    log(
      'create-wanted-request: SENDGRID_TEMPLATE_EQUIPMENT_REQUEST is not configured',
      'Emails will dry-run or fail until the secret is set',
    )
  }

  let body: WantedRequestBody
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse('Request body is too large', 413)
    }
    body = JSON.parse(raw) as WantedRequestBody
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const validation = validateBody(body)
  if (!validation.ok) {
    return errorResponse(validation.error, 400)
  }

  try {
    const admin = getSupabaseAdmin()
    const user = await getAuthenticatedUser(req)
    const clientRequestId = String(body.clientRequestId).trim()

    // Idempotent retry: return existing row when the same clientRequestId was already persisted.
    const { data: existingRows, error: existingError } = await admin
      .from('wanted_requests')
      .select('id, user_id, contact_email, title, criteria')
      .contains('criteria', { clientRequestId })
      .limit(1)

    if (existingError) {
      log('create-wanted-request existing lookup failed', existingError.message)
      return errorResponse('Failed to check existing wanted request', 500)
    }

    const existing = existingRows?.[0] ?? null
    let wantedRequestId = existing?.id as string | undefined
    let created = false

    let buyerEmail = ''
    let recipientUserId: string | null = null
    let profile: Record<string, unknown> | null = null

    if (user) {
      recipientUserId = user.id
      buyerEmail = String(user.email ?? '').trim().toLowerCase()
      if (!buyerEmail || !isValidWantedRequestEmail(buyerEmail)) {
        return errorResponse('Authenticated user email is missing or invalid', 400)
      }
      if (!user.email_confirmed_at) {
        return errorResponse('Please verify your email before submitting a wanted request', 403)
      }

      const { data: profileRow } = await admin
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', user.id)
        .maybeSingle()
      profile = profileRow
    } else {
      buyerEmail = String(body.email ?? '').trim().toLowerCase()
      if (!buyerEmail || !isValidWantedRequestEmail(buyerEmail)) {
        return errorResponse('A valid email address is required', 400)
      }
    }

    const rateLimit = await enforceCreateRateLimit({
      admin,
      recipientUserId,
      buyerEmail,
      isRetry: Boolean(wantedRequestId),
    })
    if (!rateLimit.ok) {
      return errorResponse(rateLimit.error, 429)
    }

    const equipmentName = formatWantedRequestEquipmentName(body)
    const title = truncateTitle(equipmentName)
    const location = truncateField(body.location, MAX_TEXT_FIELD_LENGTH)
    const notes = truncateField(body.notes, MAX_NOTES_LENGTH)
    const radius = String(body.radius ?? 'nationwide').trim().slice(0, 32) || 'nationwide'
    const conditionPreference =
      String(body.conditionPreference ?? 'any').trim().slice(0, 64) || 'any'
    const maxPricePence = wantedRequestBudgetToPence(body.maximumBudget)
    const radiusKm = wantedRequestRadiusToKm(radius)
    const brand =
      sanitizeWantedRequestPlainText(
        body.entryMode === 'manual' ? body.manualBrand ?? body.brand : body.brand,
      ) || null
    const model =
      sanitizeWantedRequestPlainText(
        body.entryMode === 'manual'
          ? body.manualModelName ?? body.productName
          : body.productName,
      ) || null

    const criteria = {
      clientRequestId,
      entryMode: body.entryMode,
      productId: body.productId ?? null,
      canonicalProductKey: body.canonicalProductKey ?? null,
      productName: sanitizeWantedRequestPlainText(body.productName) || null,
      equipmentType: sanitizeWantedRequestPlainText(body.equipmentType) || null,
      manualBrand: sanitizeWantedRequestPlainText(body.manualBrand) || null,
      manualModelName: sanitizeWantedRequestPlainText(body.manualModelName) || null,
      searchTerm: sanitizeWantedRequestPlainText(body.searchTerm) || null,
      radius,
      conditionPreference,
      maximumBudget: body.maximumBudget ?? null,
      source: sanitizeWantedRequestPlainText(body.source) || 'homepage',
      currentPageUrl: sanitizeWantedRequestPlainText(body.currentPageUrl) || null,
      saveAsAlert: Boolean(body.saveAsAlert),
      emails: {
        buyer: false,
        support: false,
      },
    }

    if (!wantedRequestId) {
      const insertRow = {
        user_id: recipientUserId,
        contact_email: buyerEmail,
        title,
        description: notes || null,
        brand,
        model,
        max_price_pence: maxPricePence,
        location: location || null,
        radius_km: radiusKm,
        criteria,
        status: 'active',
      }

      const { data: inserted, error: insertError } = await admin
        .from('wanted_requests')
        .insert(insertRow)
        .select('id')
        .single()

      if (insertError || !inserted?.id) {
        // Race on duplicate clientRequestId: re-fetch existing
        if (insertError?.code === '23505' || /duplicate|unique/i.test(insertError?.message ?? '')) {
          const { data: raced } = await admin
            .from('wanted_requests')
            .select('id')
            .contains('criteria', { clientRequestId })
            .limit(1)
          if (raced?.[0]?.id) {
            wantedRequestId = raced[0].id
          } else {
            log('create-wanted-request insert failed', insertError?.message ?? 'unknown')
            return errorResponse('Failed to create wanted request', 500)
          }
        } else {
          log('create-wanted-request insert failed', insertError?.message ?? 'unknown')
          return errorResponse(insertError?.message ?? 'Failed to create wanted request', 500)
        }
      } else {
        wantedRequestId = inserted.id
        created = true
      }
    }

    if (!wantedRequestId) {
      return errorResponse('Failed to resolve wanted request id', 500)
    }

    const emailPayload = {
      entryMode: body.entryMode,
      productName: body.productName,
      brand: body.brand,
      model,
      manualBrand: body.manualBrand,
      manualModelName: body.manualModelName,
      location,
      radius,
      maximumBudget: body.maximumBudget ?? null,
      conditionPreference,
      notes,
    }

    const buyerDynamicData = buildEquipmentRequestEmailDynamicData({
      payload: emailPayload,
      profile,
      buyerEmail,
      recipientType: 'buyer',
      getEnv,
    })

    const supportDynamicData = buildEquipmentRequestEmailDynamicData({
      payload: emailPayload,
      profile,
      buyerEmail,
      recipientType: 'support',
      getEnv,
    })

    const supportTo = resolveEquipmentRequestSupportTo(getEnv)

    const buyerResult = await sendWantedRequestEmail({
      admin,
      wantedRequestId,
      recipientType: 'buyer',
      to: existing?.contact_email || buyerEmail,
      recipientUserId: existing?.user_id ?? recipientUserId,
      dynamicData: buyerDynamicData,
    })

    const supportResult = await sendWantedRequestEmail({
      admin,
      wantedRequestId,
      recipientType: 'support',
      to: supportTo,
      recipientUserId: null,
      dynamicData: supportDynamicData,
    })

    function emailAttemptStatus(result: {
      ok?: boolean
      skipped?: boolean
      dryRun?: boolean
    }) {
      if (result.skipped) return 'skipped'
      if (result.dryRun) return 'dry_run'
      if (result.ok) return 'sent'
      return 'failed'
    }

    // Best-effort criteria flag update for ops visibility (does not gate response).
    try {
      const baseCriteria =
        existing?.criteria && typeof existing.criteria === 'object' && !Array.isArray(existing.criteria)
          ? (existing.criteria as Record<string, unknown>)
          : criteria

      await admin
        .from('wanted_requests')
        .update({
          criteria: {
            ...baseCriteria,
            emails: {
              buyer: emailAttemptStatus(buyerResult) === 'sent' || emailAttemptStatus(buyerResult) === 'skipped',
              support:
                emailAttemptStatus(supportResult) === 'sent' ||
                emailAttemptStatus(supportResult) === 'skipped',
              buyerStatus: emailAttemptStatus(buyerResult),
              supportStatus: emailAttemptStatus(supportResult),
            },
          },
        })
        .eq('id', wantedRequestId)
    } catch (criteriaError) {
      const message = criteriaError instanceof Error ? criteriaError.message : String(criteriaError)
      log('create-wanted-request criteria email status update failed', message)
    }

    return jsonResponse({
      ok: true,
      id: wantedRequestId,
      created,
      emails: {
        buyer: {
          ok: Boolean(buyerResult.ok),
          skipped: Boolean(buyerResult.skipped),
          dryRun: Boolean(buyerResult.dryRun),
        },
        support: {
          ok: Boolean(supportResult.ok),
          skipped: Boolean(supportResult.skipped),
          dryRun: Boolean(supportResult.dryRun),
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('create-wanted-request unexpected error', message)
    return errorResponse('Failed to create wanted request', 500)
  }
})
