import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BuyerOrderConfirmation from '../components/BuyerOrderConfirmation'
import CollectionQrPanel from '../components/CollectionQrPanel'
import CollectionBuyerHandoverPanel from '../components/orders/CollectionBuyerHandoverPanel'
import DevHandoverConfirmPanel, {
  canShowDevHandoverConfirm,
} from '../components/DevHandoverConfirmPanel'
import DevEndBuyerProtectionPanel, {
  canShowDevEndBuyerProtection,
} from '../components/DevEndBuyerProtectionPanel'
import CourierDeliveryConfirmation from '../components/CourierDeliveryConfirmation'
import CourierEvidenceForm from '../components/CourierEvidenceForm'
import CourierEvidenceSummary from '../components/CourierEvidenceSummary'
import { OrderReviewSection } from '../components/Reviews'
import OrderCaseUpdatesHistory from '../components/OrderCaseUpdatesHistory'
import OrderSupportRequest from '../components/OrderSupportRequest'
import OrderDisputeSection from '../components/OrderDisputeSection'
import OrderFulfilmentDetailsCard from '../components/orders/OrderFulfilmentDetailsCard'
import OrderTimeline from '../components/OrderTimeline'
import { TransactionCancelButton } from '../components/TransactionCancel'
import { EnvelopeIcon, EyeIcon } from '../components/icons/NavIcons'
import { HubItemStatusBadge } from '../components/hub/HubItemRow'
import { ErrorState, LoadingState } from '../components/ui/UiState'
import '../components/hub/HubItemRow.css'
import '../components/OrderDetail.css'
import '../components/PageStub.css'
import { useAuth } from '../hooks/useAuth'
import { useIsAdmin } from '../hooks/useIsAdmin'
import {
  formatPricePence,
} from '../lib/listings'
import {
  canSellerCancelAcceptedOffer,
  formatOfferStatus,
  isOfferCancelled,
} from '../lib/offers'
import { buildOrderTimeline } from '../lib/orderTimeline'
import { formatPaymentStatus, isPaymentComplete } from '../lib/payments'
import {
  canBuyerConfirmCourierDelivery,
  canBuyerConfirmOrder,
  canShowBuyerHandoverAction,
  canShowHandoverQr,
  canSellerSubmitCourierEvidence,
  canShowCourierEvidenceSummary,
  fetchOrderById,
  formatOrderFulfilmentStatus,
  formatOrderReference,
  formatOrderTimestamp,
  formatPayoutStatus,
  getOrderDeliveryMethodDescription,
  getOrderDeliveryMethodLabel,
  getOrderErrorMessage,
  getOrderFulfilmentDisplayStatus,
  getOrderPayoutDisplayStatus,
  getOrderViewerRole,
  getSellerPayoutProcessingMessage,
  isOrderCompleted,
  isSellerAwaitingPayout,
  ORDER_TYPES,
  isOrderParticipant,
} from '../lib/orders'
import { formatBuyerProtectionStatus, fetchDisputesForOrder, isBuyerProtectionWindowActive, isOrderDisputed } from '../lib/orderDisputes'
import { usePageTitle } from '../hooks/usePageTitle'
import { canShowOrderFulfilmentDetails } from '../lib/orderDeliveryDetails'
import {
  canRaiseSupportRequest,
  fetchSupportRequestsForOrder,
  getActiveSupportRequest,
  getSupportRequestErrorMessage,
} from '../lib/supportRequests'
import { fetchOrderCaseUpdates, hasVisibleCaseUpdates } from '../lib/caseUpdates'
import {
  fetchReviewsForOrder,
  getReviewErrorMessage,
  isOrderReviewable,
} from '../lib/reviews'
import { getStatusBadgeFromOrderLifecycleStage } from '../lib/orderLifecycleStatus'
import { fetchPublicProfile, getProfileDisplayName } from '../lib/profiles'

function formatOrderNumber(orderId) {
  return formatOrderReference(orderId)
}

function OrderDetailInfoRow({ label, children }) {
  if (!children && children !== 0) return null

  return (
    <div className="order-detail__info-row">
      <dt className="order-detail__info-label">{label}</dt>
      <dd className="order-detail__info-value">{children}</dd>
    </div>
  )
}

