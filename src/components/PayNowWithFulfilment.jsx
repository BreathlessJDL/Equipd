import { useState } from 'react'
import FulfilmentMethodSelector, {
  useFulfilmentMethodSelection,
} from './FulfilmentMethodSelector'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import { getCheckoutErrorMessage, startCheckoutForAcceptedOffer } from '../lib/checkout'
import { getFulfilmentMethodErrorMessage } from '../lib/fulfilmentMethods'
import { getOfferOrder } from '../lib/orders'
import './PayNowWithFulfilment.css'

function PayNowWithFulfilment({ offer, payment, payingPaymentId, onPayStart, onPayComplete }) {
  const listing = offer?.listing
  const order = getOfferOrder(offer)
  const profileLocation = useProfileBrowseLocation()
  const buyerProfile = {
    latitude: profileLocation.latitude,
    longitude: profileLocation.longitude,
  }
  const { options, selectedOrderType, setSelectedOrderType, isReady } =
    useFulfilmentMethodSelection(listing, order, { buyerProfile })
  const [error, setError] = useState('')
  const [attemptedPay, setAttemptedPay] = useState(false)
  const isPaying = payingPaymentId === payment?.id
  const showSelector = !order?.order_type && options.length > 1

  async function handlePayNow() {
    if (!payment?.id || isPaying) return

    setAttemptedPay(true)

    if (showSelector && !selectedOrderType) {
      setError('Select how you will receive this item before paying.')
      return
    }

    setError('')
    onPayStart?.(payment.id)

    const { url, error: checkoutError } = await startCheckoutForAcceptedOffer({
      payment,
      listing,
      offer,
      selectedOrderType: showSelector ? selectedOrderType : null,
      buyerProfile,
    })

    if (checkoutError) {
      setError(getFulfilmentMethodErrorMessage(checkoutError) || getCheckoutErrorMessage(checkoutError))
      onPayComplete?.()
      return
    }

    if (!url) {
      setError('Could not start checkout.')
      onPayComplete?.()
      return
    }

    globalThis.location.assign(url)
  }

  return (
    <div className="pay-now-with-fulfilment">
      {showSelector ? (
        <FulfilmentMethodSelector
          options={options}
          selectedOrderType={selectedOrderType}
          name={`fulfilment-method-${payment?.id ?? offer?.id ?? 'offer'}`}
          onSelect={(orderType) => {
            setSelectedOrderType(orderType)
            if (orderType) {
              setError('')
            }
          }}
          disabled={isPaying}
          compact
        />
      ) : null}

      {error && attemptedPay ? (
        <p className="pay-now-with-fulfilment__error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="hub-offer-list__pay-button"
        disabled={isPaying || (showSelector && !isReady)}
        onClick={handlePayNow}
      >
        {isPaying ? 'Redirecting…' : 'Pay now'}
      </button>
    </div>
  )
}

export default PayNowWithFulfilment
