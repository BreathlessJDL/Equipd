import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
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
  getDisputeAdminMessage,
  getEquipdSupportUpdateFromDispute,
  getDisputeSingleReasonNote,
  getLatestOrderDispute,
  isBuyerProtectionWindowActive,
  isDisputeActive,
  isOrderDisputed,
  openOrderDispute,
} from '../lib/orderDisputes'
import { fetchOrderCaseReturnLogistics } from '../lib/caseReturn'
import {
  canShowParticipantCaseEvidenceUpload,
  isParticipantViewerRole,
} from '../lib/caseEvidence'
import {
  uploadDisputeEvidenceFile,
  validateIssueEvidenceFile,
} from '../lib/orderEvidence'
import { getEquipdSupportUpdateFromSupportRequest } from '../lib/supportRequests'
import OpenOrderDisputeModal from './OpenOrderDisputeModal'
import AddAdditionalEvidenceSection from './AddAdditionalEvidenceSection'
import CaseReturnWorkflow from './CaseReturnWorkflow'
import DisputeAdminControls from './DisputeAdminControls'
import IssueEvidenceList from './IssueEvidenceList'
import SupportUpdateCard from './SupportUpdateCard'
import './OrderDisputeSection.css'

function OrderDisputeSummary({ dispute, role }) {
  const showSellerEvidenceSection =
    role === 'seller' ||
    role === 'admin' ||
    (dispute.seller_response_evidence_paths?.length ?? 0) > 0

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
      {role === 'admin' && isDisputeActive(dispute) ? (
        <p className="order-dispute__message order-dispute__message--admin" role="status">
          {getDisputeAdminMessage()}
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

      <div className="order-dispute__evidence-sections">
        <IssueEvidenceList
          paths={dispute.evidence_paths}
          title="Buyer evidence"
          alwaysShow
          emptyHint={
            role === 'seller' || role === 'admin'
              ? 'No buyer evidence uploaded yet.'
              : 'No evidence uploaded yet.'
          }
        />
        {showSellerEvidenceSection ? (
          <IssueEvidenceList
            paths={dispute.seller_response_evidence_paths}
            title="Seller evidence"
            alwaysShow
            emptyHint={
              role === 'seller'
                ? 'Upload photos, videos, documents, courier proof, or messages that support your side of the case.'
                : 'No seller evidence uploaded yet.'
            }
          />
        ) : null}
      </div>
    </div>
  )
}

function OrderDisputeSection({
  order,
  payment,
  role,
  isAdmin = false,
  compact = false,
  allowReport = true,
  supportRequest = null,
  useCaseUpdateHistory = false,
  onDisputeOpened,
  onDisputeUpdated,
  onSupportUpdated,
}) {
  const { user } = useAuth()
  const userId = user?.id
  const [disputes, setDisputes] = useState([])
  const [returnLogistics, setReturnLogistics] = useState([])
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
    Boolean(displayDispute) ||
    (isOrderDisputed(order) && (isParticipantViewerRole(role) || isAdmin))
  const showAdminControls =
    isAdmin && (Boolean(displayDispute) || Boolean(supportRequest) || isOrderDisputed(order))
  const disputeSupportUpdate = useMemo(
    () => (displayDispute ? getEquipdSupportUpdateFromDispute(displayDispute, role) : null),
    [displayDispute, role],
  )
  const supportRequestUpdate = useMemo(
    () => (supportRequest ? getEquipdSupportUpdateFromSupportRequest(supportRequest) : null),
    [supportRequest],
  )
  const disputeEvidenceCase = activeDispute ? { type: 'dispute', record: activeDispute } : null
  const canUploadDisputeEvidence = canShowParticipantCaseEvidenceUpload(
    disputeEvidenceCase,
    order,
    role,
    userId,
  )
  const showClosedDisputeMessage =
    Boolean(displayDispute) && !activeDispute && isParticipantViewerRole(role)

  const refreshReturnWorkflow = useCallback(
    async (updatedDispute) => {
      if (updatedDispute?.id) {
        setDisputes((current) => [
          updatedDispute,
          ...current.filter((entry) => entry.id !== updatedDispute.id),
        ])
      } else if (order?.id) {
        const { data } = await fetchDisputesForOrder(order.id)
        setDisputes(data ?? [])
      }

      if (order?.id) {
        const { data: logistics } = await fetchOrderCaseReturnLogistics(order.id)
        setReturnLogistics(logistics ?? [])
      }

      onDisputeUpdated?.(updatedDispute)
    },
    [onDisputeUpdated, order?.id],
  )

  useEffect(() => {
    if (!order?.id) return undefined

    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await fetchDisputesForOrder(order.id)
      const { data: logistics } = await fetchOrderCaseReturnLogistics(order.id)

      if (!active) return

      if (fetchError) {
        setError(getDisputeErrorMessage(fetchError))
        setDisputes([])
      } else {
        setDisputes(data ?? [])
      }

      setReturnLogistics(logistics ?? [])

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
      const validationError = validateIssueEvidenceFile(file)
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
          {disputeSupportUpdate && !useCaseUpdateHistory ? (
            <SupportUpdateCard {...disputeSupportUpdate} />
          ) : null}
          {!disputeSupportUpdate && supportRequestUpdate && !useCaseUpdateHistory ? (
            <SupportUpdateCard {...supportRequestUpdate} />
          ) : null}
          {displayDispute ? (
            <OrderDisputeSummary dispute={displayDispute} role={role} />
          ) : (
            <p className="order-dispute__message" role="status">
              {role === 'buyer'
                ? getDisputeBuyerMessage()
                : role === 'admin'
                  ? getDisputeAdminMessage()
                  : getDisputeSellerMessage()}
            </p>
          )}
          {displayDispute && (isParticipantViewerRole(role) || isAdmin) ? (
            <CaseReturnWorkflow
              dispute={displayDispute}
              returnLogistics={returnLogistics}
              userId={userId}
              isAdminViewer={isAdmin}
              onUpdated={() => refreshReturnWorkflow()}
            />
          ) : null}
          {canUploadDisputeEvidence ? (
            <AddAdditionalEvidenceSection
              orderId={order.id}
              caseType="dispute"
              caseId={activeDispute.id}
              uploaderRole={role}
              onUploaded={(updatedDispute) => {
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
          {showClosedDisputeMessage ? (
            <p className="order-dispute__closed-notice" role="status">
              This case has been closed. You can no longer upload additional evidence.
            </p>
          ) : null}
          {showAdminControls ? (
            <DisputeAdminControls
              dispute={displayDispute}
              supportRequest={supportRequest}
              returnLogistics={returnLogistics}
              userId={userId}
              onDisputeUpdated={(updatedDispute) => {
                if (updatedDispute) {
                  setDisputes((current) => [
                    updatedDispute,
                    ...current.filter((entry) => entry.id !== updatedDispute.id),
                  ])
                }
                onDisputeUpdated?.(updatedDispute)
              }}
              onSupportUpdated={onSupportUpdated}
              onReturnUpdated={() => refreshReturnWorkflow()}
            />
          ) : null}
        </>
      ) : showAdminControls ? (
        <>
          <h2 id="order-dispute-summary-title" className="order-dispute__title">
            Dispute
          </h2>
          {supportRequestUpdate && !useCaseUpdateHistory ? (
            <SupportUpdateCard {...supportRequestUpdate} />
          ) : null}
          <DisputeAdminControls
            dispute={displayDispute}
            supportRequest={supportRequest}
            returnLogistics={returnLogistics}
            userId={userId}
            onDisputeUpdated={(updatedDispute) => {
              if (updatedDispute) {
                setDisputes((current) => [
                  updatedDispute,
                  ...current.filter((entry) => entry.id !== updatedDispute.id),
                ])
              }
              onDisputeUpdated?.(updatedDispute)
            }}
            onSupportUpdated={onSupportUpdated}
            onReturnUpdated={() => refreshReturnWorkflow()}
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
