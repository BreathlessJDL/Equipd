import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  canBuyerOpenDispute,
  fetchDisputesForOrder,
  formatDisputeReason,
  formatDisputeStatus,
  formatDisputeTimestamp,
  getActiveOrderDispute,
  getBuyerProtectionTimeRemaining,
  getDisputeBuyerMessage,
  getDisputeErrorMessage,
  getDisputeReasonOptions,
  getDisputeSellerMessage,
  getDisputeResolutionMessage,
  getDisputeSingleReasonNote,
  getLatestOrderDispute,
  isBuyerProtectionWindowActive,
  isDisputeActive,
  isOrderDisputed,
  openOrderDispute,
} from '../lib/orderDisputes'
import {
  getOrderEvidenceSignedUrls,
  uploadDisputeEvidenceFile,
  validateEvidenceImageFile,
} from '../lib/orderEvidence'
import OpenOrderDisputeModal from './OpenOrderDisputeModal'
import DisputeAdminControls from './DisputeAdminControls'
import './OrderDisputeSection.css'

function DisputeEvidenceThumbnails({ paths }) {
  const [urlsByPath, setUrlsByPath] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const signed = await getOrderEvidenceSignedUrls(paths ?? [])
      if (!active) return
      setUrlsByPath(signed)
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [paths])

  if (!paths?.length) return null

  return (
    <ul className="order-dispute__evidence-list">
      {paths.map((path) => {
        const entry = urlsByPath[path]
        const url = entry?.url

        return (
          <li key={path} className="order-dispute__evidence-item">
            {loading ? (
              <span className="order-dispute__evidence-loading">Loading…</span>
            ) : url ? (
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="order-dispute__evidence-thumb" />
              </a>
            ) : (
              <span className="order-dispute__evidence-missing">Evidence unavailable</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function OrderDisputeSummary({ dispute, role }) {
  const resolutionMessage = getDisputeResolutionMessage(dispute)

  return (
    <div className="order-dispute__summary">
      {role === 'buyer' && isDisputeActive(dispute) ? (
        <p className="order-dispute__message order-dispute__message--buyer" role="status">
          {getDisputeBuyerMessage()}
        </p>
      ) : null}
      {role === 'seller' && isDisputeActive(dispute) ? (
        <p className="order-dispute__message order-dispute__message--seller" role="status">
          {getDisputeSellerMessage()}
        </p>
      ) : null}
      {resolutionMessage ? (
        <p className="order-dispute__message order-dispute__message--resolution" role="status">
          {resolutionMessage}
        </p>
      ) : null}

      <dl className="order-dispute__meta">
        <div className="order-dispute__row">
          <dt className="order-dispute__label">Status</dt>
          <dd className="order-dispute__value">{formatDisputeStatus(dispute.status)}</dd>
        </div>
        <div className="order-dispute__row">
          <dt className="order-dispute__label">Reason</dt>
          <dd className="order-dispute__value">{formatDisputeReason(dispute.reason)}</dd>
        </div>
        <div className="order-dispute__row">
          <dt className="order-dispute__label">Opened</dt>
          <dd className="order-dispute__value">{formatDisputeTimestamp(dispute.created_at)}</dd>
        </div>
        <div className="order-dispute__row order-dispute__row--description">
          <dt className="order-dispute__label">Description</dt>
          <dd className="order-dispute__value">{dispute.description}</dd>
        </div>
      </dl>

      <div className="order-dispute__evidence">
        <h4 className="order-dispute__evidence-title">Evidence</h4>
        <DisputeEvidenceThumbnails paths={dispute.evidence_paths} />
      </div>
    </div>
  )
}

function OrderDisputeSection({
  order,
  payment,
  role,
  compact = false,
  allowReport = true,
  onDisputeOpened,
  onDisputeUpdated,
}) {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const activeDispute = useMemo(() => getActiveOrderDispute(disputes), [disputes])
  const latestDispute = useMemo(() => getLatestOrderDispute(disputes), [disputes])
  const displayDispute = activeDispute ?? latestDispute
  const protectionWindowActive = isBuyerProtectionWindowActive(order)
  const timeRemaining = getBuyerProtectionTimeRemaining(order)
  const canOpen = role === 'buyer' && canBuyerOpenDispute(order, payment, disputes)
  const showProtectionPanel =
    role === 'buyer' && protectionWindowActive && !activeDispute && !isOrderDisputed(order)
  const showDisputeSummary =
    Boolean(displayDispute) || (isOrderDisputed(order) && role !== 'admin')
  const showAdminControls = role === 'admin' && Boolean(displayDispute)

  useEffect(() => {
    if (!order?.id) return undefined

    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await fetchDisputesForOrder(order.id)

      if (!active) return

      if (fetchError) {
        setError(getDisputeErrorMessage(fetchError))
        setDisputes([])
      } else {
        setDisputes(data ?? [])
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [order?.id, order?.fulfilment_status, order?.payout_release_at])

  async function handleSubmitDispute({ reason, description, evidenceFiles }) {
    if (!order?.id || submitting) return

    setSubmitting(true)
    setSubmitError('')

    for (const file of evidenceFiles) {
      const validationError = validateEvidenceImageFile(file)
      if (validationError) {
        setSubmitting(false)
        setSubmitError(validationError)
        return
      }
    }

    const disputeId = crypto.randomUUID()
    const evidencePaths = []

    for (const file of evidenceFiles) {
      const { path, error: uploadError } = await uploadDisputeEvidenceFile(
        order.id,
        disputeId,
        file,
      )

      if (uploadError) {
        setSubmitting(false)
        setSubmitError(getDisputeErrorMessage(uploadError))
        return
      }

      evidencePaths.push(path)
    }

    const { data, error: openError } = await openOrderDispute({
      orderId: order.id,
      disputeId,
      reason,
      description,
      evidencePaths,
    })

    setSubmitting(false)

    if (openError) {
      setSubmitError(getDisputeErrorMessage(openError))
      return
    }

    setShowModal(false)
    setDisputes((current) => [data, ...current.filter((entry) => entry.id !== data.id)])
    onDisputeOpened?.(data)
  }

  if (loading) return null

  if (!showProtectionPanel && !showDisputeSummary && !showAdminControls && !error) return null

  return (
    <section
      className={`order-dispute${compact ? ' order-dispute--compact' : ''}`}
      aria-labelledby={showDisputeSummary ? 'order-dispute-summary-title' : 'order-dispute-title'}
    >
      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}

      {showProtectionPanel ? (
        <div className="order-dispute__protection">
          <h2 id="order-dispute-title" className="order-dispute__title">
            Buyer Protection
          </h2>
          <p className="order-dispute__lead" role="status">
            Your Buyer Protection window is active
            {timeRemaining ? ` — ${timeRemaining}` : ''}.
          </p>
          <p className="order-dispute__hint">
            {allowReport
              ? 'If something is wrong with the item, report a problem before the window ends. This pauses seller payout while Equipd reviews the issue.'
              : 'Your Buyer Protection window is active for this order. Open the order details page to report a problem with full order context.'}
          </p>
          {allowReport && canOpen ? (
            <button
              type="button"
              className="order-dispute__report-button"
              onClick={() => {
                setSubmitError('')
                setShowModal(true)
              }}
            >
              Report problem
            </button>
          ) : null}
          {!allowReport && order?.id ? (
            <Link to={`/orders/${order.id}`} className="order-dispute__order-link">
              View order
            </Link>
          ) : null}
        </div>
      ) : null}

      {showDisputeSummary ? (
        <>
          <h2 id="order-dispute-summary-title" className="order-dispute__title">
            Dispute
          </h2>
          {displayDispute ? (
            <OrderDisputeSummary dispute={displayDispute} role={role} />
          ) : (
            <p className="order-dispute__message" role="status">
              {role === 'buyer' ? getDisputeBuyerMessage() : getDisputeSellerMessage()}
            </p>
          )}
          {showAdminControls ? (
            <DisputeAdminControls
              dispute={displayDispute}
              onUpdated={(updatedDispute) => {
                if (updatedDispute) {
                  setDisputes((current) => [
                    updatedDispute,
                    ...current.filter((entry) => entry.id !== updatedDispute.id),
                  ])
                }
                onDisputeUpdated?.(updatedDispute)
              }}
            />
          ) : null}
        </>
      ) : showAdminControls ? (
        <>
          <h2 id="order-dispute-summary-title" className="order-dispute__title">
            Dispute
          </h2>
          <DisputeAdminControls
            dispute={displayDispute}
            onUpdated={(updatedDispute) => {
              if (updatedDispute) {
                setDisputes((current) => [
                  updatedDispute,
                  ...current.filter((entry) => entry.id !== updatedDispute.id),
                ])
              }
              onDisputeUpdated?.(updatedDispute)
            }}
          />
        </>
      ) : null}

      {showModal && allowReport ? (
        <OpenOrderDisputeModal
          orderType={order.order_type}
          reasonOptions={getDisputeReasonOptions(order.order_type)}
          singleReasonNote={getDisputeSingleReasonNote(order.order_type)}
          submitting={submitting}
          error={submitError}
          onClose={() => {
            if (!submitting) setShowModal(false)
          }}
          onSubmit={handleSubmitDispute}
        />
      ) : null}
    </section>
  )
}

export default OrderDisputeSection
