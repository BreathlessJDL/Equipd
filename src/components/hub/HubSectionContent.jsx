import { Link } from 'react-router-dom'
import ListingCard from '../ListingCard'
import BuyerProtectionInfo from '../BuyerProtectionInfo'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import HubScopedPngIcon from './HubScopedPngIcon'
import { HUB_PNG_ICONS } from '../../lib/hubPngIcons'
import { ArrowRightIcon } from '../icons/NavIcons'
import '../icons/NavIcons.css'
import {
  EQUIPD_ICON_VARIANT,
  HUB_ATTENTION_ICON_VARIANT,
  HUB_SUMMARY_ICON_VARIANT,
} from '../../lib/equipdIconVariants'
import { HubOfferList } from './HubOfferCard'
import { HubListingList } from './HubListingRow'
import {
  HubItemList,
  HubItemPrice,
  HubItemRow,
  HubItemStatusBadge,
  HubItemThumbnail,
  HubItemTitle,
} from './HubItemRow'
import { HubItemReviewButton } from './HubItemActions'
import './HubItemRow.css'
import { HubSectionTabs } from './HubLayout'
import { HubEmptyState } from './HubEmptyState'
import { HUB_EMPTY_STATES } from '../../lib/hubEmptyStates'
import {
  HUB_BUYING_TABS,
  HUB_LISTINGS_TABS,
  HUB_ORDERS_TABS,
  HUB_ORDERS_SUB_TABS,
  HUB_REVIEWS_TABS,
  HUB_SELLING_TABS,
} from '../../lib/hubNavigation'
import { formatReviewTimestamp, formatReviewDateShort, getReviewText, renderStarRating } from '../../lib/reviews'
import { getProfileDisplayName } from '../../lib/profiles'
import { formatPricePence } from '../../lib/listings'
import { isPaymentComplete } from '../../lib/payments'
import {
  canBuyerConfirmCourierDelivery,
  canBuyerConfirmOrder,
  canSellerSubmitCourierEvidence,
  canShowHandoverQr,
  getOfferOrder,
  isOrderAwaitingFulfilment,
  isOrderCompleted,
} from '../../lib/orders'
import { isOrderDisputed } from '../../lib/orderDisputes'

