import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HubLayout } from '../components/hub/HubLayout'
import '../components/hub/HubLayout.css'
import {
  HubBuyingSection,
  HubListingsSection,
  HubOffersSection,
  HubOrdersSection,
  HubReviewsSection,
  HubSavedSection,
  HubSellingSection,
  HubSummarySection,
  buildHubAttentionBadges,
  buildHubCounts,
  buildHubNeedsAttention,
  filterHubPurchasesInProgressOffers,
  groupListingsByTab,
} from '../components/hub/HubSectionContent'
import '../components/Hub.css'
import '../components/ListingBrowse.css'
import { useHubScrollRestoration, scrollHubToTop } from '../hooks/useHubScrollRestoration'
import { useAuth } from '../hooks/useAuth'
import { buildHubSearchParams, getHubSectionLead, getHubSectionMeta, parseHubNavigation, HUB_ORDERS_SUB_TABS } from '../lib/hubNavigation'
import { fetchMyListings, getListingErrorMessage } from '../lib/listings'
import {
  fetchBuyerOffers,
  fetchSellerOffers,
  filterBuyerPendingOffers,
  filterSellerReceivedPendingOffers,
  getOfferErrorMessage,
  logSupabaseError,
} from '../lib/offers'
import { isPaymentComplete } from '../lib/payments'
import { fetchDisputesForOrders } from '../lib/orderDisputes'
import {
  canBuyerConfirmOrder,
  applyOrdersToOffers,
  fetchOrdersByOfferIds,
  getOfferOrder,
  isHubCompletedOffer,
  isOrderAwaitingFulfilment,
  isOrderBuyerConfirmed,
  isOrderHubHistory,
  isPaidHubOrder,
  isPayoutReleased,
  isSellerHubSaleInProgress,
  logHubOfferPipelineDiagnostics,
} from '../lib/orders'
import { fetchProfile } from '../lib/profiles'
import {
  fetchReviewsByReviewer,
  fetchReviewsForUser,
  getReviewErrorMessage,
  canUserLeaveReview,
  formatReviewDateShort,
  isDuplicateReviewError,
  submitReview,
} from '../lib/reviews'
import {
  fetchSavedListings,
  getSavedListingErrorMessage,
  partitionSavedListings,
} from '../lib/savedListings'
import { ErrorState, LoadingState } from '../components/ui/UiState'
import { LeaveReviewModal } from '../components/Reviews'
import { usePageTitle } from '../hooks/usePageTitle'

