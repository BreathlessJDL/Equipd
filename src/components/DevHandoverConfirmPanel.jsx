import { useState } from 'react'
import {
  devConfirmOrderHandover,
  getCollectionQrErrorMessage,
} from '../lib/collectionQr'
import { ORDER_TYPES } from '../lib/orders'

function DevHandoverConfirmPanel({ order, onConfirmed }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const isSellerDelivery = order?.order_type === ORDER_TYPES.SELLER_DELIVERY
  const handoverLabel = isSellerDelivery ? 'handover' : 'collection'

  async function handleConfirm() {
    if (!order?.id || submitting || confirmed) return

    setSubmitting(true)
    setError('')

    const { error: confirmError } = await devConfirmOrderHandover(order.id)

    if (confirmError) {
      setError(getCollectionQrErrorMessage(confirmError))
      setSubmitting(false)
      return
    }

    setConfirmed(true)
    setSubmitting(false)
    onConfirmed?.()
  }

  return (
    <section className="order-detail__dev-handover" aria-labelledby="dev-handover-title">
      <h2 id="dev-handover-title" className="order-detail__section-title">
        Dev/Test {handoverLabel}
      </h2>
      <p className="order-detail__message order-detail__message--dev-warning" role="note">
        Admin testing only — bypasses QR scanning. Visible to Equipd admins on order detail.
      </p>
      {confirmed ? (
        <p className="order-detail__message order-detail__message--notice" role="status">
          {isSellerDelivery ? 'Handover' : 'Collection'} confirmed for testing. Buyer Protection has
          started with the same server-side logic as a QR scan.
        </p>
      ) : (
        <>
          <p className="order-detail__message order-detail__message--notice">
            Confirm {handoverLabel} without scanning the QR code. This calls the same backend
            confirmation logic as a successful buyer scan.
          </p>
          <button
            type="button"
            className="order-detail__dev-handover-button"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Confirming…' : 'Dev/Test: Confirm handover'}
          </button>
          {error ? (
            <p className="order-detail__message order-detail__message--error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function canShowDevHandoverConfirm({ order, payment, user, isAdmin }) {
  if (!user || !order || !payment || !isAdmin) return false

  if (payment.status !== 'paid') return false

  const orderType = order.order_type ?? ORDER_TYPES.COLLECTION
  const isCollection = orderType === ORDER_TYPES.COLLECTION
  const isSellerDelivery = orderType === ORDER_TYPES.SELLER_DELIVERY

  if (!isCollection && !isSellerDelivery) return false

  if (isCollection && order.fulfilment_status !== 'awaiting_collection') return false
  if (isSellerDelivery && order.fulfilment_status !== 'awaiting_seller_delivery') return false

  return true
}

export default DevHandoverConfirmPanel