function HubPanel({ title, lead, action, className = '', children }) {
  return (
    <div className={`hub-panel${className ? ` ${className}` : ''}`}>
      <header className="hub-panel__header">
        <div>
          {title ? <h3 className="hub-panel__title">{title}</h3> : null}
          {lead ? <p className="hub-panel__lead">{lead}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

const HUB_SUMMARY_CARDS = [
  {
    key: 'buying',
    label: 'Buying',
    shortLabel: 'Buying',
    hint: 'View your purchases',
    section: 'buying',
    tab: 'offers',
    mobileOnly: true,
    hideCount: true,
  },
  {
    key: 'selling',
    label: 'Selling',
    shortLabel: 'Selling',
    hint: 'Manage your listings',
    section: 'selling',
    tab: 'offers',
    mobileOnly: true,
    hideCount: true,
  },
]

const HUB_TRANSACTION_ACTION_CARDS = [
  {
    key: 'orders-in-progress',
    label: 'Orders in progress',
    section: 'orders',
    tab: HUB_ORDERS_TABS.purchases.id,
    subTab: HUB_ORDERS_SUB_TABS.in_progress.id,
    countKey: 'ordersInProgress',
    getSubtitle: (count) =>
      count === 0
        ? 'No active purchases'
        : `${count} active purchase${count === 1 ? '' : 's'}`,
  },
  {
    key: 'sales-in-progress',
    label: 'Sales in progress',
    section: 'orders',
    tab: HUB_ORDERS_TABS.sales.id,
    subTab: HUB_ORDERS_SUB_TABS.in_progress.id,
    countKey: 'salesInProgress',
    getSubtitle: (count) =>
      count === 0 ? 'No active sales' : `${count} active sale${count === 1 ? '' : 's'}`,
  },
]

const HUB_ATTENTION_DISPLAY = {
  'offers-received': {
    actionRequired: true,
    description: (count) =>
      `${count} offer${count === 1 ? '' : 's'} need accepting, declining, or countering.`,
    actionLabel: 'Review offers',
  },
  'buyer-pay': {
    actionRequired: true,
    description: (count) =>
      `${count} accepted offer${count === 1 ? '' : 's'} waiting for your payment.`,
    actionLabel: 'Complete payment',
  },
  'seller-awaiting-pay': {
    actionRequired: true,
    description: (count) =>
      `${count} buyer${count === 1 ? '' : 's'} still need to complete checkout.`,
    actionLabel: 'View sales',
  },
  'buyer-collection': {
    actionRequired: true,
    description: (count) =>
      `${count} order${count === 1 ? '' : 's'} ready for collection or delivery.`,
    actionLabel: 'View orders',
  },
  'courier-evidence': {
    actionRequired: true,
    description: () => 'Upload handover evidence before courier collection.',
    actionLabel: 'Submit evidence',
  },
  disputes: {
    description: (count) =>
      `${count} open dispute${count === 1 ? '' : 's'} need your attention.`,
    actionLabel: 'View disputes',
    urgent: true,
  },
  'payout-setup': {
    description: () => 'Connect your payout account to receive funds from reserved listings.',
    actionLabel: 'Set up payouts',
    urgent: true,
  },
  'pending-reviews': {
    actionRequired: true,
    description: () => 'Leave a review for completed orders.',
    actionLabel: 'Review orders',
  },
}

function HubAttentionChevron() {
  return (
    <span className="hub-attention__chevron" aria-hidden="true">
      <ArrowRightIcon />
    </span>
  )
}

function HubSummaryCardIcon({ cardKey }) {
  if (cardKey === 'buying') {
    return (
      <HubScopedPngIcon
        src={HUB_PNG_ICONS.buying}
        className="hub-summary-card__feature-icon hub-summary-card__feature-icon--buying"
      />
    )
  }

  if (cardKey === 'selling') {
    return (
      <HubScopedPngIcon
        src={HUB_PNG_ICONS.selling}
        className="hub-summary-card__feature-icon hub-summary-card__feature-icon--selling"
      />
    )
  }

  return (
    <EquipdTypeIcon
      variant={HUB_SUMMARY_ICON_VARIANT[cardKey]}
      className="hub-summary-card__type-icon"
    />
  )
}

function HubTransactionActionIcon({ cardKey }) {
  if (cardKey === 'orders-in-progress') {
    return (
      <HubScopedPngIcon
        src={HUB_PNG_ICONS.orderInProgress}
        className="hub-transaction-action__icon hub-transaction-action__icon--orders-png"
      />
    )
  }

  return (
    <EquipdTypeIcon
      variant={HUB_SUMMARY_ICON_VARIANT[cardKey]}
      className="hub-transaction-action__icon"
    />
  )
}

function HubSummarySection({ counts, needsAttention, onNavigate }) {
  return (
    <HubPanel
      title="Summary"
      lead="Quick overview of your buying and selling activity."
      className="hub-panel--summary"
    >
      <div className="hub-summary-panel__body">
        <div className="hub-summary-cards">
          {HUB_SUMMARY_CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`hub-summary-card${
                card.mobileOnly ? ' hub-summary-card--mobile-only' : ''
              }${card.hideCount ? ' hub-summary-card--no-count' : ''} hub-summary-card--${card.key}`}
              onClick={() => onNavigate(card.section, card.tab, undefined, card.subTab)}
            >
              <HubSummaryCardIcon cardKey={card.key} />
              {!card.hideCount ? (
                <span className="hub-summary-card__value">{counts[card.countKey]}</span>
              ) : null}
              <span className="hub-summary-card__label">
                <span className="hub-summary-card__label-long">{card.label}</span>
                <span className="hub-summary-card__label-short">{card.shortLabel}</span>
              </span>
              <span className="hub-summary-card__hint">{card.hint}</span>
            </button>
          ))}
        </div>

        <ul className="hub-transaction-actions" aria-label="Active orders">
          {HUB_TRANSACTION_ACTION_CARDS.map((card) => {
            const count = counts[card.countKey] ?? 0

            return (
              <li key={card.key}>
                <button
                  type="button"
                  className="hub-transaction-action"
                  onClick={() =>
                    onNavigate(card.section, card.tab, undefined, card.subTab)
                  }
                >
                  <HubTransactionActionIcon cardKey={card.key} />
                  <span className="hub-transaction-action__body">
                    <span className="hub-transaction-action__title-row">
                      <span className="hub-transaction-action__title">{card.label}</span>
                      {count > 0 ? (
                        <span className="hub-transaction-action__count">{count}</span>
                      ) : null}
                    </span>
                    <span className="hub-transaction-action__subtitle">
                      {card.getSubtitle(count)}
                    </span>
                  </span>
                  <HubAttentionChevron />
                </button>
              </li>
            )
          })}
        </ul>

        {needsAttention.length > 0 ? (
          <section className="hub-attention" aria-labelledby="hub-attention-title">
            <h4 id="hub-attention-title" className="hub-attention__title">
              Needs attention
            </h4>
            <ul className="hub-attention__list">
              {needsAttention.map((item) => {
                const display = HUB_ATTENTION_DISPLAY[item.id] ?? {}
                const description =
                  typeof display.description === 'function'
                    ? display.description(item.count)
                    : item.label
                const urgent = Boolean(display.urgent)
                const iconVariant =
                  HUB_ATTENTION_ICON_VARIANT[item.id] ?? EQUIPD_ICON_VARIANT.SUPPORT_DISPUTE

                return (
                  <li key={item.id}>
                    <div
                      className={`hub-attention__row hub-attention__row--desktop${
                        urgent ? ' hub-attention__row--urgent' : ''
                      }`}
                    >
                      <EquipdTypeIcon variant={iconVariant} />

                      <div className="hub-attention__content">
                        <div className="hub-attention__header">
                          <h5 className="hub-attention__label">{item.label}</h5>
                          {item.count > 0 ? (
                            <span className="hub-attention__count">{item.count}</span>
                          ) : null}
                        </div>
                        <p className="hub-attention__description">{description}</p>
                      </div>

                      <button
                        type="button"
                        className={`hub-attention__action${
                          urgent ? ' hub-attention__action--urgent' : ''
                        }`}
                        onClick={() => onNavigate(item.section, item.tab, item.offerId)}
                      >
                        {display.actionLabel ?? 'View'}
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`hub-attention__row hub-attention__row--mobile${
                        urgent ? ' hub-attention__row--urgent' : ''
                      }`}
                      onClick={() => onNavigate(item.section, item.tab, item.offerId)}
                    >
                      <EquipdTypeIcon variant={iconVariant} />
                      <span className="hub-attention__mobile-title">
                        <span className="hub-attention__label">{item.label}</span>
                        {item.count > 0 ? (
                          <span className="hub-attention__count">{item.count}</span>
                        ) : null}
                      </span>
                      <HubAttentionChevron />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <HubEmptyState {...HUB_EMPTY_STATES.summaryAttention} />
        )}
      </div>
    </HubPanel>
  )
}

function HubBuyingSection({
  tab,
  onTabChange,
  tabBadges = {},
  pendingOffersMade,
  acceptedUnpaidOffers,
  buyerAwaitingFulfilmentOrders,
  buyerAwaitingConfirmOrders,
  buyerInProgressOrders,
  completedBuyerOrders,
  cancelledOffersMade,
  buyerOffersLoadError,
  highlightOfferId,
  userId,
  userReviews = [],
  handlers,
  payState,
}) {
  return (
    <HubPanel title="Buying" lead="Offers you have made and purchases in progress.">
      <HubSectionTabs
        tabs={HUB_BUYING_TABS}
        activeTab={tab}
        onChange={onTabChange}
        tabBadges={tabBadges}
      />

      {tab === HUB_BUYING_TABS.offers.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={pendingOffersMade}
          userId={userId}
          partyRole="seller"
          showWithdraw
          onOfferUpdated={handlers.onOfferUpdated}
          loadError={buyerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.buyingOffers}
        />
      ) : null}

      {tab === HUB_BUYING_TABS.awaiting_payment.id ? (
        <>
          {acceptedUnpaidOffers.length > 0 ? (
            <BuyerProtectionInfo variant="payment" compact />
          ) : null}
          <HubOfferList
            highlightOfferId={highlightOfferId}
            offers={acceptedUnpaidOffers}
            showPaymentStatus
            onPayStart={handlers.onPayStart}
            onPayComplete={handlers.onPayComplete}
            payingPaymentId={payState.payingPaymentId}
            payError={payState.payError}
            loadError={buyerOffersLoadError}
            emptyState={HUB_EMPTY_STATES.buyingAwaitingPayment}
          />
        </>
      ) : null}

      {tab === HUB_BUYING_TABS.in_progress.id ? (
        <>
          {buyerAwaitingFulfilmentOrders.length > 0 ? (
            <BuyerProtectionInfo variant="order" role="buyer" compact />
          ) : null}
          <HubOfferList
            highlightOfferId={highlightOfferId}
            offers={[
              ...buyerAwaitingFulfilmentOrders,
              ...buyerAwaitingConfirmOrders,
              ...buyerInProgressOrders,
            ]}
            orderStatusRole="buyer"
            showBuyerConfirm
            onConfirmOrder={handlers.onConfirmOrder}
            onOfferUpdated={handlers.onOfferUpdated}
            loadError={buyerOffersLoadError}
            emptyState={HUB_EMPTY_STATES.buyingInProgress}
          />
        </>
      ) : null}

      {tab === HUB_BUYING_TABS.completed.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={completedBuyerOrders}
          orderStatusRole="buyer"
          userId={userId}
          userReviews={userReviews}
          onOpenLeaveReview={handlers.onOpenLeaveReview}
          loadError={buyerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.buyingCompleted}
        />
      ) : null}

      {tab === HUB_BUYING_TABS.cancelled.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={cancelledOffersMade}
          loadError={buyerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.buyingCancelled}
        />
      ) : null}
    </HubPanel>
  )
}

