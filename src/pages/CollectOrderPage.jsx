import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PaymentCheckoutSummary from '../components/PaymentCheckoutSummary'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import {
  buildCollectionConfirmationChecks,
  confirmCollectionByQr,
  fetchCollectionQrPreview,
  getCollectionQrErrorMessage,
} from '../lib/collectionQr'
import { formatOrderTimestamp } from '../lib/orders'
import './CollectOrderPage.css'
import '../components/PageStub.css'

function isSellerDeliveryPreview(preview) {
  return preview?.order_type === 'seller_delivery'
}

function CollectOrderPage() {
  const { token } = useParams()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { openLoginModal } = useAuthModal()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checks, setChecks] = useState({
    item_collected: false,
    item_inspected: false,
    item_matches_listing: false,
  })

  const returnPath = `${location.pathname}${location.search}${location.hash}`

  const loadPreview = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    const { data, error: previewError } = await fetchCollectionQrPreview(token)

    if (previewError) {
      setError(getCollectionQrErrorMessage(previewError))
      setPreview(null)
      setLoading(false)
      return
    }

    setPreview(data)
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (authLoading) return undefined

    loadPreview()

    return undefined
  }, [authLoading, loadPreview, user?.id])

  async function handleConfirm() {
    if (!token || submitting) return

    setSubmitting(true)
    setError('')

    const { data: confirmedOrder, error: confirmError } = await confirmCollectionByQr(
      token,
      buildCollectionConfirmationChecks({
        itemCollected: checks.item_collected,
        itemInspected: checks.item_inspected,
        itemMatchesListing: checks.item_matches_listing,
      }),
    )

    setSubmitting(false)

    if (confirmError) {
      setError(getCollectionQrErrorMessage(confirmError))
      return
    }

    setPreview((current) => ({
      ...current,
      status: 'already_collected',
      order_id: confirmedOrder?.id ?? current?.order_id,
      collected_at: confirmedOrder?.collected_at ?? current?.collected_at,
      payout_release_at: confirmedOrder?.payout_release_at ?? current?.payout_release_at,
    }))
    setSuccess(true)
  }

  if (loading || authLoading) {
    return (
      <section className="page-stub collect-order-page">
        <LoadingState>Loading handover confirmation…</LoadingState>
      </section>
    )
  }

  if (error && !preview) {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">Handover confirmation</h1>
        <ErrorState>{error}</ErrorState>
      </section>
    )
  }

  if (success || preview?.status === 'already_collected') {
    const sellerDelivery = isSellerDeliveryPreview(preview)

    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">
          {sellerDelivery ? 'Handover confirmed' : 'Collection confirmed'}
        </h1>
        <div className="collect-order-page__card">
          <p className="collect-order-page__success">
            {sellerDelivery
              ? 'Handover confirmed. Your 24-hour Buyer Protection window has started.'
              : 'Collection confirmed. Your 24-hour Buyer Protection window has started.'}
          </p>
          {preview?.listing_title ? (
            <p className="collect-order-page__lead">{preview.listing_title}</p>
          ) : null}
          {preview?.payout_release_at ? (
            <p className="collect-order-page__lead">
              Buyer Protection window ends {formatOrderTimestamp(preview.payout_release_at)}.
            </p>
          ) : null}
          <div className="collect-order-page__actions">
            {preview?.order_id ? (
              <Link to={`/orders/${preview.order_id}`} className="collect-order-page__link-button">
                View order
              </Link>
            ) : null}
            <Link to="/hub" className="collect-order-page__link-button">
              Back to Hub
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const sellerDelivery = isSellerDeliveryPreview(preview)
  const handoverNoun = sellerDelivery ? 'handover' : 'collection'
  const handoverVerb = sellerDelivery ? 'received' : 'collected'

  if (preview?.status === 'invalid') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">Handover confirmation</h1>
        <EmptyState compact>This {handoverNoun} code is not valid.</EmptyState>
      </section>
    )
  }

  if (preview?.status === 'expired') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">{handoverNoun} code expired</h1>
        <EmptyState compact>
          This {handoverNoun} code has expired. Ask the seller to generate a new one.
        </EmptyState>
      </section>
    )
  }

  if (preview?.status === 'unavailable') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">{handoverNoun} unavailable</h1>
        <EmptyState compact>
          This order is not ready for {handoverNoun} confirmation right now.
        </EmptyState>
      </section>
    )
  }

  if (preview?.status === 'login_required') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">Sign in to confirm {handoverNoun}</h1>
        <p className="collect-order-page__lead">
          {preview.listing_title
            ? `Sign in as the buyer for ${preview.listing_title} to confirm ${handoverNoun}.`
            : `Sign in as the buyer for this order to confirm ${handoverNoun}.`}
        </p>
        <div className="collect-order-page__actions">
          <button
            type="button"
            className="collect-order-page__button"
            onClick={() => openLoginModal({ redirectTo: returnPath })}
          >
            Sign in
          </button>
          <Link to={`/login?redirect=${encodeURIComponent(returnPath)}`} className="collect-order-page__link-button">
            Go to login page
          </Link>
        </div>
      </section>
    )
  }

  if (preview?.status === 'wrong_user') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">Handover confirmation</h1>
        <EmptyState compact>
          Only the buyer for this order can confirm {handoverNoun}.
        </EmptyState>
        <div className="collect-order-page__actions">
          <Link to="/hub" className="collect-order-page__link-button">
            Back to Hub
          </Link>
        </div>
      </section>
    )
  }

  if (preview?.status !== 'ready') {
    return (
      <section className="page-stub collect-order-page">
        <h1 className="collect-order-page__title">Handover confirmation</h1>
        <EmptyState compact>This {handoverNoun} code cannot be used.</EmptyState>
      </section>
    )
  }

  const sellerLabel =
    preview.seller_username
      ? `@${preview.seller_username}`
      : preview.seller_display_name || 'Seller'

  const allChecksComplete =
    checks.item_collected && checks.item_inspected && checks.item_matches_listing

  return (
    <section className="page-stub collect-order-page">
      <h1 className="collect-order-page__title">
        {sellerDelivery ? 'Confirm handover' : 'Confirm collection'}
      </h1>
      <p className="collect-order-page__lead">
        {sellerDelivery
          ? `Review your order details and confirm you have received the item from ${sellerLabel}. Inspect the equipment before confirming.`
          : `Review your order details and confirm you have collected the item from ${sellerLabel}.`}
      </p>

      <div className="collect-order-page__card">
        <dl className="collect-order-page__summary">
          <div className="collect-order-page__summary-row">
            <dt>Listing</dt>
            <dd>{preview.listing_title}</dd>
          </div>
          <div className="collect-order-page__summary-row">
            <dt>Seller</dt>
            <dd>{sellerLabel}</dd>
          </div>
        </dl>

        <PaymentCheckoutSummary
          payment={{
            amount_pence: preview.item_price_pence,
            buyer_protection_fee_pence: preview.buyer_protection_fee_pence,
            buyer_total_pence: preview.buyer_total_pence,
          }}
          compact
        />

        <div className="collect-order-page__checks">
          <label className="collect-order-page__check">
            <input
              type="checkbox"
              checked={checks.item_collected}
              disabled={submitting}
              onChange={(event) =>
                setChecks((current) => ({ ...current, item_collected: event.target.checked }))
              }
            />
            <span>I have {handoverVerb} the item</span>
          </label>
          <label className="collect-order-page__check">
            <input
              type="checkbox"
              checked={checks.item_inspected}
              disabled={submitting}
              onChange={(event) =>
                setChecks((current) => ({ ...current, item_inspected: event.target.checked }))
              }
            />
            <span>I have inspected the item</span>
          </label>
          <label className="collect-order-page__check">
            <input
              type="checkbox"
              checked={checks.item_matches_listing}
              disabled={submitting}
              onChange={(event) =>
                setChecks((current) => ({
                  ...current,
                  item_matches_listing: event.target.checked,
                }))
              }
            />
            <span>The item appears to match the listing</span>
          </label>
        </div>

        <button
          type="button"
          className="collect-order-page__button"
          disabled={!allChecksComplete || submitting}
          onClick={handleConfirm}
        >
          {submitting ? 'Confirming…' : sellerDelivery ? 'Confirm handover' : 'Confirm collection'}
        </button>

        {error ? (
          <p className="collect-order-page__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default CollectOrderPage