function OrderDetailOverviewFact({ label, children, highlight = false }) {
  if (!children && children !== 0) return null

  return (
    <div
      className={`order-detail__overview-fact${
        highlight ? ' order-detail__overview-fact--highlight' : ''
      }`}
    >
      <dt className="order-detail__overview-fact-label">{label}</dt>
      <dd className="order-detail__overview-fact-value">{children}</dd>
    </div>
  )
}

function OrderReferenceRow({ orderReference }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderReference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — reference remains visible to copy manually.
    }
  }

  return (
    <div className="order-detail__reference-row">
      <div className="order-detail__reference">
        <span className="order-detail__reference-label">Order reference</span>
        <span className="order-detail__reference-value">#{orderReference}</span>
      </div>
      <button
        type="button"
        className="order-detail__reference-copy"
        onClick={handleCopy}
        aria-label={copied ? 'Order reference copied' : 'Copy order reference'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function OrderParticipantProfileLink({ label, userId, profile }) {
  if (!userId) return null

  const username = profile?.username?.trim()
  const linkLabel = username ? `@${username}` : getProfileDisplayName(profile)

  return (
    <p className="order-detail__overview-meta">
      {label}:{' '}
      <Link to={`/shop/${userId}`} className="order-detail__participant-link">
        {linkLabel}
      </Link>
    </p>
  )
}

function OrderDetailCompactSupport() {
  return (
    <div className="order-detail__compact-support">
      <h2 className="order-detail__card-title">Support</h2>
      <p className="order-detail__compact-support-lead" role="status">
        Buyer Protection has ended for this order.
      </p>
      <p className="order-detail__compact-support-text">
        Need help? Contact Equipd Support and quote your Order Reference.
      </p>
      <Link to="/support" className="order-detail__compact-support-btn">
        Contact Support
      </Link>
    </div>
  )
}

function OrderDetailPage() {
  usePageTitle('Order Details')
  const { orderId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const [order, setOrder] = useState(null)
  const [supportRequests, setSupportRequests] = useState([])
  const [disputes, setDisputes] = useState([])
  const [caseUpdates, setCaseUpdates] = useState([])
  const [reviews, setReviews] = useState([])
  const [buyerProfile, setBuyerProfile] = useState(null)
  const [sellerProfile, setSellerProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [supportError, setSupportError] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const hasLoadedRef = useRef(false)
  const handledPaymentSuccessRef = useRef(false)
  const paymentSuccessPollRef = useRef(null)
  const [checkoutSuccessNotice, setCheckoutSuccessNotice] = useState(false)

  const loadOrder = useCallback(async ({ refresh = false } = {}) => {
    if (!orderId) return

    if (refresh && hasLoadedRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    setSupportError('')
    setReviewsError('')

    const [
      { data, error: fetchError },
      supportRequestsResult,
      disputesResult,
      caseUpdatesResult,
      reviewsResult,
    ] = await Promise.all([
      fetchOrderById(orderId),
      fetchSupportRequestsForOrder(orderId),
      fetchDisputesForOrder(orderId),
      fetchOrderCaseUpdates(orderId),
      fetchReviewsForOrder(orderId),
    ])

    if (fetchError) {
      setError(getOrderErrorMessage(fetchError))
      setOrder(null)
      setSupportRequests([])
      setDisputes([])
      setCaseUpdates([])
      setReviews([])
      setBuyerProfile(null)
      setSellerProfile(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const isParticipant = Boolean(data && isOrderParticipant(data, user?.id))

    if (!data || (!isParticipant && !isAdmin)) {
      setError('You do not have access to this order.')
      setOrder(null)
      setSupportRequests([])
      setDisputes([])
      setCaseUpdates([])
      setReviews([])
      setBuyerProfile(null)
      setSellerProfile(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const [buyerProfileResult, sellerProfileResult] = await Promise.all([
      data.buyer_id ? fetchPublicProfile(data.buyer_id) : Promise.resolve({ data: null }),
      data.seller_id ? fetchPublicProfile(data.seller_id) : Promise.resolve({ data: null }),
    ])

    setOrder(data)
    setBuyerProfile(buyerProfileResult.data ?? null)
    setSellerProfile(sellerProfileResult.data ?? null)
    setSupportRequests(supportRequestsResult.error ? [] : (supportRequestsResult.data ?? []))
    setDisputes(disputesResult.error ? [] : (disputesResult.data ?? []))
    setCaseUpdates(caseUpdatesResult.error ? [] : (caseUpdatesResult.data ?? []))
    setReviews(reviewsResult.error ? [] : (reviewsResult.data ?? []))

    if (supportRequestsResult.error && isParticipant) {
      setSupportError(getSupportRequestErrorMessage(supportRequestsResult.error))
    } else if (supportRequestsResult.error && isAdmin) {
      setSupportError(getSupportRequestErrorMessage(supportRequestsResult.error))
    }

    if (reviewsResult.error) {
      setReviewsError(getReviewErrorMessage(reviewsResult.error))
    }

    hasLoadedRef.current = true
    setLoading(false)
    setRefreshing(false)
  }, [isAdmin, orderId, user?.id])

  const refreshSupportRequests = useCallback(async () => {
    if (!orderId) return

    const { data, error: fetchError } = await fetchSupportRequestsForOrder(orderId)

    if (!fetchError) {
      setSupportRequests(data ?? [])
    }
  }, [orderId])

  const refreshCaseUpdates = useCallback(async () => {
    if (!orderId) return

    const { data, error: fetchError } = await fetchOrderCaseUpdates(orderId)

    if (!fetchError) {
      setCaseUpdates(data ?? [])
    }
  }, [orderId])

  const refreshReviews = useCallback(async () => {
    if (!orderId) return

    const { data, error: fetchError } = await fetchReviewsForOrder(orderId)

    if (!fetchError) {
      setReviews(data ?? [])
    }
  }, [orderId])

  useEffect(() => {
    if (!user?.id || adminLoading) return undefined

    let active = true

    async function load() {
      await loadOrder()
      if (!active) return
    }

    load()

    return () => {
      active = false
    }
  }, [adminLoading, loadOrder, user?.id])

  useEffect(() => {
    if (searchParams.get('payment') !== 'success' || handledPaymentSuccessRef.current) {
      return undefined
    }

    handledPaymentSuccessRef.current = true
    setCheckoutSuccessNotice(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    nextParams.delete('session_id')
    setSearchParams(nextParams, { replace: true })

    if (isPaymentComplete(order?.payment)) {
      return undefined
    }

    const pollDelaysMs = [2000, 5000, 10000]

    function pollAfterPayment(attempt = 0) {
      loadOrder({ refresh: true })

      if (attempt >= pollDelaysMs.length - 1) {
        paymentSuccessPollRef.current = null
        return
      }

      paymentSuccessPollRef.current = window.setTimeout(() => {
        pollAfterPayment(attempt + 1)
      }, pollDelaysMs[attempt + 1] - pollDelaysMs[attempt])
    }

    paymentSuccessPollRef.current = window.setTimeout(() => {
      pollAfterPayment(0)
    }, pollDelaysMs[0])

    return () => {
      if (paymentSuccessPollRef.current) {
        window.clearTimeout(paymentSuccessPollRef.current)
      }
    }
  }, [loadOrder, order?.payment, searchParams, setSearchParams])

  const participantRole = order ? getOrderViewerRole(order, user?.id) : null
  const viewerRole = participantRole ?? (isAdmin ? 'admin' : null)

  const timeline = useMemo(() => {
    if (!order) return null

    return buildOrderTimeline({
      order,
      payment: order.payment,
      offer: order.offer,
      supportRequests,
      disputes,
      caseUpdates,
      viewerRole,
      userId: user?.id,
    })
  }, [caseUpdates, disputes, order, supportRequests, user?.id, viewerRole])

  if (loading || adminLoading) {
    return (
      <section className="page-stub">
        <LoadingState>Loading order…</LoadingState>
      </section>
    )
  }

  if (error || !order) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Order unavailable</h2>
        <ErrorState>{error || 'This order could not be found.'}</ErrorState>
        <p className="page-stub__lead">
          <Link to="/hub">Back to Hub</Link>
          {isAdmin ? (
            <>
              {' · '}
              <Link to="/admin/orders">Admin orders</Link>
            </>
          ) : null}
        </p>
      </section>
    )
  }

  const isAdminViewer = viewerRole === 'admin'
  const listing = order.listing
  const payment = order.payment
  const offer = order.offer
  const listingUrl = listing?.slug ? `/listings/${listing.slug}` : null
  const conversationUrl = offer?.conversation_id ? `/messages/${offer.conversation_id}` : null
  const statusBadge = getStatusBadgeFromOrderLifecycleStage(timeline?.currentStage, {
    viewerRole,
  })
  const deliveryMethodLabel = getOrderDeliveryMethodLabel(order)
  const deliveryMethodDescription = getOrderDeliveryMethodDescription(order)
  const orderReference = formatOrderNumber(order.id)
  const categoryName = listing?.category?.name
  const totalPrice = formatPricePence(
    order.buyer_total_pence ?? payment?.buyer_total_pence ?? order.amount_pence,
  )
  const buyerProtectionStatus = formatBuyerProtectionStatus(order, payment)
  const showBuyerConfirm =
    !isAdminViewer && viewerRole === 'buyer' && canBuyerConfirmOrder(order, payment)
  const showHandoverQr =
    !isAdminViewer && viewerRole === 'seller' && canShowHandoverQr(order, payment)
  const showBuyerHandoverAction =
    !isAdminViewer && viewerRole === 'buyer' && canShowBuyerHandoverAction(order, payment)
  const showDevHandoverConfirm = canShowDevHandoverConfirm({
    order,
    payment,
    user,
    isAdmin,
    viewerRole,
  })
  const showDevEndBuyerProtection = canShowDevEndBuyerProtection({
    order,
    user,
    isAdmin,
    viewerRole,
  })
  const isSellerDeliveryOrder = order?.order_type === ORDER_TYPES.SELLER_DELIVERY
  const showCourierEvidenceForm =
    !isAdminViewer && viewerRole === 'seller' && canSellerSubmitCourierEvidence(order, payment)
  const showCourierEvidenceSummary =
    !isAdminViewer &&
    canShowCourierEvidenceSummary(order) &&
    !canBuyerConfirmCourierDelivery(order, payment)
  const showCourierDeliveryConfirm =
    !isAdminViewer && viewerRole === 'buyer' && canBuyerConfirmCourierDelivery(order, payment)
  const isCancelled =
    isOfferCancelled(offer) || order.fulfilment_status === 'cancelled'
  const showSellerCancel =
    !isAdminViewer &&
    viewerRole === 'seller' &&
    canSellerCancelAcceptedOffer({
      status: offer?.status,
      payment,
      order,
    })
  const showSupportSection =
    !isCancelled &&
    !isAdminViewer &&
    (canRaiseSupportRequest(order, payment) || supportRequests.length > 0)
  const showReviewSection = isOrderReviewable(order)
  const buyerProtectionActive = isBuyerProtectionWindowActive(order)
  const buyerProtectionEnded =
    isPaymentComplete(payment) &&
    !buyerProtectionActive &&
    (order.protection_status === 'released' ||
      order.payout_released_at ||
      isOrderCompleted(order))
  const activeSupportRequest = getActiveSupportRequest(supportRequests)
  const showDisputeSection =
    !isCancelled &&
    isPaymentComplete(payment) &&
    (isOrderDisputed(order) ||
      (viewerRole === 'buyer' && buyerProtectionActive) ||
      (isAdmin && Boolean(activeSupportRequest)))
  const showCompactSupport =
    !isCancelled && !isAdminViewer && buyerProtectionEnded && !isOrderDisputed(order)
  const showFulfilmentDetailsCard =
    Boolean(order?.id)
    && (viewerRole === 'buyer' || viewerRole === 'seller' || viewerRole === 'admin')
    && canShowOrderFulfilmentDetails({ order, payment, viewerRole })
  const showOrderSupportRequest =
    !isCancelled &&
    !isAdminViewer &&
    !showCompactSupport &&
    !buyerProtectionActive &&
    showSupportSection

  const showSellerPayoutNotice =
    (viewerRole === 'seller' || viewerRole === 'admin') && isSellerAwaitingPayout(order)
  const sellerPayoutNotice = showSellerPayoutNotice
    ? getSellerPayoutProcessingMessage(order)
    : null

  const hasNextSteps =
    showSellerCancel ||
    showCourierDeliveryConfirm ||
    showCourierEvidenceForm ||
    showCourierEvidenceSummary ||
    showBuyerHandoverAction ||
    showHandoverQr ||
    showDevHandoverConfirm ||
    showDevEndBuyerProtection ||
    showBuyerConfirm

  const showSupportFooter =
    showDisputeSection ||
    showOrderSupportRequest ||
    showCompactSupport ||
    hasVisibleCaseUpdates(caseUpdates) ||
    (isAdminViewer && supportError)

  const showCaseUpdatesHistory = hasVisibleCaseUpdates(caseUpdates)

  const roleLabel = isAdminViewer
    ? 'Admin view'
    : viewerRole === 'buyer'
      ? 'You are the buyer'
      : 'You are the seller'

  return (
    <article className="order-detail">
      <header className="order-detail__header">
        <p className="order-detail__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>

        {checkoutSuccessNotice && isPaymentComplete(payment) ? (
          <p className="order-detail__banner order-detail__banner--success" role="status">
            Payment received. Your order is confirmed — follow the next steps below to complete
            {isSellerDeliveryOrder ? ' delivery' : order?.order_type === ORDER_TYPES.BUYER_COURIER ? ' fulfilment' : ' collection'}.
          </p>
        ) : null}

        {checkoutSuccessNotice && !isPaymentComplete(payment) ? (
          <p className="order-detail__banner order-detail__banner--notice" role="status">
            Payment received. Confirming your order with Stripe…
          </p>
        ) : null}

        {sellerPayoutNotice ? (
          <p className="order-detail__banner order-detail__banner--notice" role="status">
            {sellerPayoutNotice}
          </p>
        ) : null}

        {isCancelled ? (
          <p
            className="order-detail__banner order-detail__banner--cancelled"
            role="status"
          >
            This transaction was cancelled before payment completed.
          </p>
        ) : null}

        {refreshing ? (
          <p className="order-detail__refreshing" role="status">
            Updating order…
          </p>
        ) : null}

        {isAdminViewer ? (
          <p className="order-detail__banner order-detail__banner--notice" role="status">
            Admin view only. Manage support requests from{' '}
            <Link to="/admin/support">Admin support</Link>.
          </p>
        ) : null}
      </header>

      <div className="order-detail__stack">
        <section className="order-detail__overview" aria-label="Order overview">
          <div className="order-detail__overview-main">
            {listing?.primary_image_url ? (
              <div className="order-detail__overview-media">
                {listingUrl ? (
                  <Link to={listingUrl} className="order-detail__image-link">
                    <img
                      src={listing.primary_image_url}
                      alt=""
                      className="order-detail__image"
                    />
                  </Link>
                ) : (
                  <img
                    src={listing.primary_image_url}
                    alt=""
                    className="order-detail__image"
                  />
                )}
              </div>
            ) : (
              <div
                className="order-detail__image order-detail__image--empty order-detail__overview-media"
                aria-hidden="true"
              />
            )}

            <div className="order-detail__overview-head">
              <div className="order-detail__overview-title-row">
                {listingUrl ? (
                  <Link to={listingUrl} className="order-detail__overview-title">
                    {listing?.title ?? 'Listing unavailable'}
                  </Link>
                ) : (
                  <h1 className="order-detail__overview-title">
                    {listing?.title ?? 'Listing unavailable'}
                  </h1>
                )}
                <HubItemStatusBadge variant={statusBadge.variant} label={statusBadge.label} />
              </div>

              <OrderReferenceRow orderReference={orderReference} />

              {categoryName ? (
                <p className="order-detail__overview-meta">{categoryName}</p>
              ) : null}
              <p className="order-detail__overview-meta">{roleLabel}</p>
              <OrderParticipantProfileLink
                label="Buyer"
                userId={order?.buyer_id}
                profile={buyerProfile}
              />
              <OrderParticipantProfileLink
                label="Seller"
                userId={order?.seller_id}
                profile={sellerProfile}
              />
            </div>
          </div>

          <dl className="order-detail__overview-facts">
            <OrderDetailOverviewFact label="Total" highlight>
              {totalPrice}
            </OrderDetailOverviewFact>
            <OrderDetailOverviewFact label="Payment">
              {payment ? formatPaymentStatus(payment.status) : '—'}
            </OrderDetailOverviewFact>
            <OrderDetailOverviewFact label="Fulfilment">
              {getOrderFulfilmentDisplayStatus(order, viewerRole)}
            </OrderDetailOverviewFact>
            <OrderDetailOverviewFact label="Delivery method">
              {deliveryMethodLabel}
            </OrderDetailOverviewFact>
            <OrderDetailOverviewFact label="Buyer Protection">
              {buyerProtectionStatus}
            </OrderDetailOverviewFact>
          </dl>

          {listingUrl || conversationUrl ? (
            <div className="order-detail__overview-actions">
              {conversationUrl ? (
                <Link to={conversationUrl} className="order-detail__action-btn">
                  <EnvelopeIcon className="order-detail__action-icon" aria-hidden="true" />
                  Message
                </Link>
              ) : null}
              {listingUrl ? (
                <Link to={listingUrl} className="order-detail__action-btn">
                  <EyeIcon className="order-detail__action-icon" aria-hidden="true" />
                  View listing
                </Link>
              ) : null}
            </div>
          ) : null}

          {hasNextSteps ? (
            <div className="order-detail__overview-steps">
              {showBuyerHandoverAction ? (
                <div className="order-detail__step-block">
                  <CollectionBuyerHandoverPanel
                    orderType={order.order_type}
                    conversationUrl={conversationUrl}
                    compact
                  />
                </div>
              ) : null}

              {showBuyerConfirm ? (
                <div className="order-detail__step-block">
                  <h3 className="order-detail__step-title">Confirm receipt</h3>
                  <BuyerOrderConfirmation
                    orderId={order.id}
                    compact
                    onConfirmed={() => loadOrder({ refresh: true })}
                  />
                </div>
              ) : null}

              {showHandoverQr ? (
                <div className="order-detail__step-block">
                  <h3 className="order-detail__step-title">
                    {isSellerDeliveryOrder ? 'Handover QR code' : 'Collection QR code'}
                  </h3>
                  <CollectionQrPanel orderId={order.id} orderType={order.order_type} />
                </div>
              ) : null}

              {showCourierDeliveryConfirm ? (
                <div className="order-detail__step-block">
                  <CourierDeliveryConfirmation
                    order={{ ...order, listing }}
                    payment={payment}
                    compact
                    onConfirmed={() => loadOrder({ refresh: true })}
                  />
                </div>
              ) : null}

              {showCourierEvidenceForm ? (
                <div className="order-detail__step-block">
                  <CourierEvidenceForm
                    orderId={order.id}
                    onSubmitted={() => loadOrder({ refresh: true })}
                  />
                </div>
              ) : null}

              {showCourierEvidenceSummary ? (
                <div className="order-detail__step-block">
                  <CourierEvidenceSummary order={order} role={viewerRole} />
                </div>
              ) : null}

              {showSellerCancel ? (
                <div className="order-detail__step-block">
                  <h3 className="order-detail__step-title">Cancel sale</h3>
                  <p className="order-detail__step-lead" role="status">
                    The buyer has not paid yet. You can cancel this sale and return the listing
                    to active.
                  </p>
                  <TransactionCancelButton
                    offerId={offer.id}
                    compact
                    onCancelled={() => loadOrder({ refresh: true })}
                  />
                </div>
              ) : null}

              {showDevHandoverConfirm ? (
                <DevHandoverConfirmPanel
                  order={order}
                  onConfirmed={() => loadOrder({ refresh: true })}
                />
              ) : null}

              {showDevEndBuyerProtection ? (
                <DevEndBuyerProtectionPanel
                  order={order}
                  onEnded={async () => {
                    await loadOrder({ refresh: true })
                    await refreshReviews()
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </section>

        {showFulfilmentDetailsCard ? (
          <OrderFulfilmentDetailsCard
            orderId={order.id}
            listingId={order.listing_id}
            orderType={order.order_type}
            viewerRole={viewerRole}
            readOnly={isAdminViewer}
          />
        ) : null}

        <section className="order-detail__card order-detail__info-card">
          <h2 className="order-detail__card-title">Order information</h2>

          <details className="order-detail__info-group" open>
            <summary className="order-detail__info-summary">Payment &amp; offer</summary>
            <dl className="order-detail__info-list">
              <OrderDetailInfoRow label="Offer status">
                {offer ? formatOfferStatus(offer.status) : '—'}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow label="Payment status">
                {payment ? formatPaymentStatus(payment.status) : '—'}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow label="Fulfilment status">
                {getOrderFulfilmentDisplayStatus(order, viewerRole)}
              </OrderDetailInfoRow>
              {getOrderPayoutDisplayStatus(order, viewerRole) ? (
                <OrderDetailInfoRow label="Payout status">
                  {getOrderPayoutDisplayStatus(order, viewerRole)}
                </OrderDetailInfoRow>
              ) : null}
            </dl>
          </details>

          {viewerRole === 'seller' ? (
            <details className="order-detail__info-group">
              <summary className="order-detail__info-summary">Seller payout</summary>
              <dl className="order-detail__info-list">
                <OrderDetailInfoRow label="Seller receives">
                  {formatPricePence(
                    order.seller_net_pence ?? order.item_price_pence ?? order.amount_pence,
                  )}
                </OrderDetailInfoRow>
              </dl>
            </details>
          ) : null}

          <details className="order-detail__info-group">
            <summary className="order-detail__info-summary">Delivery method</summary>
            <p className="order-detail__delivery-method">{deliveryMethodDescription}</p>
          </details>

          <details className="order-detail__info-group">
            <summary className="order-detail__info-summary">Location</summary>
            <dl className="order-detail__info-list">
              <OrderDetailInfoRow label="Location">{listing?.location}</OrderDetailInfoRow>
            </dl>
          </details>

          <details className="order-detail__info-group">
            <summary className="order-detail__info-summary">Timeline timestamps</summary>
            <dl className="order-detail__info-list">
              <OrderDetailInfoRow label="Order created">
                {formatOrderTimestamp(order.created_at)}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow label="Collected">
                {formatOrderTimestamp(order.collected_at)}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow label="Buyer confirmed">
                {formatOrderTimestamp(order.buyer_confirmed_at)}
              </OrderDetailInfoRow>
              {viewerRole === 'seller' || viewerRole === 'admin' ? (
                <>
                  <OrderDetailInfoRow label="Payout release scheduled">
                    {formatOrderTimestamp(order.payout_release_at)}
                  </OrderDetailInfoRow>
                  <OrderDetailInfoRow label="Payout released">
                    {formatOrderTimestamp(order.payout_released_at)}
                  </OrderDetailInfoRow>
                </>
              ) : null}
            </dl>
          </details>

          <details className="order-detail__info-group">
            <summary className="order-detail__info-summary">Internal reference</summary>
            <dl className="order-detail__info-list">
              <OrderDetailInfoRow label="Order ID">
                <code className="order-detail__code">{order.id}</code>
              </OrderDetailInfoRow>
            </dl>
          </details>
        </section>

        {timeline ? (
          <section className="order-detail__card order-detail__timeline-card">
            <OrderTimeline timeline={timeline} compact showCurrentStatus={false} />
          </section>
        ) : null}

        {showReviewSection ? (
          <section className="order-detail__card order-detail__reviews-card">
            {reviewsError ? (
              <ErrorState compact>{reviewsError}</ErrorState>
            ) : null}
            <OrderReviewSection
              order={order}
              reviews={reviews}
              userId={user?.id}
              onSubmitted={refreshReviews}
            />
          </section>
        ) : null}

        {showSupportFooter ? (
          <section className="order-detail__card order-detail__support-card">
            {showCaseUpdatesHistory ? (
              <div className="order-detail__support-block">
                <OrderCaseUpdatesHistory updates={caseUpdates} isAdminViewer={isAdminViewer} />
              </div>
            ) : null}

            {showDisputeSection ? (
              <div className="order-detail__support-block">
                <OrderDisputeSection
                  order={order}
                  payment={payment}
                  role={viewerRole}
                  isAdmin={isAdmin}
                  compact
                  supportRequest={activeSupportRequest}
                  useCaseUpdateHistory={showCaseUpdatesHistory}
                  onDisputeOpened={() => loadOrder({ refresh: true })}
                  onDisputeUpdated={() => {
                    refreshCaseUpdates()
                    loadOrder({ refresh: true })
                  }}
                  onSupportUpdated={() => {
                    refreshSupportRequests()
                    refreshCaseUpdates()
                    loadOrder({ refresh: true })
                  }}
                />
              </div>
            ) : null}

            {showCompactSupport ? (
              <OrderDetailCompactSupport />
            ) : showOrderSupportRequest ? (
              <div className="order-detail__support-block">
                {supportError ? (
                  <ErrorState compact>{supportError}</ErrorState>
                ) : null}
                <OrderSupportRequest
                  order={order}
                  payment={payment}
                  requests={supportRequests}
                  disputes={disputes}
                  userId={user?.id}
                  viewerRole={viewerRole}
                  useCaseUpdateHistory={showCaseUpdatesHistory}
                  onSubmitted={() => {
                    refreshSupportRequests()
                    refreshCaseUpdates()
                    loadOrder({ refresh: true })
                  }}
                />
              </div>
            ) : null}

            {isAdminViewer && supportError && !showOrderSupportRequest ? (
              <ErrorState compact actionLabel="Open admin support" actionTo="/admin/support">
                {supportError}
              </ErrorState>
            ) : null}
          </section>
        ) : null}
      </div>
    </article>
  )
}

export default OrderDetailPage