function HubSellingSection({
  tab,
  onTabChange,
  tabBadges = {},
  pendingOffersReceived,
  sellerAcceptedUnpaidOffers,
  activeSellerSales,
  completedSellerOrders = [],
  soldListings,
  cancelledOffersReceived,
  sellerOffersLoadError,
  listingsLoadError,
  highlightOfferId,
  userId,
  userReviews = [],
  handlers,
}) {
  return (
    <HubPanel title="Selling" lead="Offers on your listings and sales in progress.">
      <HubSectionTabs
        tabs={HUB_SELLING_TABS}
        activeTab={tab}
        onChange={onTabChange}
        tabBadges={tabBadges}
      />

      {tab === HUB_SELLING_TABS.offers.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={pendingOffersReceived}
          userId={userId}
          partyRole="buyer"
          showSellerRespondActions
          onOfferUpdated={handlers.onOfferUpdated}
          loadError={sellerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.sellingOffers}
        />
      ) : null}

      {tab === HUB_SELLING_TABS.awaiting_payment.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={sellerAcceptedUnpaidOffers}
          showSellerCancel
          onCancelOffer={handlers.onCancelOffer}
          loadError={sellerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.sellingAwaitingPayment}
        />
      ) : null}

      {tab === HUB_SELLING_TABS.active.id ? (
        <>
          {activeSellerSales.length > 0 ? (
            <BuyerProtectionInfo variant="seller" compact />
          ) : null}
          <HubOfferList
            highlightOfferId={highlightOfferId}
            offers={activeSellerSales}
            orderStatusRole="seller"
            onOfferUpdated={handlers.onOfferUpdated}
            loadError={sellerOffersLoadError}
            emptyState={HUB_EMPTY_STATES.sellingActive}
          />
        </>
      ) : null}

      {tab === HUB_SELLING_TABS.sold.id ? (
        <>
          {completedSellerOrders.length > 0 ? (
            <HubOfferList
              highlightOfferId={highlightOfferId}
              offers={completedSellerOrders}
              orderStatusRole="seller"
              userId={userId}
              userReviews={userReviews}
              onOpenLeaveReview={handlers.onOpenLeaveReview}
              onOfferUpdated={handlers.onOfferUpdated}
              loadError={sellerOffersLoadError}
              emptyMessage=""
            />
          ) : null}
          {listingsLoadError ? (
            <p className="hub-page__message hub-page__message--error">{listingsLoadError}</p>
          ) : soldListings.length === 0 && completedSellerOrders.length === 0 ? (
            <HubEmptyState {...HUB_EMPTY_STATES.sellingSold} />
          ) : soldListings.length > 0 ? (
            <>
              {completedSellerOrders.length > 0 ? (
                <h3 className="hub-section__subtitle">Listing archive</h3>
              ) : null}
              <HubListingList
                listings={soldListings}
                emptyMessage=""
              />
            </>
          ) : null}
        </>
      ) : null}

      {tab === HUB_SELLING_TABS.cancelled.id ? (
        <HubOfferList
          highlightOfferId={highlightOfferId}
          offers={cancelledOffersReceived}
          loadError={sellerOffersLoadError}
          emptyState={HUB_EMPTY_STATES.sellingCancelled}
        />
      ) : null}
    </HubPanel>
  )
}

