import { useState } from 'react'
import {
  adminIssueCaseRefundPending,
  buyerConfirmCaseCollection,
  canAdminIssueRefundAfterCollection,
  canBuyerConfirmCollection,
  canSellerArrangeCollection,
  formatCollectionDate,
  formatReturnTimestamp,
  getReturnLogisticsForDispute,
  getCaseReturnErrorMessage,
  isReturnWorkflowDispute,
  sellerArrangeCaseCollection,
} from '../lib/caseReturn'
import { getDefaultAdminDecisionCustomerMessage } from '../lib/adminDecisionMessages'
import { ADMIN_DISPUTE_DECISIONS } from '../lib/orderDisputes'
import './OrderDisputeSection.css'

function CaseReturnWorkflow({
  dispute,
  returnLogistics,
  userId,
  isAdminViewer = false,
  onUpdated,
}) {
  const [collectionDate, setCollectionDate] = useState('')
  const [courierName, setCourierName] = useState('')
  const [trackingReference, setTrackingReference] = useState('')
  const [sellerMessage, setSellerMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const logistics = getReturnLogisticsForDispute(returnLogistics, dispute?.id)
  const showReturnPanel = isReturnWorkflowDispute(dispute) || Boolean(logistics)
  const showSellerForm = canSellerArrangeCollection(dispute, userId)
  const showBuyerConfirm = canBuyerConfirmCollection(dispute, userId)

  if (!dispute || !showReturnPanel) return null

  async function handleSellerSubmit(event) {
    event.preventDefault()
    if (!showSellerForm || submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const { error: submitError } = await sellerArrangeCaseCollection({
      disputeId: dispute.id,
      collectionDate,
      courierName,
      trackingReference,
      messageToBuyer: sellerMessage,
    })

    setSubmitting(false)

    if (submitError) {
      setError(getCaseReturnErrorMessage(submitError))
      return
    }

    setSuccess('Collection details submitted.')
    onUpdated?.()
  }

  async function handleBuyerConfirm() {
    if (!showBuyerConfirm || submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const { error: submitError } = await buyerConfirmCaseCollection(dispute.id)

    setSubmitting(false)

    if (submitError) {
      setError(getCaseReturnErrorMessage(submitError))
      return
    }

    setSuccess('Collection confirmed.')
    onUpdated?.()
  }

  return (
    <div className="order-case-return">
      <h3 className="order-case-return__title">Return &amp; collection</h3>

      {isAdminViewer && logistics ? (
        <dl className="order-dispute__meta order-case-return__meta">
          <div className="order-dispute__row">
            <dt className="order-dispute__label">Authorised</dt>
            <dd className="order-dispute__value">{formatReturnTimestamp(logistics.authorised_at)}</dd>
          </div>
          <div className="order-dispute__row">
            <dt className="order-dispute__label">Collection deadline</dt>
            <dd className="order-dispute__value">
              {formatReturnTimestamp(logistics.collection_deadline_at)}
            </dd>
          </div>
          {logistics.arranged_at ? (
            <>
              <div className="order-dispute__row">
                <dt className="order-dispute__label">Collection date</dt>
                <dd className="order-dispute__value">
                  {formatCollectionDate(logistics.collection_date)}
                </dd>
              </div>
              <div className="order-dispute__row">
                <dt className="order-dispute__label">Courier</dt>
                <dd className="order-dispute__value">{logistics.courier_name}</dd>
              </div>
              {logistics.tracking_reference ? (
                <div className="order-dispute__row">
                  <dt className="order-dispute__label">Tracking / reference</dt>
                  <dd className="order-dispute__value">{logistics.tracking_reference}</dd>
                </div>
              ) : null}
              {logistics.seller_message_to_buyer ? (
                <div className="order-dispute__row order-dispute__row--description">
                  <dt className="order-dispute__label">Seller message</dt>
                  <dd className="order-dispute__value">{logistics.seller_message_to_buyer}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {logistics.confirmed_at ? (
            <div className="order-dispute__row">
              <dt className="order-dispute__label">Collection confirmed</dt>
              <dd className="order-dispute__value">{formatReturnTimestamp(logistics.confirmed_at)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {showSellerForm ? (
        <form className="order-case-return__form" onSubmit={handleSellerSubmit}>
          <p className="order-case-return__lead">
            Equipd has authorised a return. As the seller, you must arrange and pay for collection
            within 7 calendar days. The buyer should make the equipment reasonably available.
          </p>
          <p className="order-case-return__hint">
            If collection is not arranged within 7 days, Equipd cannot guarantee the return or
            continued availability of the equipment.
          </p>

          <label className="order-dispute__admin-field">
            <span className="order-dispute__label">Collection date</span>
            <input
              type="date"
              value={collectionDate}
              disabled={submitting}
              required
              onChange={(event) => setCollectionDate(event.target.value)}
            />
          </label>

          <label className="order-dispute__admin-field">
            <span className="order-dispute__label">Courier / company</span>
            <input
              type="text"
              value={courierName}
              disabled={submitting}
              required
              onChange={(event) => setCourierName(event.target.value)}
            />
          </label>

          <label className="order-dispute__admin-field">
            <span className="order-dispute__label">Tracking / reference</span>
            <input
              type="text"
              value={trackingReference}
              disabled={submitting}
              required
              onChange={(event) => setTrackingReference(event.target.value)}
            />
          </label>

          <label className="order-dispute__admin-field">
            <span className="order-dispute__label">Message to buyer (optional)</span>
            <textarea
              value={sellerMessage}
              disabled={submitting}
              rows={3}
              onChange={(event) => setSellerMessage(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="order-dispute__report-button"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Arrange collection'}
          </button>
        </form>
      ) : null}

      {logistics?.arranged_at && !logistics.confirmed_at ? (
        <div className="order-case-return__details">
          <h4 className="order-case-return__subtitle">Collection details</h4>
          <dl className="order-dispute__meta">
            <div className="order-dispute__row">
              <dt className="order-dispute__label">Collection date</dt>
              <dd className="order-dispute__value">{formatCollectionDate(logistics.collection_date)}</dd>
            </div>
            <div className="order-dispute__row">
              <dt className="order-dispute__label">Courier</dt>
              <dd className="order-dispute__value">{logistics.courier_name}</dd>
            </div>
            {logistics.tracking_reference ? (
              <div className="order-dispute__row">
                <dt className="order-dispute__label">Tracking / reference</dt>
                <dd className="order-dispute__value">{logistics.tracking_reference}</dd>
              </div>
            ) : null}
            {logistics.seller_message_to_buyer ? (
              <div className="order-dispute__row order-dispute__row--description">
                <dt className="order-dispute__label">Message from seller</dt>
                <dd className="order-dispute__value">{logistics.seller_message_to_buyer}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {showBuyerConfirm ? (
        <div className="order-case-return__buyer-confirm">
          <p className="order-case-return__lead">
            The seller has arranged collection. Only confirm once the equipment has actually been
            collected.
          </p>
          <button
            type="button"
            className="order-dispute__report-button"
            disabled={submitting}
            onClick={handleBuyerConfirm}
          >
            {submitting ? 'Confirming…' : 'Confirm collection completed'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-dispute__admin-success" role="status">
          {success}
        </p>
      ) : null}
    </div>
  )
}

export function CaseReturnAdminRefundAction({
  dispute,
  adminNote,
  customerMessage,
  onAdminNoteChange,
  onCustomerMessageChange,
  onUpdated,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!canAdminIssueRefundAfterCollection(dispute)) return null

  async function handleIssueRefund() {
    if (submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const { data, error: submitError } = await adminIssueCaseRefundPending({
      disputeId: dispute.id,
      adminNote,
      customerMessage:
        customerMessage?.trim() ||
        getDefaultAdminDecisionCustomerMessage(ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_AFTER_COLLECTION),
    })

    setSubmitting(false)

    if (submitError) {
      setError(getCaseReturnErrorMessage(submitError))
      return
    }

    setSuccess('Refund marked as pending.')
    onUpdated?.(data)
  }

  return (
    <div className="order-case-return__admin-refund">
      <p className="order-case-return__lead">
        Collection is confirmed. Mark the refund as pending once you have started processing it
        manually.
      </p>
      <button
        type="button"
        className="listing-detail__button listing-detail__button--primary"
        disabled={submitting}
        onClick={handleIssueRefund}
      >
        {submitting ? 'Saving…' : 'Mark refund pending'}
      </button>
      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-dispute__admin-success" role="status">
          {success}
        </p>
      ) : null}
    </div>
  )
}

export default CaseReturnWorkflow
