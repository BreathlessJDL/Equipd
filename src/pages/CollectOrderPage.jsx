import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PaymentCheckoutSummary from '../components/PaymentCheckoutSummary'
import { CircleCheckIcon } from '../components/icons/NavIcons'
import '../components/icons/NavIcons.css'
import { ShieldCheckIcon } from '../components/icons/NotificationIcons'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  buildCollectionConfirmationChecks,
  COLLECTION_REJECTION_REASON_OPTIONS,
  COLLECTION_REJECTION_REASONS,
  confirmCollectionByQr,
  fetchCollectionQrPreview,
  getCollectionQrErrorMessage,
  rejectCollectionByQr,
} from '../lib/collectionQr'
import { fetchOrderById } from '../lib/orders'
import { getListingPrimaryImageUrl } from '../lib/listingImages'
import {
  uploadSupportEvidenceFile,
  validateIssueEvidenceFile,
} from '../lib/orderEvidence'
import EvidenceFilePicker from '../components/EvidenceFilePicker'
import './CollectOrderPage.css'
import '../components/PageStub.css'

function isSellerDeliveryPreview(preview) {
  return preview?.order_type === 'seller_delivery'
}

function formatProtectionEndDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

function formatProtectionEndTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(new Date(value))
}

function CollectOrderSummaryCard({ preview, orderDetails }) {
  const sellerLabel = preview?.seller_username
    ? `@${preview.seller_username}`
    : preview?.seller_display_name || 'Seller'

  const listingTitle = preview?.listing_title || orderDetails?.listing?.title
  const thumbnailUrl =
    getListingPrimaryImageUrl(orderDetails?.listing) ||
    orderDetails?.listing?.primary_image_url ||
    null

  const showPricing =
    preview?.item_price_pence != null ||
    preview?.buyer_total_pence != null ||
    orderDetails?.payment

  return (
    <article className="collect-order-page__summary-card">
      <div className="collect-order-page__summary-top">
        <div className="collect-order-page__thumb-wrap">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="collect-order-page__thumb"
            />
          ) : (
            <div className="collect-order-page__thumb collect-order-page__thumb--empty" aria-hidden="true" />
          )}
        </div>
        <div className="collect-order-page__summary-meta">
          {listingTitle ? (
            <h2 className="collect-order-page__listing-title">{listingTitle}</h2>
          ) : null}
          <p className="collect-order-page__seller">
            <span className="collect-order-page__seller-label">Seller</span>
            <span className="collect-order-page__seller-value">{sellerLabel}</span>
          </p>
        </div>
      </div>

      {showPricing ? (
        <PaymentCheckoutSummary
          payment={{
            amount_pence: preview?.item_price_pence ?? orderDetails?.item_price_pence,
            buyer_protection_fee_pence:
              preview?.buyer_protection_fee_pence ?? orderDetails?.buyer_protection_fee_pence,
            buyer_total_pence: preview?.buyer_total_pence ?? orderDetails?.buyer_total_pence,
          }}
          order={orderDetails}
          compact
          showNote={false}
          className="collect-order-page__pricing"
          offerAmountLabel="Agreed price"
          totalLabel="Total paid"
        />
      ) : null}
    </article>
  )
}