function HubListingsSection({ tab, onTabChange, tabBadges = {}, listingsByTab, listingsLoadError }) {
  const current = listingsByTab[tab] ?? []

  return (
    <HubPanel
      title="Listings"
      lead="Manage the equipment you are selling on Equipd."
      action={
        <div className="hub-panel__actions">
          <Link to="/listings/new" className="hub-panel__action hub-panel__action--primary">
            Create listing
          </Link>
          <Link to="/my-listings" className="hub-panel__action">
            Manage all
          </Link>
        </div>
      }
    >
      <HubSectionTabs
        tabs={HUB_LISTINGS_TABS}
        activeTab={tab}
        onChange={onTabChange}
        tabBadges={tabBadges}
      />

      {listingsLoadError ? (
        <p className="hub-page__message hub-page__message--error">{listingsLoadError}</p>
      ) : current.length === 0 ? (
        <HubEmptyState
          {...(tab === HUB_LISTINGS_TABS.draft.id
            ? HUB_EMPTY_STATES.listingsDraft
            : tab === HUB_LISTINGS_TABS.active.id
              ? HUB_EMPTY_STATES.listingsActive
              : tab === HUB_LISTINGS_TABS.reserved.id
                ? HUB_EMPTY_STATES.listingsReserved
                : HUB_EMPTY_STATES.listingsSold)}
        />
      ) : (
        <HubListingList listings={current} />
      )}
    </HubPanel>
  )
}

