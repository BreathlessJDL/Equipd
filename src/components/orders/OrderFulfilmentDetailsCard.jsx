import { useEffect, useMemo, useState } from 'react'
import { LoadingState } from '../ui/UiState'
import {
  fetchListingFulfilmentPrivateForOrder,
  fetchOrderDeliveryDetails,
  formatFulfilmentDetailsTimestamp,
  getOrderDeliveryDetailsErrorMessage,
  getOrderFulfilmentDetailsCardTitle,
  isCollectionFulfilmentOrderType,
  isSellerDeliveryFulfilmentOrderType,
  updateOrderDeliveryDetails,
} from '../../lib/orderDeliveryDetails'
import './OrderFulfilmentDetailsCard.css'

function ReadOnlyValue({ value, emptyLabel = 'Not provided yet' }) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return <span className="order-fulfilment-details__empty">{emptyLabel}</span>
  }

  return <span className="order-fulfilment-details__value">{trimmed}</span>
}

function ReadOnlyField({ label, value, emptyLabel }) {
  return (
    <div className="order-fulfilment-details__field order-fulfilment-details__field--readonly">
      <dt className="order-fulfilment-details__label">{label}</dt>
      <dd className="order-fulfilment-details__readonly-value">
        <ReadOnlyValue value={value} emptyLabel={emptyLabel} />
      </dd>
    </div>
  )
}

function CollectionFulfilmentDetails({ details, updatedAt }) {
  return (
    <>
      <p className="order-fulfilment-details__privacy">
        These details are only shared after payment.
      </p>
      {updatedAt ? (
        <p className="order-fulfilment-details__updated" role="status">
          Last updated {formatFulfilmentDetailsTimestamp(updatedAt)}
        </p>
      ) : null}
      <dl className="order-fulfilment-details__fields">
        <ReadOnlyField label="Collection address" value={details?.collectionAddress} />
        <ReadOnlyField label="Seller contact number" value={details?.collectionPhone} />
        {details?.collectionInstructions?.trim() ? (
          <ReadOnlyField
            label="Collection instructions"
            value={details.collectionInstructions}
          />
        ) : null}
      </dl>
    </>
  )
}

function SellerDeliveryBuyerForm({
  updatedAt,
  saving,
  saveError,
  saveSuccess,
  onSubmit,
  onAddressChange,
  addressValue,
}) {
  return (
    <>
      <p className="order-fulfilment-details__privacy">
        Only the seller and Equipd support can see this.
      </p>
      {updatedAt ? (
        <p className="order-fulfilment-details__updated" role="status">
          Last updated {formatFulfilmentDetailsTimestamp(updatedAt)}
        </p>
      ) : null}

      <form className="order-fulfilment-details__form" onSubmit={onSubmit} noValidate>
        <div className="order-fulfilment-details__field order-fulfilment-details__field--editable">
          <label className="order-fulfilment-details__label" htmlFor="order-delivery-address">
            Delivery address
          </label>
          <textarea
            id="order-delivery-address"
            className="order-fulfilment-details__input"
            value={addressValue}
            onChange={(event) => onAddressChange(event.target.value)}
            disabled={saving}
            rows={4}
            placeholder="Full delivery address"
          />
        </div>

        <footer className="order-fulfilment-details__footer">
          <button
            type="submit"
            className="order-fulfilment-details__save"
            disabled={saving || !addressValue.trim()}
          >
            {saving ? 'Saving…' : 'Save delivery address'}
          </button>
          {saveSuccess ? (
            <p className="order-fulfilment-details__success" role="status">
              Saved
            </p>
          ) : null}
          {saveError ? (
            <p className="order-fulfilment-details__error" role="alert">
              {saveError}
            </p>
          ) : null}
        </footer>
      </form>
    </>
  )
}

function SellerDeliveryParticipantView({ details, viewerRole, readOnly }) {
  const address = details?.buyerDeliveryAddress

  if (!address?.trim()) {
    return (
      <p className="order-fulfilment-details__waiting" role="status">
        {viewerRole === 'seller' || readOnly
          ? 'Waiting for buyer to provide delivery address.'
          : 'Add your delivery address so the seller can arrange delivery.'}
      </p>
    )
  }

  return (
    <>
      {readOnly ? (
        <p className="order-fulfilment-details__privacy">
          Only the seller and Equipd support can see this.
        </p>
      ) : null}
      {readOnly ? (
        <p className="order-fulfilment-details__admin-note" role="status">
          Admin view only. Delivery details cannot be edited here.
        </p>
      ) : null}
      <dl className="order-fulfilment-details__fields">
        <ReadOnlyField label="Delivery address" value={address} />
      </dl>
      {details?.updatedAt ? (
        <p className="order-fulfilment-details__updated" role="status">
          Last updated {formatFulfilmentDetailsTimestamp(details.updatedAt)}
        </p>
      ) : null}
    </>
  )
}