function HubPage() {
  usePageTitle('My Hub')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { section, tab, subTab } = useMemo(() => parseHubNavigation(searchParams), [searchParams])

  const [myListings, setMyListings] = useState([])
  const [pendingOffersMade, setPendingOffersMade] = useState([])
  const [acceptedOffersMade, setAcceptedOffersMade] = useState([])
  const [offersReceived, setOffersReceived] = useState([])
  const [acceptedOffersReceived, setAcceptedOffersReceived] = useState([])
  const [cancelledOffersMade, setCancelledOffersMade] = useState([])
  const [cancelledOffersReceived, setCancelledOffersReceived] = useState([])
  const [savedListings, setSavedListings] = useState([])
  const [reviewsReceived, setReviewsReceived] = useState([])
  const [reviewsLeft, setReviewsLeft] = useState([])
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savedLoading, setSavedLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [error, setError] = useState('')
  const [listingsLoadError, setListingsLoadError] = useState('')
  const [buyerOffersLoadError, setBuyerOffersLoadError] = useState('')
  const [sellerOffersLoadError, setSellerOffersLoadError] = useState('')
  const [savedError, setSavedError] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const hasLoadedRef = useRef(false)
  const [payingPaymentId, setPayingPaymentId] = useState(null)
  const [payError, setPayError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const handledPaymentParamRef = useRef(false)
  const paymentSuccessPollRef = useRef(null)
  const handledOfferHighlightRef = useRef(false)
  const loadHubDataRef = useRef(null)
  const [highlightedOfferId, setHighlightedOfferId] = useState(() => searchParams.get('offerId'))
  const shouldRestoreScroll = !searchParams.get('offerId')
  const [leaveReviewTarget, setLeaveReviewTarget] = useState(null)
  const [leaveReviewSubmitting, setLeaveReviewSubmitting] = useState(false)
  const [leaveReviewError, setLeaveReviewError] = useState('')
  const [disputesByOrderId, setDisputesByOrderId] = useState({})

  useHubScrollRestoration({
    enabled: shouldRestoreScroll,
    ready: !loading,
  })

  const previousHubViewRef = useRef(null)

  useEffect(() => {
    const hubViewKey = `${section}:${tab}`

    if (previousHubViewRef.current === null) {
      previousHubViewRef.current = hubViewKey
      return
    }

    if (previousHubViewRef.current === hubViewKey) {
      return
    }

    previousHubViewRef.current = hubViewKey
    scrollHubToTop()
  }, [section, tab])

  const loadHubData = useCallback(async ({ refresh = false } = {}) => {
    if (!user?.id) return

    if (hasLoadedRef.current || refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    setListingsLoadError('')
    setBuyerOffersLoadError('')
    setSellerOffersLoadError('')

    const [
      listingsResult,
      pendingMadeResult,
      acceptedMadeResult,
      receivedResult,
      acceptedReceivedResult,
      cancelledMadeResult,
      cancelledReceivedResult,
      profileResult,
      savedResult,
      reviewsReceivedResult,
      reviewsLeftResult,
    ] = await Promise.all([
      fetchMyListings(user.id),
      fetchBuyerOffers(user.id, 'pending'),
      fetchBuyerOffers(user.id, 'accepted'),
      fetchSellerOffers(user.id, 'pending'),
      fetchSellerOffers(user.id, 'accepted'),
      fetchBuyerOffers(user.id, 'cancelled'),
      fetchSellerOffers(user.id, 'cancelled'),
      fetchProfile(user.id, { email: user.email }),
      fetchSavedListings(user.id),
      fetchReviewsForUser(user.id, { limit: 50 }),
      fetchReviewsByReviewer(user.id, { limit: 50 }),
    ])

    const buyerOfferResults = [pendingMadeResult, acceptedMadeResult, cancelledMadeResult]
    const sellerOfferResults = [receivedResult, acceptedReceivedResult, cancelledReceivedResult]

    const buyerOffersFailed = buyerOfferResults.every((result) => result.error)
    const sellerOffersFailed = sellerOfferResults.every((result) => result.error)

    if (listingsResult.error) {
      logSupabaseError('hub listings', listingsResult.error)
      setListingsLoadError('Could not load your listings.')
    }

    for (const result of buyerOfferResults) {
      if (result.error) logSupabaseError('hub buyer offers', result.error)
    }

    for (const result of sellerOfferResults) {
      if (result.error) logSupabaseError('hub seller offers', result.error)
    }

    if (buyerOffersFailed) {
      setBuyerOffersLoadError('Could not load your offers right now. Refresh or try again shortly.')
    }

    if (sellerOffersFailed) {
      setSellerOffersLoadError(
        'Could not load offers on your listings right now. Refresh or try again shortly.',
      )
    }

    if (savedResult.error) {
      setSavedError(getSavedListingErrorMessage(savedResult.error))
      setSavedListings([])
    } else {
      const partitioned = partitionSavedListings(savedResult.data ?? [])
      setSavedListings(partitioned.activeListings)
      setSavedError('')
    }

    if (reviewsReceivedResult.error || reviewsLeftResult.error) {
      setReviewsError(
        getReviewErrorMessage(reviewsReceivedResult.error ?? reviewsLeftResult.error),
      )
      setReviewsReceived([])
      setReviewsLeft([])
    } else {
      setReviewsReceived(reviewsReceivedResult.data ?? [])
      setReviewsLeft(reviewsLeftResult.data ?? [])
      setReviewsError('')
    }

    const allFailed =
      listingsResult.error &&
      buyerOffersFailed &&
      sellerOffersFailed &&
      profileResult.error

    if (allFailed) {
      const firstError =
        listingsResult.error ??
        pendingMadeResult.error ??
        acceptedMadeResult.error ??
        receivedResult.error ??
        acceptedReceivedResult.error ??
        cancelledMadeResult.error ??
        cancelledReceivedResult.error ??
        profileResult.error
      setError(getListingErrorMessage(firstError) || getOfferErrorMessage(firstError))
      setMyListings([])
      setPendingOffersMade([])
      setAcceptedOffersMade([])
      setOffersReceived([])
      setAcceptedOffersReceived([])
      setCancelledOffersMade([])
      setCancelledOffersReceived([])
      setStripeOnboardingComplete(false)
      setDisputesByOrderId({})
      setLoading(false)
      setRefreshing(false)
      setSavedLoading(false)
      setReviewsLoading(false)
      return
    }

    const allHubOffers = [
      ...(pendingMadeResult.data ?? []),
      ...(acceptedMadeResult.data ?? []),
      ...(receivedResult.data ?? []),
      ...(acceptedReceivedResult.data ?? []),
      ...(cancelledMadeResult.data ?? []),
      ...(cancelledReceivedResult.data ?? []),
    ]
    const allHubOfferIds = [...new Set(allHubOffers.map((offer) => offer.id).filter(Boolean))]

    const hubOrdersResult = await fetchOrdersByOfferIds(allHubOfferIds)
    if (hubOrdersResult.error) {
      logSupabaseError('hub orders lookup', hubOrdersResult.error)
    }
    const hubOrders = hubOrdersResult.data ?? []
    const attachHubOrders = (offers) => applyOrdersToOffers(offers ?? [], hubOrders)

    const mergedPendingMade = attachHubOrders(pendingMadeResult.data)
    const mergedAcceptedMade = attachHubOrders(acceptedMadeResult.data)
    const mergedReceived = attachHubOrders(receivedResult.data)
    const mergedAcceptedReceived = attachHubOrders(acceptedReceivedResult.data)
    const mergedCancelledMade = attachHubOrders(cancelledMadeResult.data)
    const mergedCancelledReceived = attachHubOrders(cancelledReceivedResult.data)

    setMyListings(listingsResult.data ?? [])
    setPendingOffersMade(mergedPendingMade)
    setAcceptedOffersMade(mergedAcceptedMade)
    setOffersReceived(mergedReceived)
    setAcceptedOffersReceived(mergedAcceptedReceived)
    setCancelledOffersMade(mergedCancelledMade)
    setCancelledOffersReceived(mergedCancelledReceived)
    setStripeOnboardingComplete(profileResult.data?.stripe_onboarding_complete ?? false)

    logHubOfferPipelineDiagnostics({
      acceptedBuyerOffers: mergedAcceptedMade,
      acceptedSellerOffers: mergedAcceptedReceived,
      requestedOfferIds: allHubOfferIds,
      orders: hubOrders,
      orderFetchError: hubOrdersResult.error,
    })

    const hubOrderIds = [
      ...new Set([
        ...hubOrders.map((order) => order.id).filter(Boolean),
        ...[
          ...mergedPendingMade,
          ...mergedAcceptedMade,
          ...mergedReceived,
          ...mergedAcceptedReceived,
          ...mergedCancelledMade,
          ...mergedCancelledReceived,
        ]
          .map((offer) => getOfferOrder(offer)?.id)
          .filter(Boolean),
      ]),
    ]
    const disputesResult = await fetchDisputesForOrders(hubOrderIds)
    if (disputesResult.error) {
      logSupabaseError('hub order disputes', disputesResult.error)
    }
    setDisputesByOrderId(disputesResult.data ?? {})

    hasLoadedRef.current = true
    setLoading(false)
    setRefreshing(false)
    setSavedLoading(false)
    setReviewsLoading(false)
  }, [user?.email, user?.id])

  loadHubDataRef.current = loadHubData

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function load() {
      await loadHubData({ refresh: hasLoadedRef.current })
      if (!active) return
    }

    load()

    return () => {
      active = false
    }
  }, [loadHubData, user?.id])

  useEffect(() => {
    if (!user?.id || handledPaymentParamRef.current) return

    const paymentResult = searchParams.get('payment')
    if (!paymentResult) return

    handledPaymentParamRef.current = true

    if (paymentResult === 'success') {
      setPaymentNotice(
        'Payment received. Your order will appear below once Stripe confirms payment.',
      )
      const pollDelaysMs = [2000, 5000, 10000]

      function pollAfterPayment(attempt = 0) {
        loadHubDataRef.current?.({ refresh: true })

        if (attempt >= pollDelaysMs.length - 1) {
          paymentSuccessPollRef.current = null
          return
        }

        paymentSuccessPollRef.current = window.setTimeout(() => {
          pollAfterPayment(attempt + 1)
        }, pollDelaysMs[attempt + 1] - pollDelaysMs[attempt])
      }

      if (paymentSuccessPollRef.current) {
        window.clearTimeout(paymentSuccessPollRef.current)
      }

      paymentSuccessPollRef.current = window.setTimeout(() => {
        pollAfterPayment(0)
      }, pollDelaysMs[0])
    } else if (paymentResult === 'cancelled') {
      setPaymentNotice('Checkout was cancelled. You can pay any time before the deadline.')
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    nextParams.delete('session_id')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams, user?.id])

  useEffect(() => {
    return () => {
      if (paymentSuccessPollRef.current) {
        window.clearTimeout(paymentSuccessPollRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const offerId = searchParams.get('offerId')
    if (offerId) {
      setHighlightedOfferId(offerId)
      handledOfferHighlightRef.current = false
    }
  }, [searchParams])

  useEffect(() => {
    if (!highlightedOfferId || loading || refreshing || handledOfferHighlightRef.current) {
      return undefined
    }

    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`hub-offer-${highlightedOfferId}`)
      if (!element) return

      handledOfferHighlightRef.current = true
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('offerId')
      setSearchParams(nextParams, { replace: true })

      window.setTimeout(() => {
        setHighlightedOfferId(null)
      }, 3000)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [highlightedOfferId, loading, refreshing, searchParams, setSearchParams])

  const pendingBuyerOffersMade = useMemo(
    () => filterBuyerPendingOffers(pendingOffersMade),
    [pendingOffersMade],
  )

  const pendingOffersFromBuyers = useMemo(
    () => filterSellerReceivedPendingOffers(offersReceived),
    [offersReceived],
  )

  const listingsByTab = useMemo(() => groupListingsByTab(myListings), [myListings])

  const acceptedUnpaidOffers = useMemo(
    () => acceptedOffersMade.filter((offer) => !isPaymentComplete(offer.payment)),
    [acceptedOffersMade],
  )

  const buyerAwaitingFulfilmentOrders = useMemo(
    () =>
      acceptedOffersMade.filter((offer) =>
        isOrderAwaitingFulfilment(getOfferOrder(offer), offer.payment),
      ),
    [acceptedOffersMade],
  )

  const buyerAwaitingConfirmOrders = useMemo(
    () =>
      acceptedOffersMade.filter((offer) =>
        canBuyerConfirmOrder(getOfferOrder(offer), offer.payment),
      ),
    [acceptedOffersMade],
  )

  const buyerInProgressOrders = useMemo(
    () =>
      acceptedOffersMade.filter((offer) => {
        const order = getOfferOrder(offer)
        const payment = offer.payment

        if (!isPaidHubOrder(order, payment)) return false
        if (isOrderHubHistory(order)) return false
        if (isOrderBuyerConfirmed(order)) return false
        if (isOrderAwaitingFulfilment(order, payment)) return false
        if (canBuyerConfirmOrder(order, payment)) return false

        return true
      }),
    [acceptedOffersMade],
  )

  const completedBuyerOrders = useMemo(
    () => acceptedOffersMade.filter(isHubCompletedOffer),
    [acceptedOffersMade],
  )

  const completedSalesOrders = useMemo(
    () => acceptedOffersReceived.filter(isHubCompletedOffer),
    [acceptedOffersReceived],
  )

  const salesInProgressOrders = useMemo(
    () =>
      acceptedOffersReceived.filter((offer) => {
        const order = getOfferOrder(offer)
        const payment = offer.payment
        if (!isPaymentComplete(payment) || !order) return false
        if (isOrderHubHistory(order)) return false
        return isPaidHubOrder(order, payment)
      }),
    [acceptedOffersReceived],
  )

  const soldListings = useMemo(() => {
    const listingIdsWithOrders = new Set(
      acceptedOffersReceived
        .filter((offer) => isPaymentComplete(offer.payment) && getOfferOrder(offer))
        .map((offer) => offer.listing?.id ?? offer.listing_id ?? getOfferOrder(offer)?.listing_id)
        .filter(Boolean),
    )

    return myListings.filter(
      (listing) => listing.status === 'sold' && !listingIdsWithOrders.has(listing.id),
    )
  }, [acceptedOffersReceived, myListings])

  const activeSellerSales = useMemo(
    () =>
      acceptedOffersReceived.filter((offer) =>
        isSellerHubSaleInProgress(getOfferOrder(offer), offer.payment),
      ),
    [acceptedOffersReceived],
  )

  const sellerAcceptedUnpaidOffers = useMemo(
    () => acceptedOffersReceived.filter((offer) => !isPaymentComplete(offer.payment)),
    [acceptedOffersReceived],
  )

  const purchasesInProgressOrders = useMemo(
    () => filterHubPurchasesInProgressOffers(acceptedOffersMade),
    [acceptedOffersMade],
  )

  const showPayoutSetupBanner = useMemo(
    () =>
      !stripeOnboardingComplete &&
      myListings.some((listing) => listing.status === 'reserved'),
    [myListings, stripeOnboardingComplete],
  )

  const pendingReviewOrders = useMemo(() => {
    if (!user?.id) return []

    return [...completedBuyerOrders, ...completedSalesOrders]
      .filter((offer) => canUserLeaveReview(getOfferOrder(offer), reviewsLeft, user.id))
      .map((offer) => {
        const order = getOfferOrder(offer)
        if (!order?.id) return null

        const isBuyer = offer.buyer_id === user.id
        const completedAt = order.updated_at ?? order.created_at ?? offer.updated_at
        const sellerProfile = Array.isArray(offer.seller) ? offer.seller[0] : offer.seller
        const buyerProfile = Array.isArray(offer.buyer) ? offer.buyer[0] : offer.buyer

        return {
          orderId: order.id,
          order,
          listing: offer.listing ?? null,
          revieweeProfile: isBuyer ? sellerProfile : buyerProfile,
          title: offer.listing?.title ?? 'Completed order',
          amountPence: offer.amount_pence,
          thumbnailUrl: offer.listing?.listing_images?.[0]?.url ?? null,
          listingSlug: offer.listing?.slug ?? null,
          roleLabel: isBuyer
            ? 'Purchase completed'
            : isPayoutReleased(order)
              ? 'Sale completed'
              : 'Awaiting payout',
          completedLabel: completedAt
            ? `Completed ${formatReviewDateShort(completedAt)}`
            : 'Completed recently',
        }
      })
      .filter(Boolean)
  }, [completedBuyerOrders, completedSalesOrders, reviewsLeft, user?.id])

  const pendingReviewCount = pendingReviewOrders.length

  const handleOpenLeaveReview = useCallback(
    (order, { listing = null, revieweeProfile = null } = {}) => {
      if (!order?.id || !user?.id) return
      if (!canUserLeaveReview(order, reviewsLeft, user.id)) return

      setLeaveReviewError('')
      setLeaveReviewTarget({
        order,
        listing,
        revieweeProfile,
      })
    },
    [reviewsLeft, user?.id],
  )

  const handleCloseLeaveReview = useCallback(() => {
    if (leaveReviewSubmitting) return
    setLeaveReviewTarget(null)
    setLeaveReviewError('')
  }, [leaveReviewSubmitting])

  const refreshReviewsLeft = useCallback(async () => {
    if (!user?.id) return

    const { data, error: reviewerError } = await fetchReviewsByReviewer(user.id)

    if (!reviewerError) {
      setReviewsLeft(data ?? [])
    }
  }, [user?.id])

  const handleHubLeaveReviewSubmit = useCallback(
    async ({ rating, reviewText }) => {
      const order = leaveReviewTarget?.order

      if (!order?.id || leaveReviewSubmitting) return

      setLeaveReviewSubmitting(true)
      setLeaveReviewError('')

      const { error: submitError } = await submitReview({
        orderId: order.id,
        rating,
        reviewText,
      })

      if (submitError) {
        if (isDuplicateReviewError(submitError)) {
          await Promise.all([refreshReviewsLeft(), loadHubData({ refresh: true })])
          setLeaveReviewTarget(null)
          setLeaveReviewSubmitting(false)
          return
        }

        setLeaveReviewError(getReviewErrorMessage(submitError))
        setLeaveReviewSubmitting(false)
        return
      }

      await Promise.all([refreshReviewsLeft(), loadHubData({ refresh: true })])
      setLeaveReviewTarget(null)
      setLeaveReviewSubmitting(false)
    },
    [leaveReviewSubmitting, leaveReviewTarget?.order, loadHubData, refreshReviewsLeft],
  )

  const needsAttention = useMemo(
    () =>
      buildHubNeedsAttention({
        pendingOffersFromBuyers,
        acceptedUnpaidOffers,
        sellerAcceptedUnpaidOffers,
        buyerAwaitingFulfilmentOrders,
        activeSellerSales,
        showPayoutSetupBanner,
        pendingReviewCount,
      }),
    [
      pendingOffersFromBuyers,
      acceptedUnpaidOffers,
      sellerAcceptedUnpaidOffers,
      buyerAwaitingFulfilmentOrders,
      activeSellerSales,
      showPayoutSetupBanner,
      pendingReviewCount,
    ],
  )

  const hubCounts = useMemo(
    () =>
      buildHubCounts({
        myListings,
        pendingOffersMade: pendingBuyerOffersMade,
        pendingOffersFromBuyers,
        purchaseOrders: purchasesInProgressOrders,
        salesOrders: salesInProgressOrders,
        savedListingsCount: savedListings.length,
      }),
    [
      myListings,
      pendingBuyerOffersMade,
      pendingOffersFromBuyers,
      purchasesInProgressOrders,
      salesInProgressOrders,
      savedListings.length,
    ],
  )

  const attentionBadges = useMemo(
    () =>
      buildHubAttentionBadges({
        acceptedUnpaidOffers,
        pendingOffersFromBuyers,
        purchaseOrders: purchasesInProgressOrders,
        salesInProgressOrders,
        showPayoutSetupBanner,
        pendingReviewOrders,
      }),
    [
      acceptedUnpaidOffers,
      pendingOffersFromBuyers,
      purchasesInProgressOrders,
      salesInProgressOrders,
      showPayoutSetupBanner,
      pendingReviewOrders,
    ],
  )

  const sectionBadges = attentionBadges.sections
  const tabBadges = attentionBadges.tabs
  const ordersSubTabBadges = attentionBadges.ordersSubTabs

  const handlers = useMemo(
    () => ({
      onOfferUpdated: () => loadHubData({ refresh: true }),
      onCancelOffer: () => loadHubData({ refresh: true }),
      onConfirmOrder: () => loadHubData({ refresh: true }),
      onOpenLeaveReview: handleOpenLeaveReview,
      onPayStart: (paymentId) => {
        setPayingPaymentId(paymentId)
        setPayError('')
      },
      onPayComplete: () => setPayingPaymentId(null),
    }),
    [handleOpenLeaveReview, loadHubData],
  )

  function handleSectionChange(nextSection) {
    scrollHubToTop()

    if (nextSection === 'settings') {
      navigate('/settings')
      return
    }

    setSearchParams(
      buildHubSearchParams({
        section: nextSection,
        tab: undefined,
        preserve: searchParams,
      }),
      { replace: true },
    )
  }

  function handleBackToHub() {
    scrollHubToTop()

    setSearchParams(
      buildHubSearchParams({
        section: 'summary',
        tab: undefined,
        preserve: searchParams,
      }),
      { replace: true },
    )
  }

  function handleTabChange(nextTab) {
    scrollHubToTop()

    const ordersSubTab =
      section === 'orders' && (nextTab === 'purchases' || nextTab === 'sales')
        ? subTab || HUB_ORDERS_SUB_TABS.in_progress.id
        : undefined

    setSearchParams(
      buildHubSearchParams({
        section,
        tab: nextTab,
        subTab: ordersSubTab,
        preserve: searchParams,
      }),
      { replace: true },
    )
  }

  function handleOrdersSubTabChange(nextSubTab) {
    scrollHubToTop()

    setSearchParams(
      buildHubSearchParams({
        section,
        tab,
        subTab: nextSubTab,
        preserve: searchParams,
      }),
      { replace: true },
    )
  }

  function handleNavigate(nextSection, nextTab, offerId, subTab) {
    scrollHubToTop()

    const next = buildHubSearchParams({
      section: nextSection,
      tab: nextTab,
      subTab,
      preserve: searchParams,
    })

    if (offerId) {
      next.set('offerId', offerId)
    }

    if (nextSection === 'settings') {
      navigate('/settings')
      return
    }

    setSearchParams(next, { replace: true })
  }

  function renderSectionContent() {
    const shared = {
      highlightOfferId: highlightedOfferId,
      userId: user?.id,
      userReviews: reviewsLeft,
      handlers,
      payState: { payingPaymentId, payError },
      disputesByOrderId,
    }

    switch (section) {
      case 'buying':
        return (
          <HubBuyingSection
            tab={tab}
            onTabChange={handleTabChange}
            tabBadges={tabBadges.buying}
            pendingOffersMade={pendingBuyerOffersMade}
            acceptedUnpaidOffers={acceptedUnpaidOffers}
            buyerAwaitingFulfilmentOrders={buyerAwaitingFulfilmentOrders}
            buyerAwaitingConfirmOrders={buyerAwaitingConfirmOrders}
            buyerInProgressOrders={buyerInProgressOrders}
            completedBuyerOrders={completedBuyerOrders}
            cancelledOffersMade={cancelledOffersMade}
            buyerOffersLoadError={buyerOffersLoadError}
            {...shared}
          />
        )
      case 'selling':
        return (
          <HubSellingSection
            tab={tab}
            onTabChange={handleTabChange}
            tabBadges={tabBadges.selling}
            pendingOffersReceived={pendingOffersFromBuyers}
            sellerAcceptedUnpaidOffers={sellerAcceptedUnpaidOffers}
            activeSellerSales={activeSellerSales}
            completedSellerOrders={completedSalesOrders}
            soldListings={soldListings}
            cancelledOffersReceived={cancelledOffersReceived}
            sellerOffersLoadError={sellerOffersLoadError}
            listingsLoadError={listingsLoadError}
            {...shared}
          />
        )
      case 'listings':
        return (
          <HubListingsSection
            tab={tab}
            onTabChange={handleTabChange}
            tabBadges={tabBadges.listings}
            listingsByTab={listingsByTab}
            listingsLoadError={listingsLoadError}
          />
        )
      case 'offers':
        return (
          <HubOffersSection
            pendingOffersMade={pendingBuyerOffersMade}
            acceptedUnpaidOffers={acceptedUnpaidOffers}
            buyerOffersLoadError={buyerOffersLoadError}
            {...shared}
          />
        )
      case 'orders':
        return (
          <HubOrdersSection
            tab={tab}
            ordersSubTab={subTab}
            onTabChange={handleTabChange}
            onOrdersSubTabChange={handleOrdersSubTabChange}
            tabBadges={tabBadges.orders}
            purchaseSubTabBadges={ordersSubTabBadges?.purchases ?? {}}
            salesSubTabBadges={ordersSubTabBadges?.sales ?? {}}
            purchasesInProgressOrders={purchasesInProgressOrders}
            completedPurchasesOrders={completedBuyerOrders}
            salesOrders={salesInProgressOrders}
            completedSalesOrders={completedSalesOrders}
            buyerOffersLoadError={buyerOffersLoadError}
            sellerOffersLoadError={sellerOffersLoadError}
            payState={{ payingPaymentId, payError }}
            {...shared}
          />
        )
      case 'saved':
        return (
          <HubSavedSection
            savedListings={savedListings}
            savedLoading={savedLoading}
            savedError={savedError}
          />
        )
      case 'reviews':
        return (
          <HubReviewsSection
            tab={tab}
            onTabChange={handleTabChange}
            tabBadges={tabBadges.reviews}
            reviewsReceived={reviewsReceived}
            reviewsLeft={reviewsLeft}
            pendingReviewOrders={pendingReviewOrders}
            reviewsLoading={reviewsLoading}
            reviewsError={reviewsError}
            onOpenLeaveReview={handleOpenLeaveReview}
          />
        )
      case 'summary':
      default:
        return (
          <HubSummarySection
            counts={hubCounts}
            needsAttention={needsAttention}
            onNavigate={handleNavigate}
          />
        )
    }
  }

  if (loading) {
    return (
      <section className="hub-page hub-dashboard">
        <header className="hub-dashboard__header">
          <h2 className="hub-page__title">Hub</h2>
        </header>
        <LoadingState>Loading your buyer and seller activity…</LoadingState>
      </section>
    )
  }

  const sectionMeta = getHubSectionMeta(section)

  return (
    <HubLayout
      section={section}
      tab={tab}
      onSectionChange={handleSectionChange}
      onTabChange={handleTabChange}
      onBackToHub={handleBackToHub}
      sectionBadges={sectionBadges}
      title="Hub"
      lead="Your listings, offers, and orders in one place."
      sectionTitle={section !== 'summary' ? sectionMeta.label : undefined}
      sectionLead={section !== 'summary' ? getHubSectionLead(section) : undefined}
    >
      {paymentNotice ? (
        <p className="hub-page__message hub-page__message--success" role="status">
          {paymentNotice}
        </p>
      ) : null}

      {showPayoutSetupBanner ? (
        <p className="hub-page__message hub-page__message--notice" role="status">
          A buyer is waiting to pay on a reserved listing.{' '}
          <Link to="/settings">Complete payout setup</Link> so checkout can begin.
        </p>
      ) : null}

      {error ? <ErrorState>{error}</ErrorState> : null}

      {refreshing ? (
        <p className="hub-page__refreshing" role="status">
          Updating…
        </p>
      ) : null}

      {!error ? renderSectionContent() : null}

      <LeaveReviewModal
        open={Boolean(leaveReviewTarget?.order)}
        order={leaveReviewTarget?.order ?? null}
        userId={user?.id ?? null}
        listing={leaveReviewTarget?.listing ?? null}
        revieweeProfile={leaveReviewTarget?.revieweeProfile ?? null}
        submitting={leaveReviewSubmitting}
        error={leaveReviewError}
        onClose={handleCloseLeaveReview}
        onSubmit={handleHubLeaveReviewSubmit}
      />
    </HubLayout>
  )
}

export default HubPage