function HubOffersSection({
  pendingOffersMade,
  acceptedUnpaidOffers,
  buyerOffersLoadError,
  highlightOfferId,
  userId,
  handlers,
  payState,
}) {
  const hasAwaitingPayment = acceptedUnpaidOffers.length > 0
  const hasPendingOffers = pendingOffersMade.length > 0
  const isEmpty = !hasAwaitingPayment && !hasPendingOffers

  return (
    <HubPanel
      title="My offers"
      lead="Offers you have made as a buyer. Respond to incoming offers in Selling."
    >
      {isEmpty ? (
        <HubEmptyState {...HUB_EMPTY_STATES.myOffers} />
      ) : (
        <>
          {hasAwaitingPayment ? (
            <div className="hub-offers-group">
              <h4 className="hub-offers-group__title">Awaiting payment</h4>
              <BuyerProtectionInfo variant="payment" compact />
              <HubOfferList
                highlightOfferId={highlightOfferId}
                offers={acceptedUnpaidOffers}
                showPaymentStatus
                onPayStart={handlers.onPayStart}
                onPayComplete={handlers.onPayComplete}
                payingPaymentId={payState.payingPaymentId}
                payError={payState.payError}
                loadError={buyerOffersLoadError}
                emptyState={HUB_EMPTY_STATES.buyingAwaitingPayment}
              />
            </div>
          ) : null}

          {hasPendingOffers ? (
            <div className="hub-offers-group">
              <h4 className="hub-offers-group__title">Pending</h4>
              <HubOfferList
                highlightOfferId={highlightOfferId}
                offers={pendingOffersMade}
                userId={userId}
                partyRole="seller"
                showWithdraw
                onOfferUpdated={handlers.onOfferUpdated}
                loadError={buyerOffersLoadError}
                emptyState={HUB_EMPTY_STATES.buyingOffers}
              />
            </div>
          ) : null}
        </>
      )}
    </HubPanel>
  )
}

function HubOrdersSection({
  tab,
  ordersSubTab = HUB_ORDERS_SUB_TABS.in_progress.id,
  onTabChange,
  onOrdersSubTabChange,
  tabBadges = {},
  purchaseSubTabBadges = {},
  salesSubTabBadges = {},
  purchasesInProgressOrders,
  completedPurchasesOrders = [],
  salesOrders,
  completedSalesOrders = [],
  buyerOffersLoadError,
  sellerOffersLoadError,
  highlightOfferId,
  handlers,
  userId,
  userReviews = [],
  payState,
}) {
  const purchasesShowPaymentInfo = purchasesInProgressOrders.some(
    (offer) => !isPaymentComplete(offer.payment),
  )
  const purchasesShowOrderInfo = purchasesInProgressOrders.some((offer) =>
    isOrderAwaitingFulfilment(getOfferOrder(offer), offer.payment),
  )

  return (
    <HubPanel
      title="Orders"
      lead="Purchases and sales — track in progress and completed orders."
      className="hub-panel--orders"
    >
      <HubSectionTabs
        tabs={HUB_ORDERS_TABS}
        activeTab={tab}
        onChange={onTabChange}
        tabBadges={tabBadges}
        ariaLabel="Orders: Purchases or Sales"
      />

      {tab === HUB_ORDERS_TABS.purchases.id ? (
        <>
          <HubSectionTabs
            tabs={HUB_ORDERS_SUB_TABS}
            activeTab={ordersSubTab}
            onChange={onOrdersSubTabChange}
            tabBadges={purchaseSubTabBadges}
          />

          {ordersSubTab === HUB_ORDERS_SUB_TABS.in_progress.id ? (
            <>
              {purchasesShowPaymentInfo ? (
                <BuyerProtectionInfo variant="payment" compact />
              ) : null}
              {purchasesShowOrderInfo ? (
                <BuyerProtectionInfo variant="order" role="buyer" compact />
              ) : null}
              <HubOfferList
                highlightOfferId={highlightOfferId}
                offers={purchasesInProgressOrders}
                orderStatusRole="buyer"
                showBuyerConfirm
                showPaymentStatus
                onPayStart={handlers.onPayStart}
                onPayComplete={handlers.onPayComplete}
                payingPaymentId={payState?.payingPaymentId}
                payError={payState?.payError}
                onConfirmOrder={handlers.onConfirmOrder}
                onOfferUpdated={handlers.onOfferUpdated}
                loadError={buyerOffersLoadError}
                emptyState={HUB_EMPTY_STATES.ordersPurchasesInProgress}
              />
            </>
          ) : (
            <HubOfferList
              highlightOfferId={highlightOfferId}
              offers={completedPurchasesOrders}
              orderStatusRole="buyer"
              userId={userId}
              userReviews={userReviews}
              onOpenLeaveReview={handlers.onOpenLeaveReview}
              onOfferUpdated={handlers.onOfferUpdated}
              loadError={buyerOffersLoadError}
              emptyState={HUB_EMPTY_STATES.ordersPurchasesCompleted}
            />
          )}
        </>
      ) : (
        <>
          <HubSectionTabs
            tabs={HUB_ORDERS_SUB_TABS}
            activeTab={ordersSubTab}
            onChange={onOrdersSubTabChange}
            tabBadges={salesSubTabBadges}
          />

          {ordersSubTab === HUB_ORDERS_SUB_TABS.in_progress.id ? (
            <HubOfferList
              highlightOfferId={highlightOfferId}
              offers={salesOrders}
              orderStatusRole="seller"
              onOfferUpdated={handlers.onOfferUpdated}
              loadError={sellerOffersLoadError}
              emptyState={HUB_EMPTY_STATES.ordersSalesInProgress}
            />
          ) : (
            <HubOfferList
              highlightOfferId={highlightOfferId}
              offers={completedSalesOrders}
              orderStatusRole="seller"
              userId={userId}
              userReviews={userReviews}
              onOpenLeaveReview={handlers.onOpenLeaveReview}
              onOfferUpdated={handlers.onOfferUpdated}
              loadError={sellerOffersLoadError}
              emptyState={HUB_EMPTY_STATES.ordersSalesCompleted}
            />
          )}
        </>
      )}
    </HubPanel>
  )
}