function CollectOrderChecklist({ checks, setChecks, handoverVerb, submitting }) {
  const items = [
    {
      key: 'item_collected',
      label: `I have ${handoverVerb} the item`,
    },
    {
      key: 'item_inspected',
      label: 'I have inspected the item',
    },
    {
      key: 'item_matches_listing',
      label: 'The item matches the listing',
    },
  ]

  return (
    <section className="collect-order-page__checklist" aria-labelledby="collect-order-checklist-title">
      <h2 id="collect-order-checklist-title" className="collect-order-page__checklist-title">
        Before you confirm
      </h2>
      <ul className="collect-order-page__checklist-items">
        {items.map((item) => (
          <li key={item.key}>
            <label className="collect-order-page__check">
              <input
                type="checkbox"
                className="collect-order-page__check-input"
                checked={checks[item.key]}
                disabled={submitting}
                onChange={(event) =>
                  setChecks((current) => ({
                    ...current,
                    [item.key]: event.target.checked,
                  }))
                }
              />
              <span className="collect-order-page__check-box" aria-hidden="true" />
              <span className="collect-order-page__check-label">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CollectOrderRejectedView({ preview, orderDetails }) {
  return (
    <section className="page-stub collect-order-page collect-order-page--rejected">
      <header className="collect-order-page__success-hero">
        <h1 className="collect-order-page__success-title">Item rejected at collection</h1>
        <p className="collect-order-page__success-lead">
          Collection was not confirmed. Equipd support is reviewing your case and seller payout
          remains on hold.
        </p>
      </header>

      <CollectOrderSummaryCard preview={preview} orderDetails={orderDetails} />

      <div className="collect-order-page__actions collect-order-page__actions--success">
        {preview?.order_id ? (
          <Link
            to={`/orders/${preview.order_id}`}
            className="collect-order-page__button collect-order-page__button--primary"
          >
            View order
          </Link>
        ) : null}
        <Link
          to="/hub"
          className="collect-order-page__button collect-order-page__button--secondary"
        >
          Back to Hub
        </Link>
      </div>
    </section>
  )
}

function CollectOrderRejectForm({
  rejectReason,
  setRejectReason,
  rejectDescription,
  setRejectDescription,
  rejectFiles,
  setRejectFiles,
  submitting,
  error,
  onSubmit,
}) {
  return (
    <section className="collect-order-page__reject" aria-labelledby="collect-order-reject-title">
      <h2 id="collect-order-reject-title" className="collect-order-page__reject-title">
        Reject item at collection
      </h2>
      <p className="collect-order-page__reject-lead">
        If the item is not acceptable, reject it here instead of confirming collection. Seller
        payout stays blocked and Equipd support will review your case.
      </p>

      <form className="collect-order-page__reject-form" onSubmit={onSubmit}>
        <div className="collect-order-page__reject-field">
          <label className="collect-order-page__reject-label" htmlFor="collect-reject-reason">
            Reason
          </label>
          <select
            id="collect-reject-reason"
            className="collect-order-page__reject-input"
            value={rejectReason}
            disabled={submitting}
            onChange={(event) => setRejectReason(event.target.value)}
          >
            {COLLECTION_REJECTION_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="collect-order-page__reject-field">
          <label className="collect-order-page__reject-label" htmlFor="collect-reject-description">
            What is wrong with the item?
          </label>
          <textarea
            id="collect-reject-description"
            className="collect-order-page__reject-textarea"
            rows={4}
            required
            disabled={submitting}
            value={rejectDescription}
            onChange={(event) => setRejectDescription(event.target.value)}
            placeholder="Describe the issue you found when inspecting the item."
          />
        </div>

        <EvidenceFilePicker
          inputId="collect-reject-evidence"
          files={rejectFiles}
          onChange={setRejectFiles}
          disabled={submitting}
          label="Photos or files (optional)"
          hint="Upload photos if they help explain the issue."
        />

        {error ? (
          <p className="collect-order-page__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="collect-order-page__button collect-order-page__button--danger"
          disabled={submitting || !rejectDescription.trim()}
        >
          {submitting ? 'Submitting rejection…' : 'Reject item'}
        </button>
      </form>
    </section>
  )
}

function CollectOrderSuccessView({ preview, orderDetails, sellerDelivery }) {
  const title = sellerDelivery ? 'Handover confirmed' : 'Collection confirmed'
  const confirmationLead = sellerDelivery
    ? 'Your handover has been successfully confirmed.'
    : 'Your collection has been successfully confirmed.'

  return (
    <section className="page-stub collect-order-page collect-order-page--success">
      <header className="collect-order-page__success-hero">
        <div className="collect-order-page__success-icon" aria-hidden="true">
          <CircleCheckIcon />
        </div>
        <h1 className="collect-order-page__success-title">{title}</h1>
        <p className="collect-order-page__success-lead">{confirmationLead}</p>
        <p className="collect-order-page__success-sublead">
          Your 24-hour Buyer Protection period is now active.
        </p>
      </header>

      <CollectOrderSummaryCard preview={preview} orderDetails={orderDetails} />

      {preview?.payout_release_at ? (
        <div className="collect-order-page__protection-panel">
          <div className="collect-order-page__protection-icon" aria-hidden="true">
            <ShieldCheckIcon />
          </div>
          <div className="collect-order-page__protection-copy">
            <p className="collect-order-page__protection-title">Buyer Protection active</p>
            <p className="collect-order-page__protection-label">Ends</p>
            <p className="collect-order-page__protection-date">
              {formatProtectionEndDate(preview.payout_release_at)}
            </p>
            <p className="collect-order-page__protection-time">
              {formatProtectionEndTime(preview.payout_release_at)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="collect-order-page__actions collect-order-page__actions--success">
        {preview?.order_id ? (
          <Link
            to={`/orders/${preview.order_id}`}
            className="collect-order-page__button collect-order-page__button--primary"
          >
            View order
          </Link>
        ) : null}
        <Link
          to="/hub"
          className="collect-order-page__button collect-order-page__button--secondary"
        >
          Back to Hub
        </Link>
      </div>
    </section>
  )
}

function CollectOrderPage() {
  usePageTitle('Collect Order')
  const { token } = useParams()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { openLoginModal } = useAuthModal()
  const [preview, setPreview] = useState(null)
  const [orderDetails, setOrderDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState(COLLECTION_REJECTION_REASONS.ITEM_NOT_AS_DESCRIBED)
  const [rejectDescription, setRejectDescription] = useState('')
  const [rejectFiles, setRejectFiles] = useState([])
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [rejectError, setRejectError] = useState('')
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
      setOrderDetails(null)
      setLoading(false)
      return
    }

    setPreview(data)

    if (data?.order_id) {
      const { data: order } = await fetchOrderById(data.order_id)
      setOrderDetails(order ?? null)
    } else {
      setOrderDetails(null)
    }

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

  async function handleReject(event) {
    event.preventDefault()
    if (!token || rejectSubmitting || !preview?.order_id) return

    setRejectSubmitting(true)
    setRejectError('')

    try {
      const requestId = crypto.randomUUID()
      const evidencePaths = []

      for (const file of rejectFiles) {
        const validationError = validateIssueEvidenceFile(file)
        if (validationError) {
          throw new Error(validationError)
        }

        const { path, error: uploadError } = await uploadSupportEvidenceFile(
          preview.order_id,
          requestId,
          file,
        )

        if (uploadError) {
          throw uploadError
        }

        evidencePaths.push(path)
      }

      const { error: rejectRpcError } = await rejectCollectionByQr({
        token,
        reason: rejectReason,
        description: rejectDescription,
        evidencePaths,
        requestId,
      })

      if (rejectRpcError) {
        throw rejectRpcError
      }

      setRejected(true)
    } catch (rejectFailure) {
      setRejectError(getCollectionQrErrorMessage(rejectFailure))
    } finally {
      setRejectSubmitting(false)
    }
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

  if (rejected) {
    return <CollectOrderRejectedView preview={preview} orderDetails={orderDetails} />
  }

  if (success || preview?.status === 'already_collected') {
    return (
      <CollectOrderSuccessView
        preview={preview}
        orderDetails={orderDetails}
        sellerDelivery={isSellerDeliveryPreview(preview)}
      />
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
            className="collect-order-page__button collect-order-page__button--primary"
            onClick={() => openLoginModal({ redirectTo: returnPath })}
          >
            Sign in
          </button>
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
          <Link to="/hub" className="collect-order-page__button collect-order-page__button--secondary">
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
      <header className="collect-order-page__header">
        <h1 className="collect-order-page__title">
          {sellerDelivery ? 'Handover confirmation' : 'Collection confirmation'}
        </h1>
        <p className="collect-order-page__lead">
          {sellerDelivery
            ? `Confirm you've received and inspected your item from ${sellerLabel} before completing the handover.`
            : "Confirm you've collected and inspected your item before completing the handover."}
        </p>
      </header>

      <CollectOrderSummaryCard preview={preview} orderDetails={orderDetails} />

      <CollectOrderChecklist
        checks={checks}
        setChecks={setChecks}
        handoverVerb={handoverVerb}
        submitting={submitting}
      />

      <div className="collect-order-page__confirm-wrap">
        <button
          type="button"
          className="collect-order-page__button collect-order-page__button--primary collect-order-page__button--confirm"
          disabled={!allChecksComplete || submitting || rejectSubmitting}
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

      {!sellerDelivery ? (
        <div className="collect-order-page__reject-toggle-wrap">
          {!showRejectForm ? (
            <button
              type="button"
              className="collect-order-page__button collect-order-page__button--secondary"
              disabled={submitting || rejectSubmitting}
              onClick={() => setShowRejectForm(true)}
            >
              Item not accepted
            </button>
          ) : (
            <CollectOrderRejectForm
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              rejectDescription={rejectDescription}
              setRejectDescription={setRejectDescription}
              rejectFiles={rejectFiles}
              setRejectFiles={setRejectFiles}
              submitting={rejectSubmitting}
              error={rejectError}
              onSubmit={handleReject}
            />
          )}
        </div>
      ) : null}
    </section>
  )
}

export default CollectOrderPage
