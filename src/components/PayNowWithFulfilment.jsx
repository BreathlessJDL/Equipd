import { useState } from 'react'
import FulfilmentChoiceModal from './FulfilmentChoiceModal'
import FulfilmentMethodSelector, {
  useFulfilmentMethodSelection,
} from './FulfilmentMethodSelector'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import { getCheckoutErrorMessage, startCheckoutForAcceptedOffer } from '../lib/checkout'
import { getFulfilmentMethodErrorMessage } from '../lib/fulfilmentMethods'
import { getOfferOrder } from '../lib/orders'
import './PayNowWithFulfilment.css'

function PayNowWithFulfilment({
  offer,
  payment,
  payingPaymentId,
  onPayStart,
  onPayComplete,
  fulfilmentInModal = false,
}) {
  const listing = offer?.listing
  const order = getOfferOrder(offer)
  const profileLocation = useProfileBrowseLocation()
  const buyerProfile = {
    latitude: profileLocation.latitude,
    longitude: profileLocation.longitude,
  }
  const { options, selectedOrderType, setSelectedOrderType } = useFulfilmentMethodSelection(
    listing,
    order,
    { buyerProfile },
  )
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [attemptedPay, setAttemptedPay] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const isPaying = payingPaymentId === payment?.id
  const needsFulfilmentSelection = !order?.order_type && options.length > 1
  const showInlineSelector = !fulfilmentInModal && needsFulfilmentSelection
  const fulfilmentFieldName = `fulfilment-method-${payment?.id ?? offer?.id ?? 'offer'}`

  async function proceedToCheckout(orderTypeForCheckout) {
    if (!payment?.id || isPaying) return

    setError('')
    setModalError('')
    onPayStart?.(payment.id)

    const { url, error: checkoutError } = await startCheckoutForAcceptedOffer({
      payment,
      listing,
      offer,
      selectedOrderType: needsFulfilmentSelection ? orderTypeForCheckout : null,
      buyerProfile,
    })

    if (checkoutError) {
      const message =
        getFulfilmentMethodErrorMessage(checkoutError) ||
        getCheckoutErrorMessage(checkoutError)
      if (modalOpen) {
        setModalError(message)
      } else {
        setError(message)
      }
      onPayComplete?.()
      return
    }

    if (!url) {
      const message = 'Could not start checkout.'
      if (modalOpen) {
        setModalError(message)
      } else {
        setError(message)
      }
      onPayComplete?.()
      return
    }

    globalThis.location.assign(url)
  }

  async function handlePayNow() {
    if (!payment?.id || isPaying) return

    setAttemptedPay(true)

    if (fulfilmentInModal && needsFulfilmentSelection) {
      setModalError('')
      setModalOpen(true)
      return
    }

    if (showInlineSelector && !selectedOrderType) {
      setError('Select how you will receive this item before paying.')
      return
    }

    await proceedToCheckout(selectedOrderType)
  }

  async function handleModalContinue() {
    if (!selectedOrderType) {
      setModalError('Select how you will receive this item before paying.')
      return
    }

    await proceedToCheckout(selectedOrderType)
  }

  function handleModalClose() {
    if (isPaying) return
    setModalOpen(false)
    setModalError('')
  }

  return (
    <>
      <div className="pay-now-with-fulfilment">
        {showInlineSelector ? (
          <FulfilmentMethodSelector
            options={options}
            selectedOrderType={selectedOrderType}
            name={fulfilmentFieldName}
            disabled={isPaying}
            compact
            onSelect={(orderType) => {
              setSelectedOrderType(orderType)
              if (orderType) {
                setError('')
              }
            }}
          />
        ) : null}

        {error && attemptedPay && !modalOpen ? (
          <p className="pay-now-with-fulfilment__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="hub-offer-list__pay-button"
          disabled={isPaying || (showInlineSelector && !selectedOrderType)}
          onClick={handlePayNow}
        >
          {isPaying ? 'Redirecting…' : 'Pay now'}
        </button>
      </div>

      {fulfilmentInModal ? (
        <FulfilmentChoiceModal
          open={modalOpen}
          options={options}
          selectedOrderType={selectedOrderType}
          name={fulfilmentFieldName}
          submitting={isPaying}
          error={modalError}
          onSelect={(orderType) => {
            setSelectedOrderType(orderType)
            if (orderType) {
              setModalError('')
            }
          }}
          onClose={handleModalClose}
          onContinue={handleModalContinue}
        />
      ) : null}
    </>
  )
}

export default PayNowWithFulfilment