function HubSavedSection({ savedListings, savedLoading, savedError }) {
  if (savedLoading) {
    return <HubPanel title="Saved listings" lead="Loading saved listings…" />
  }

  return (
    <HubPanel
      title="Saved listings"
      lead="Equipment you have saved for later."
      action={
        <Link to="/saved-listings" className="hub-panel__action">
          Open full page
        </Link>
      }
    >
      {savedError ? (
        <p className="hub-page__message hub-page__message--error">{savedError}</p>
      ) : savedListings.length === 0 ? (
        <HubEmptyState {...HUB_EMPTY_STATES.saved} />
      ) : (
        <div className="hub-listings-grid">
          {savedListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} variant="home" />
          ))}
        </div>
      )}
    </HubPanel>
  )
}

function HubPendingReviewRow({ entry, onOpenLeaveReview }) {
  const listingUrl = entry.listingSlug ? `/listings/${entry.listingSlug}` : null

  return (
    <HubItemRow
      centerActions
      media={<HubItemThumbnail src={entry.thumbnailUrl} href={listingUrl} alt="" />}
      title={<HubItemTitle href={listingUrl}>{entry.title}</HubItemTitle>}
      status={<HubItemStatusBadge variant="completed" label={entry.roleLabel} />}
      metadata={entry.completedLabel}
      price={<HubItemPrice amount={formatPricePence(entry.amountPence)} />}
      primaryActions={
        <HubItemReviewButton
          onClick={() =>
            onOpenLeaveReview?.(entry.order, {
              listing: entry.listing ?? null,
              revieweeProfile: entry.revieweeProfile ?? null,
            })
          }
        />
      }
    />
  )
}

