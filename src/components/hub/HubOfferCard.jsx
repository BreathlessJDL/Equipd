import { useState } from 'react'
import { Link } from 'react-router-dom'
import BuyerOrderConfirmation from '../BuyerOrderConfirmation'
import CounterOfferModal from '../messages/CounterOfferModal'
import AcceptOfferConfirmationModal from '../listing/AcceptOfferConfirmationModal'
import BuyerProtectionPriceDisplay from '../BuyerProtectionPriceDisplay'
import SellerPayoutSummary from '../SellerPayoutSummary'
import {
  shouldShowBuyerPricing,
  shouldShowSellerPricing,
} from '../../lib/pricingViewerRole'
import { getDisputesForOrderFromMap } from '../../lib/orderDisputes'
import CollectionQrPanel from '../CollectionQrPanel'
import CollectionBuyerHandoverPanel from '../orders/CollectionBuyerHandoverPanel'
import CourierDeliveryConfirmation from '../CourierDeliveryConfirmation'
import CourierEvidenceForm from '../CourierEvidenceForm'
import CourierEvidenceSummary from '../CourierEvidenceSummary'
import OrderDisputeSection from '../OrderDisputeSection'
import PayNowWithFulfilment from '../PayNowWithFulfilment'
import { TransactionCancelButton } from '../TransactionCancel'
import {
  buildHubNavActions,
  HubItemNavActions,
  HubItemReviewButton,
  HubItemReviewSubmitted,
} from './HubItemActions'
import {
  HubItemButton,
  HubItemList,
  HubItemRow,
  HubItemStatusBadge,
  HubItemThumbnail,
  HubItemTitle,
} from './HubItemRow'
import './HubItemRow.css'
import { HubEmptyState } from './HubEmptyState'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import { getProfileDisplayName } from '../../lib/profiles'
import {
  formatHubOfferMetadata,
  getHubItemStatusBadge,
  getHubOrderStageHint,
  getHubPaymentHint,
} from '../../lib/hubItemStatus'
import {
  acceptOffer,
  canBuyerWithdrawOffer,
  canSellerRespondToOffer,
  counterOffer,
  declineOffer,
  getOfferErrorMessage,
  canSellerCancelAcceptedOffer,
  withdrawOffer,
} from '../../lib/offers'
import { canPayNow, isAwaitingSellerSetup, isPaymentComplete } from '../../lib/payments'
import {
  canBuyerConfirmCourierDelivery,
  canBuyerConfirmOrder,
  canShowBuyerHandoverAction,
  canShowHandoverQr,
  canSellerSubmitCourierEvidence,
  canShowCourierEvidenceSummary,
  getCollectionHubStatusLabel,
  getCourierDeliveryHubStatusLabel,
  getCourierHubStatusLabel,
  getOfferOrder,
  getSellerDeliveryHubStatusLabel,
  getSellerPayoutProcessingMessage,
  isOrderBuyerConfirmed,
  isOrderCourierDelivered,
  isOrderCompleted,
  isSellerAwaitingPayout,
  PAYOUT_STATUSES,
  ORDER_TYPES,
} from '../../lib/orders'
import { isBuyerProtectionWindowActive, isOrderDisputed } from '../../lib/orderDisputes'
import { canUserLeaveReview, hasUserReviewedOrder } from '../../lib/reviews'
import '../TransactionCancel.css'

function buildOfferNavActions({ order, conversationUrl, listingUrl }) {
  return buildHubNavActions({
    order,
    conversationUrl,
    listingUrl,
    includeViewOrder: Boolean(order?.id),
  })
}

