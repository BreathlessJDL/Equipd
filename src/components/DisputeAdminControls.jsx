import { useState } from 'react'
import {
  adminMarkDisputeUnderReview,
  adminResolveDisputeForBuyer,
  adminResolveDisputeForSeller,
  canAdminManageDispute,
  formatDisputeStatus,
  getDisputeErrorMessage,
} from '../lib/orderDisputes'
import './OrderDisputeSection.css'

function DisputeAdminControls({ dispute, onUpdated }) {
  const [adminNote, setAdminNote] = useState(dispute?.admin_note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = canAdminManageDispute(dispute)

  async function runAction(action) {
    if (!dispute?.id || submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    let result

    if (action === 'under_review') {
      result = await adminMarkDisputeUnderReview(dispute.id, adminNote)
    } else if (action === 'seller') {
      result = await adminResolveDisputeForSeller(dispute.id, adminNote)
    } else if (action === 'buyer') {
      result = await adminResolveDisputeForBuyer(dispute.id, adminNote)
    }

    setSubmitting(false)

    if (result?.error) {
      setError(getDisputeErrorMessage(result.error))
      return
    }

    setSuccess('Dispute updated.')
    onUpdated?.(result.data)
  }

  return (
    <div className="order-dispute__admin">
      <h3 className="order-dispute__admin-title">Admin resolution</h3>
      <p className="order-dispute__admin-lead">
        Internal controls for Equipd admins. Refunds are not automated yet.
      </p>

      <dl className="order-dispute__meta">
        <div className="order-dispute__row">
          <dt className="order-dispute__label">Status</dt>
          <dd className="order-dispute__value">{formatDisputeStatus(dispute.status)}</dd>
        </div>
        {dispute.admin_note ? (
          <div className="order-dispute__row order-dispute__row--description">
            <dt className="order-dispute__label">Admin note</dt>
            <dd className="order-dispute__value">{dispute.admin_note}</dd>
          </div>
        ) : null}
        {dispute.resolution ? (
          <div className="order-dispute__row order-dispute__row--description">
            <dt className="order-dispute__label">Resolution</dt>
            <dd className="order-dispute__value">{dispute.resolution}</dd>
          </div>
        ) : null}
      </dl>

      {canManage ? (
        <>
          <label className="order-dispute__admin-field">
            <span className="order-dispute__label">Admin note</span>
            <textarea
              value={adminNote}
              disabled={submitting}
              rows={4}
              placeholder="Internal note for Equipd review (optional)."
              onChange={(event) => setAdminNote(event.target.value)}
            />
          </label>

          <div className="order-dispute__admin-actions">
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary"
              disabled={submitting}
              onClick={() => runAction('under_review')}
            >
              Mark under review
            </button>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary"
              disabled={submitting}
              onClick={() => runAction('seller')}
            >
              Resolve for seller
            </button>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--primary"
              disabled={submitting}
              onClick={() => runAction('buyer')}
            >
              Resolve for buyer
            </button>
          </div>
        </>
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

export default DisputeAdminControls