function HubReviewsSection({
  tab,
  onTabChange,
  tabBadges = {},
  reviewsReceived,
  reviewsLeft,
  pendingReviewOrders,
  reviewsLoading,
  reviewsError,
  onOpenLeaveReview,
}) {
  return (
    <HubPanel title="Reviews" lead="Feedback from completed transactions.">
      <HubSectionTabs
        tabs={HUB_REVIEWS_TABS}
        activeTab={tab}
        onChange={onTabChange}
        tabBadges={tabBadges}
      />

      {reviewsLoading ? (
        <p className="hub-section__empty">Loading reviews…</p>
      ) : reviewsError ? (
        <p className="hub-page__message hub-page__message--error">{reviewsError}</p>
      ) : null}

      {!reviewsLoading && !reviewsError && tab === HUB_REVIEWS_TABS.received.id ? (
        reviewsReceived.length === 0 ? (
          <HubEmptyState {...HUB_EMPTY_STATES.reviewsReceived} />
        ) : (
          <ul className="hub-review-list">
            {reviewsReceived.map((review) => (
              <li key={review.id} className="hub-review-card">
                <p className="hub-review-card__rating">{renderStarRating(review.rating)}</p>
                <p className="hub-review-card__meta">
                  {getProfileDisplayName(review.reviewer)} ·{' '}
                  {formatReviewTimestamp(review.created_at)}
                </p>
                {getReviewText(review) ? (
                  <p className="hub-review-card__comment">{getReviewText(review)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!reviewsLoading && !reviewsError && tab === HUB_REVIEWS_TABS.left.id ? (
        reviewsLeft.length === 0 ? (
          <HubEmptyState {...HUB_EMPTY_STATES.reviewsLeft} />
        ) : (
          <ul className="hub-review-list">
            {reviewsLeft.map((review) => (
              <li key={review.id} className="hub-review-card">
                <p className="hub-review-card__rating">{renderStarRating(review.rating)}</p>
                <p className="hub-review-card__meta">
                  {formatReviewTimestamp(review.created_at)}
                </p>
                {getReviewText(review) ? (
                  <p className="hub-review-card__comment">{getReviewText(review)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!reviewsLoading && !reviewsError && tab === HUB_REVIEWS_TABS.pending.id ? (
        pendingReviewOrders.length === 0 ? (
          <HubEmptyState {...HUB_EMPTY_STATES.reviewsPending} />
        ) : (
          <HubItemList>
            {pendingReviewOrders.map((entry) => (
              <HubPendingReviewRow
                key={entry.orderId}
                entry={entry}
                onOpenLeaveReview={onOpenLeaveReview}
              />
            ))}
          </HubItemList>
        )
      ) : null}
    </HubPanel>
  )
}

export function buildHubNeedsAttention({
  pendingOffersFromBuyers,
  acceptedUnpaidOffers,
  sellerAcceptedUnpaidOffers,
  buyerAwaitingFulfilmentOrders,
  activeSellerSales,
  showPayoutSetupBanner,
  pendingReviewCount = 0,
}) {
  const items = []

  if (pendingOffersFromBuyers.length > 0) {
    items.push({
      id: 'offers-received',
      label: 'Offers awaiting your response',
      count: pendingOffersFromBuyers.length,
      section: 'selling',
      tab: 'offers',
    })
  }

  if (acceptedUnpaidOffers.length > 0) {
    items.push({
      id: 'buyer-pay',
      label: 'Accepted offers awaiting your payment',
      count: acceptedUnpaidOffers.length,
      section: 'offers',
    })
  }

  if (sellerAcceptedUnpaidOffers.length > 0) {
    items.push({
      id: 'seller-awaiting-pay',
      label: 'Accepted sales awaiting buyer payment',
      count: sellerAcceptedUnpaidOffers.length,
      section: 'selling',
      tab: 'awaiting_payment',
    })
  }

  if (buyerAwaitingFulfilmentOrders.length > 0) {
    items.push({
      id: 'buyer-collection',
      label: 'Orders awaiting collection',
      count: buyerAwaitingFulfilmentOrders.length,
      section: 'buying',
      tab: 'in_progress',
    })
  }

  const courierEvidenceCount = activeSellerSales.filter((offer) =>
    canSellerSubmitCourierEvidence(getOfferOrder(offer), offer.payment),
  ).length

  if (courierEvidenceCount > 0) {
    items.push({
      id: 'courier-evidence',
      label: 'Courier evidence required',
      count: courierEvidenceCount,
      section: 'selling',
      tab: 'active',
    })
  }

  const disputeCount = activeSellerSales.filter((offer) =>
    isOrderDisputed(getOfferOrder(offer)),
  ).length

  if (disputeCount > 0) {
    items.push({
      id: 'disputes',
      label: 'Open disputes',
      count: disputeCount,
      section: 'selling',
      tab: 'active',
    })
  }

  if (showPayoutSetupBanner) {
    items.push({
      id: 'payout-setup',
      label: 'Payout setup required',
      count: 1,
      section: 'settings',
    })
  }

  if (pendingReviewCount > 0) {
    items.push({
      id: 'pending-reviews',
      label: 'Orders ready for review',
      count: pendingReviewCount,
      section: 'reviews',
      tab: 'pending',
    })
  }

  return items
}

export function filterHubPurchasesInProgressOffers(offers = []) {
  return offers.filter((offer) => {
    const order = getOfferOrder(offer)
    const payment = offer.payment
    return !(isPaymentComplete(payment) && isOrderCompleted(order))
  })
}

export function filterHubPurchasesCompletedOffers(offers = []) {
  return offers.filter(
    (offer) => isPaymentComplete(offer.payment) && isOrderCompleted(getOfferOrder(offer)),
  )
}

function isBuyerPurchaseActionRequired(offer) {
  const order = getOfferOrder(offer)
  const payment = offer.payment

  return (
    canBuyerConfirmOrder(order, payment) ||
    canBuyerConfirmCourierDelivery(order, payment) ||
    canShowHandoverQr(order, payment)
  )
}

function isSellerSaleActionRequired(offer) {
  const order = getOfferOrder(offer)
  const payment = offer.payment

  return (
    canShowHandoverQr(order, payment) ||
    canSellerSubmitCourierEvidence(order, payment) ||
    isOrderDisputed(order)
  )
}

export function countActionableBuyerPurchaseOffers(offers = []) {
  return offers.filter(isBuyerPurchaseActionRequired).length
}

export function countActionableSellerSaleOffers(offers = []) {
  return offers.filter(isSellerSaleActionRequired).length
}

function sumTabBadgeValues(tabs) {
  return Object.values(tabs).reduce((total, count) => total + count, 0)
}

export function buildHubAttentionBadges({
  acceptedUnpaidOffers,
  pendingOffersFromBuyers,
  purchaseOrders,
  salesInProgressOrders,
  showPayoutSetupBanner,
  pendingReviewOrders,
}) {
  const pendingBuyerReviewCount = (pendingReviewOrders ?? []).filter(
    (entry) => entry.roleLabel === 'Purchase completed',
  ).length
  const pendingSellerReviewCount = (pendingReviewOrders ?? []).filter(
    (entry) => entry.roleLabel === 'Sale completed',
  ).length
  const pendingReviewCount = pendingBuyerReviewCount + pendingSellerReviewCount

  const buyerPurchaseAttentionCount = countActionableBuyerPurchaseOffers(purchaseOrders)
  const sellerSaleAttentionCount = countActionableSellerSaleOffers(salesInProgressOrders)
  const payoutAttention = showPayoutSetupBanner ? 1 : 0
  const myOffersAttentionCount = acceptedUnpaidOffers.length

  const buyingTabs = {
    offers: 0,
    awaiting_payment: 0,
    in_progress: buyerPurchaseAttentionCount,
    completed: pendingBuyerReviewCount,
    cancelled: 0,
  }

  const sellingTabs = {
    offers: pendingOffersFromBuyers.length,
    awaiting_payment: 0,
    active: sellerSaleAttentionCount + payoutAttention,
    sold: pendingSellerReviewCount,
    cancelled: 0,
  }

  const listingsTabs = {
    active: 0,
    draft: 0,
    reserved: 0,
    sold: 0,
  }

  const ordersTabs = {
    purchases: buyerPurchaseAttentionCount,
    sales: sellerSaleAttentionCount,
  }

  const ordersSubTabs = {
    purchases: {
      in_progress: buyerPurchaseAttentionCount,
      completed: pendingBuyerReviewCount,
    },
    sales: {
      in_progress: sellerSaleAttentionCount,
      completed: pendingSellerReviewCount,
    },
  }

  const reviewsTabs = {
    received: 0,
    left: 0,
    pending: pendingReviewCount,
  }

  return {
    sections: {
      buying: sumTabBadgeValues(buyingTabs),
      selling: sumTabBadgeValues(sellingTabs),
      listings: sumTabBadgeValues(listingsTabs),
      offers: myOffersAttentionCount,
      orders: sumTabBadgeValues(ordersTabs),
      reviews: sumTabBadgeValues(reviewsTabs),
      saved: 0,
    },
    tabs: {
      buying: buyingTabs,
      selling: sellingTabs,
      listings: listingsTabs,
      orders: ordersTabs,
      reviews: reviewsTabs,
    },
    ordersSubTabs,
  }
}

export function buildHubCounts({
  myListings,
  pendingOffersMade,
  pendingOffersFromBuyers,
  purchaseOrders,
  salesOrders,
  savedListingsCount,
}) {
  return {
    activeListings: myListings.filter((listing) => listing.status === 'active').length,
    offersReceived: pendingOffersFromBuyers.length,
    offersMade: pendingOffersMade.length,
    ordersInProgress: purchaseOrders.length,
    salesInProgress: salesOrders.length,
    savedListings: savedListingsCount,
  }
}

export function groupListingsByTab(myListings) {
  return {
    active: myListings.filter((listing) => listing.status === 'active'),
    draft: myListings.filter((listing) => listing.status === 'draft'),
    reserved: myListings.filter(
      (listing) => listing.status === 'reserved' || listing.status === 'in_progress',
    ),
    sold: myListings.filter((listing) => listing.status === 'sold'),
  }
}

export {
  HubSummarySection,
  HubBuyingSection,
  HubSellingSection,
  HubListingsSection,
  HubOffersSection,
  HubOrdersSection,
  HubSavedSection,
  HubReviewsSection,
}