function HubOfferCard({
  offer,
  highlightOfferId = null,
  userId = null,
  partyRole = null,
  showWithdraw = false,
  showSellerRespondActions = false,
  showPaymentStatus = false,
  orderStatusRole = null,
  disputesByOrderId = null,
  showBuyerConfirm = false,
  showSellerCancel = false,
  onConfirmOrder,
  onCancelOffer,
  onOfferUpdated,
  onPayStart,
  onPayComplete,
  payingPaymentId = null,
  actingOfferId = null,
  onRunOfferAction,
  onOpenCounter,
  userReviews = [],
  onOpenLeaveReview,
}) {
  const [courierEvidenceOpen, setCourierEvidenceOpen] = useState(false)
  const [collectionQrOpen, setCollectionQrOpen] = useState(false)

  const listing = offer.listing
  const listingUrl = listing?.slug ? `/listings/${listing.slug}` : null
  const conversationUrl = offer.conversation_id ? `/messages/${offer.conversation_id}` : null
  const payment = offer.payment
  const order = getOfferOrder(offer)
  const showPayButton = showPaymentStatus && canPayNow(payment)
  const isSellerDeliveryOrder = order?.order_type === ORDER_TYPES.SELLER_DELIVERY
  const showHandoverQr = orderStatusRole === 'seller' && canShowHandoverQr(order, payment)
  const showBuyerHandoverAction =
    orderStatusRole === 'buyer' && canShowBuyerHandoverAction(order, payment)
  const showSellerDeliveryNotice =
    order?.order_type === 'seller_delivery' &&
    (orderStatusRole === 'buyer' || orderStatusRole === 'seller') &&
    !showHandoverQr
  const showConfirm = showBuyerConfirm && canBuyerConfirmOrder(order, payment) && order?.id
  const showCollectionQr = showHandoverQr
  const showCourierEvidenceForm =
    orderStatusRole === 'seller' && canSellerSubmitCourierEvidence(order, payment)
  const showCourierEvidenceSummary =
    canShowCourierEvidenceSummary(order) &&
    (orderStatusRole === 'buyer' || orderStatusRole === 'seller') &&
    !canBuyerConfirmCourierDelivery(order, payment)
  const showCourierDeliveryConfirm =
    orderStatusRole === 'buyer' && canBuyerConfirmCourierDelivery(order, payment)
  const showCourierDeliveredNotice =
    isOrderCourierDelivered(order) &&
    (orderStatusRole === 'buyer' || orderStatusRole === 'seller')
  const showOrderDispute =
    order?.id &&
    isPaymentComplete(payment) &&
    orderStatusRole &&
    (isOrderDisputed(order) ||
      (orderStatusRole === 'buyer' && isBuyerProtectionWindowActive(order)))
  const showCancel = showSellerCancel && canSellerCancelAcceptedOffer(offer)
  const showSellerPayoutNotice =
    orderStatusRole === 'seller' && isSellerAwaitingPayout(order)
  const partyProfile =
    partyRole === 'seller'
      ? (Array.isArray(offer.seller) ? offer.seller[0] : offer.seller)
      : partyRole === 'buyer'
        ? (Array.isArray(offer.buyer) ? offer.buyer[0] : offer.buyer)
        : null
  const partyLabel =
    partyRole === 'seller' ? 'Seller' : partyRole === 'buyer' ? 'Buyer' : null
  const thumbnailUrl = listing?.listing_images?.[0]?.url
  const canWithdraw = showWithdraw && canBuyerWithdrawOffer(offer, userId)
  const canRespond = showSellerRespondActions && canSellerRespondToOffer(offer)
  const isActing = actingOfferId === offer.id
  const isCompletedOrderContext = Boolean(orderStatusRole && order && isOrderCompleted(order))
  const canLeaveReview =
    isCompletedOrderContext && userId && canUserLeaveReview(order, userReviews, userId)
  const reviewSubmitted =
    isCompletedOrderContext &&
    userId &&
    hasUserReviewedOrder(userReviews, order?.id, userId) &&
    !canLeaveReview

  const statusBadge = getHubItemStatusBadge(offer, {
    orderStatusRole,
    showPaymentStatus,
    disputes: getDisputesForOrderFromMap(order?.id, disputesByOrderId),
  })
  const metadata = formatHubOfferMetadata({
    partyLabel,
    partyName: partyProfile ? getProfileDisplayName(partyProfile) : null,
    order,
    isOrderContext: Boolean(orderStatusRole),
    datePrefix: orderStatusRole ? 'Updated' : 'Submitted',
    date: orderStatusRole ? offer.updated_at ?? offer.created_at : offer.created_at,
  })

  const stageHint = getHubOrderStageHint(offer, orderStatusRole)
  const paymentHint =
    showPaymentStatus && payment && !isPaymentComplete(payment)
      ? getHubPaymentHint(payment)
      : null
  const payoutHint =
    orderStatusRole === 'seller' &&
    isOrderBuyerConfirmed(order) &&
    order.payout_status === PAYOUT_STATUSES.AWAITING_SELLER_SETUP
      ? 'Complete payout setup in Settings to receive funds.'
      : null

  const hint = [stageHint, paymentHint, payoutHint, showBuyerHandoverAction
    ? isSellerDeliveryOrder
      ? 'Inspect the equipment after delivery, then scan the seller handover QR code.'
      : 'Scan the seller collection QR when you collect this item.'
    : null]
    .filter(Boolean)
    .join(' ')

  const showBuyerPricing = shouldShowBuyerPricing({ userId, offer, orderStatusRole })
  const showSellerPricing = shouldShowSellerPricing({ userId, offer, orderStatusRole })

  const priceContent = showBuyerPricing ? (
    <BuyerProtectionPriceDisplay
      payment={payment ?? null}
      itemPricePence={payment ? null : offer.amount_pence}
      compact
      className="hub-item-row__buyer-protection"
    />
  ) : showSellerPricing ? (
    <SellerPayoutSummary
      itemPricePence={offer.amount_pence}
      payment={payment}
      compact
      offerAmountLabel="Offer price"
      receiveLabel="You'll receive"
      className="hub-item-row__seller-payout"
    />
  ) : (
    <BuyerProtectionPriceDisplay
      payment={payment ?? null}
      itemPricePence={payment ? null : offer.amount_pence}
      compact
      className="hub-item-row__buyer-protection"
    />
  )

  const workflowPrimaryActions = (
    <>
      {canRespond ? (
        <HubItemButton
          variant="primary"
          disabled={isActing}
          onClick={() => onRunOfferAction(offer.id, 'accept')}
        >
          {isActing ? 'Accepting…' : 'Accept'}
        </HubItemButton>
      ) : null}

      {showPayButton ? (
        <div className="hub-item-row__pay-wrap">
          <PayNowWithFulfilment
            offer={offer}
            payment={payment}
            payingPaymentId={payingPaymentId}
            onPayStart={onPayStart}
            onPayComplete={onPayComplete}
          />
        </div>
      ) : null}

      {showCourierEvidenceForm ? (
        <HubItemButton
          variant="primary"
          ariaExpanded={courierEvidenceOpen}
          onClick={() => setCourierEvidenceOpen((open) => !open)}
        >
          {courierEvidenceOpen ? 'Hide evidence form' : 'Submit evidence'}
        </HubItemButton>
      ) : null}
    </>
  )

  const workflowSecondaryActions = (
    <>
      {canRespond ? (
        <>
          <HubItemButton disabled={isActing} onClick={() => onOpenCounter(offer)}>
            Counter offer
          </HubItemButton>
          <HubItemButton
            disabled={isActing}
            onClick={() => onRunOfferAction(offer.id, 'decline')}
          >
            {isActing ? 'Declining…' : 'Decline'}
          </HubItemButton>
        </>
      ) : null}

      {canWithdraw ? (
        <HubItemButton
          disabled={isActing}
          onClick={() => onRunOfferAction(offer.id, 'withdraw')}
        >
          {isActing ? 'Withdrawing…' : 'Withdraw offer'}
        </HubItemButton>
      ) : null}

      {showCollectionQr ? (
        <HubItemButton
          ariaExpanded={collectionQrOpen}
          onClick={() => setCollectionQrOpen((open) => !open)}
        >
          {collectionQrOpen
            ? isSellerDeliveryOrder
              ? 'Hide handover QR'
              : 'Hide collection QR'
            : isSellerDeliveryOrder
              ? 'Show handover QR'
              : 'Show collection QR'}
        </HubItemButton>
      ) : null}

      {showCancel ? (
        <TransactionCancelButton
          offerId={offer.id}
          compact
          onCancelled={() => onCancelOffer?.(offer)}
        />
      ) : null}
    </>
  )

  const completedDecisionActions =
    isCompletedOrderContext && order?.id ? (
      <>
        {canLeaveReview ? (
          <HubItemReviewButton
            onClick={() => {
              const revieweeProfile =
                userId === order.buyer_id
                  ? Array.isArray(offer.seller)
                    ? offer.seller[0]
                    : offer.seller
                  : Array.isArray(offer.buyer)
                    ? offer.buyer[0]
                    : offer.buyer

              onOpenLeaveReview?.(order, {
                listing,
                revieweeProfile,
              })
            }}
          />
        ) : null}
        {reviewSubmitted ? <HubItemReviewSubmitted /> : null}
      </>
    ) : null

  const iconActions = buildOfferNavActions({
    order,
    conversationUrl,
    listingUrl,
  })

  const details = (
    <>
      {isAwaitingSellerSetup(payment) ? (
        <p className="hub-item-row__details-hint">
          Seller must complete payout setup before you can pay.
        </p>
      ) : null}

      {courierEvidenceOpen ? (
        <CourierEvidenceForm orderId={order.id} onSubmitted={() => onOfferUpdated?.()} />
      ) : null}

      {collectionQrOpen ? (
        <CollectionQrPanel orderId={order.id} orderType={order?.order_type} compact />
      ) : null}

      {showCourierDeliveryConfirm ? (
        <CourierDeliveryConfirmation
          order={{ ...order, listing }}
          payment={payment}
          compact
          onConfirmed={() => onOfferUpdated?.()}
        />
      ) : null}

      {showCourierDeliveredNotice ? (
        <p className="hub-item-row__details-hint">
          {getCourierDeliveryHubStatusLabel(order, orderStatusRole)}
        </p>
      ) : null}

      {showOrderDispute && orderStatusRole ? (
        <OrderDisputeSection
          order={order}
          payment={payment}
          role={orderStatusRole}
          compact
          allowReport={false}
          onDisputeOpened={() => onOfferUpdated?.()}
        />
      ) : null}

      {showCourierEvidenceSummary ? (
        <CourierEvidenceSummary order={order} role={orderStatusRole} />
      ) : null}

      {showSellerDeliveryNotice ? (
        <p className="hub-item-row__details-hint">
          {getSellerDeliveryHubStatusLabel(order, orderStatusRole)}
        </p>
      ) : null}

      {showBuyerHandoverAction ? (
        <CollectionBuyerHandoverPanel
          orderType={order?.order_type}
          conversationUrl={conversationUrl}
          compact
        />
      ) : null}

      {showSellerPayoutNotice ? (
        <p className="hub-item-row__details-hint">{getSellerPayoutProcessingMessage(order)}</p>
      ) : null}

      {showConfirm ? (
        <BuyerOrderConfirmation
          orderId={order.id}
          compact
          onConfirmed={() => onConfirmOrder?.(offer)}
        />
      ) : null}

      {orderStatusRole === 'seller' &&
      isOrderBuyerConfirmed(order) &&
      order.payout_status === PAYOUT_STATUSES.AWAITING_SELLER_SETUP ? (
        <p className="hub-item-row__details-hint">
          <Link to="/settings">Complete payout setup</Link>
        </p>
      ) : null}
    </>
  )

  const hasDetails =
    showCourierDeliveryConfirm ||
    showOrderDispute ||
    showCourierEvidenceSummary ||
    showConfirm ||
    showBuyerHandoverAction ||
    showSellerPayoutNotice ||
    courierEvidenceOpen ||
    collectionQrOpen ||
    isAwaitingSellerSetup(payment) ||
    showCourierDeliveredNotice ||
    showSellerDeliveryNotice

  return (
    <HubItemRow
      id={`hub-offer-${offer.id}`}
      highlighted={highlightOfferId === offer.id}
      media={<HubItemThumbnail src={thumbnailUrl} href={listingUrl} alt="" />}
      title={
        <HubItemTitle href={listingUrl}>
          {listing?.title ?? 'Listing unavailable'}
        </HubItemTitle>
      }
      status={<HubItemStatusBadge variant={statusBadge.variant} label={statusBadge.label} />}
      metadata={metadata}
      hint={hint || null}
      message={offer.message?.trim() || null}
      price={priceContent}
      primaryActions={
        <>
          {completedDecisionActions}
          {!isCompletedOrderContext ? workflowPrimaryActions : null}
        </>
      }
      secondaryActions={!isCompletedOrderContext ? workflowSecondaryActions : null}
      iconActions={iconActions}
      details={hasDetails ? details : null}
    />
  )
}