function OrderFulfilmentDetailsCard({
  orderId,
  listingId,
  orderType,
  viewerRole,
  readOnly = false,
}) {
  const [collectionDetails, setCollectionDetails] = useState(null)
  const [deliveryDetails, setDeliveryDetails] = useState(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const isCollectionType = isCollectionFulfilmentOrderType(orderType)
  const isSellerDelivery = isSellerDeliveryFulfilmentOrderType(orderType)
  const cardTitle = useMemo(() => getOrderFulfilmentDetailsCardTitle(orderType), [orderType])
  const isBuyer = viewerRole === 'buyer'

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return undefined
    }

    let active = true

    async function loadDetails() {
      setLoading(true)
      setLoadError('')

      if (isCollectionType) {
        const { data, error } = await fetchListingFulfilmentPrivateForOrder(orderId, listingId)

        if (!active) return

        if (error) {
          setLoadError(getOrderDeliveryDetailsErrorMessage(error))
          setCollectionDetails(null)
          setLoading(false)
          return
        }

        setCollectionDetails(data)
        setLoading(false)
        return
      }

      if (isSellerDelivery) {
        const { data, error } = await fetchOrderDeliveryDetails(orderId)

        if (!active) return

        if (error) {
          setLoadError(getOrderDeliveryDetailsErrorMessage(error))
          setDeliveryDetails(null)
          setDeliveryAddress('')
          setLoading(false)
          return
        }

        setDeliveryDetails(data)
        setDeliveryAddress(data?.buyerDeliveryAddress ?? '')
        setLoading(false)
        return
      }

      setLoading(false)
    }

    loadDetails()

    return () => {
      active = false
    }
  }, [isCollectionType, isSellerDelivery, listingId, orderId])

  useEffect(() => {
    if (!saveSuccess) return undefined

    const timeoutId = window.setTimeout(() => setSaveSuccess(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [saveSuccess])

  async function handleSaveDeliveryAddress(event) {
    event.preventDefault()

    if (!orderId || readOnly || saving || !isBuyer) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const { data, error } = await updateOrderDeliveryDetails(orderId, {
      buyerDeliveryAddress: deliveryAddress,
    })

    setSaving(false)

    if (error) {
      setSaveError(getOrderDeliveryDetailsErrorMessage(error))
      return
    }

    setDeliveryDetails(data)
    setDeliveryAddress(data?.buyerDeliveryAddress ?? '')
    setSaveSuccess(true)
  }

  if (!orderId || !viewerRole) {
    return null
  }

  if (loading) {
    return (
      <section className="order-detail__card order-fulfilment-details-card" aria-busy="true">
        <h2 className="order-detail__card-title">{cardTitle}</h2>
        <LoadingState compact>Loading fulfilment details…</LoadingState>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="order-detail__card order-fulfilment-details-card">
        <h2 className="order-detail__card-title">{cardTitle}</h2>
        <p className="order-fulfilment-details__error" role="alert">
          {loadError}
        </p>
      </section>
    )
  }

  return (
    <section className="order-detail__card order-fulfilment-details-card">
      <header className="order-fulfilment-details__header">
        <h2 className="order-detail__card-title">{cardTitle}</h2>
      </header>

      {isCollectionType ? (
        <CollectionFulfilmentDetails
          details={collectionDetails}
          updatedAt={collectionDetails?.updatedAt}
        />
      ) : null}

      {isSellerDelivery && isBuyer && !readOnly ? (
        <SellerDeliveryBuyerForm
          updatedAt={deliveryDetails?.updatedAt}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          onSubmit={handleSaveDeliveryAddress}
          onAddressChange={(value) => {
            setDeliveryAddress(value)
            setSaveError('')
            setSaveSuccess(false)
          }}
          addressValue={deliveryAddress}
        />
      ) : null}

      {isSellerDelivery && (viewerRole === 'seller' || readOnly) ? (
        <SellerDeliveryParticipantView
          details={deliveryDetails}
          viewerRole={viewerRole}
          readOnly={readOnly}
        />
      ) : null}
    </section>
  )
}

export default OrderFulfilmentDetailsCard