function HubOfferList({
  offers,
  emptyState = null,
  emptyMessage = '',
  loadError = '',
  highlightOfferId = null,
  userId = null,
  partyRole = null,
  showWithdraw = false,
  showSellerRespondActions = false,
  showPaymentStatus = false,
  orderStatusRole = null,
  disputesByOrderId = null,
  showBuyerConfirm = false,
  showSellerCancel = false,
  onConfirmOrder,
  onCancelOffer,
  onOfferUpdated,
  onPayStart,
  onPayComplete,
  payingPaymentId = null,
  payError = '',
  userReviews = [],
  onOpenLeaveReview,
}) {
  const [actingOfferId, setActingOfferId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [counteringOffer, setCounteringOffer] = useState(null)
  const [acceptedOfferConfirmation, setAcceptedOfferConfirmation] = useState(null)

  if (loadError) {
    return (
      <p className="hub-page__message hub-page__message--error" role="alert">
        {loadError}
      </p>
    )
  }

  const safeOffers = offers ?? []

  if (safeOffers.length === 0) {
    if (emptyState) return <HubEmptyState {...emptyState} />
    if (emptyMessage) {
      return (
        <HubEmptyState
          variant={EQUIPD_ICON_VARIANT.NEW_OFFER}
          title={emptyMessage}
        />
      )
    }
    return null
  }

  async function runOfferAction(offerId, action) {
    setActingOfferId(offerId)
    setActionError('')

    const acceptedOffer = safeOffers.find((entry) => entry.id === offerId)

    const actionMap = {
      withdraw: () => withdrawOffer(offerId),
      accept: () => acceptOffer(offerId),
      decline: () => declineOffer(offerId),
    }

    const { error } = await actionMap[action]()

    setActingOfferId(null)

    if (error) {
      setActionError(getOfferErrorMessage(error))
      return
    }

    if (action === 'accept' && acceptedOffer) {
      setAcceptedOfferConfirmation(acceptedOffer)
    }

    onOfferUpdated?.()
  }

  async function handleCounterSubmit(amountInput) {
    if (!counteringOffer) return

    setActingOfferId(counteringOffer.id)
    setActionError('')

    const { error } = await counterOffer(counteringOffer.id, amountInput)

    setActingOfferId(null)
    setCounteringOffer(null)

    if (error) {
      setActionError(getOfferErrorMessage(error))
      return
    }

    onOfferUpdated?.()
  }

  return (
    <>
      {payError ? (
        <p className="hub-page__message hub-page__message--error" role="alert">
          {payError}
        </p>
      ) : null}

      {actionError ? (
        <p className="hub-page__message hub-page__message--error" role="alert">
          {actionError}
        </p>
      ) : null}

      <HubItemList>
        {safeOffers.map((offer) => {
          if (!offer?.id) return null

          return (
            <HubOfferCard
              key={offer.id}
              offer={offer}
              highlightOfferId={highlightOfferId}
              userId={userId}
              partyRole={partyRole}
              showWithdraw={showWithdraw}
              showSellerRespondActions={showSellerRespondActions}
              showPaymentStatus={showPaymentStatus}
              orderStatusRole={orderStatusRole}
              disputesByOrderId={disputesByOrderId}
              showBuyerConfirm={showBuyerConfirm}
              showSellerCancel={showSellerCancel}
              onConfirmOrder={onConfirmOrder}
              onCancelOffer={onCancelOffer}
              onOfferUpdated={onOfferUpdated}
              onPayStart={onPayStart}
              onPayComplete={onPayComplete}
              payingPaymentId={payingPaymentId}
              actingOfferId={actingOfferId}
              onRunOfferAction={runOfferAction}
              onOpenCounter={setCounteringOffer}
              userReviews={userReviews}
              onOpenLeaveReview={onOpenLeaveReview}
            />
          )
        })}
      </HubItemList>

      <CounterOfferModal
        open={Boolean(counteringOffer)}
        listingPricePence={counteringOffer?.listing?.price_pence}
        submitting={Boolean(actingOfferId)}
        onClose={() => setCounteringOffer(null)}
        onSubmit={handleCounterSubmit}
      />

      <AcceptOfferConfirmationModal
        open={Boolean(acceptedOfferConfirmation)}
        itemPricePence={acceptedOfferConfirmation?.amount_pence ?? null}
        conversationId={acceptedOfferConfirmation?.conversation_id ?? null}
        onClose={() => setAcceptedOfferConfirmation(null)}
      />
    </>
  )
}

function HubSection({ title, lead, linkTo, linkLabel, children }) {
  return (
    <section className="hub-section">
      <header className="hub-section__header">
        <div>
          <h3 className="hub-section__title">{title}</h3>
          {lead ? <p className="hub-section__lead">{lead}</p> : null}
        </div>
        {linkTo && linkLabel ? (
          <Link to={linkTo} className="hub-section__action">
            {linkLabel}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export { HubOfferList, HubSection, HubItemStatusBadge }
