import { useEffect, useMemo, useState } from 'react'
import { LoadingState } from '../ui/UiState'
import {
  canBuyerEditDeliveryDetails,
  fetchListingFulfilmentPrivateForOrder,
  fetchOrderDeliveryDetails,
  formatFulfilmentDetailsTimestamp,
  getOrderDeliveryDetailsErrorMessage,
  getOrderFulfilmentDetailsCardTitle,
  hasBuyerSubmittedDeliveryDetails,
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

function SellerDeliverySavedDetails({ details, showPrivacy = false }) {
  return (
    <>
      {showPrivacy ? (
        <p className="order-fulfilment-details__privacy">
          Share the address and contact details the seller should use to arrange delivery. These
          details are only shared with the seller for this order.
        </p>
      ) : null}
      {details?.updatedAt ? (
        <p className="order-fulfilment-details__updated" role="status">
          Last updated {formatFulfilmentDetailsTimestamp(details.updatedAt)}
        </p>
      ) : null}
      <dl className="order-fulfilment-details__fields">
        <ReadOnlyField label="Delivery address" value={details?.buyerDeliveryAddress} />
        <ReadOnlyField label="Contact name" value={details?.deliveryContactName} />
        <ReadOnlyField label="Contact phone number" value={details?.deliveryContactPhone} />
        {details?.deliveryNotes?.trim() ? (
          <ReadOnlyField
            label="Delivery notes / access instructions"
            value={details.deliveryNotes}
          />
        ) : null}
      </dl>
    </>
  )
}

function SellerDeliveryBuyerForm({
  formValues,
  saving,
  saveError,
  saveSuccess,
  showActionRequired,
  onSubmit,
  onFieldChange,
}) {
  const canSave =
    formValues.address.trim()
    && formValues.contactName.trim()
    && formValues.contactPhone.trim()

  return (
    <>
      {showActionRequired ? (
        <p className="order-fulfilment-details__action-required" role="status">
          Action required: add your delivery details so the seller can arrange delivery.
        </p>
      ) : null}
      <p className="order-fulfilment-details__privacy">
        Share the address and contact details the seller should use to arrange delivery. These
        details are only shared with the seller for this order.
      </p>

      <form className="order-fulfilment-details__form" onSubmit={onSubmit} noValidate>
        <div className="order-fulfilment-details__field order-fulfilment-details__field--editable">
          <label className="order-fulfilment-details__label" htmlFor="order-delivery-address">
            Delivery address
          </label>
          <textarea
            id="order-delivery-address"
            className="order-fulfilment-details__input"
            value={formValues.address}
            onChange={(event) => onFieldChange('address', event.target.value)}
            disabled={saving}
            rows={4}
            placeholder="Full delivery address"
            required
          />
        </div>

        <div className="order-fulfilment-details__field order-fulfilment-details__field--editable">
          <label className="order-fulfilment-details__label" htmlFor="order-delivery-contact-name">
            Contact name
          </label>
          <input
            id="order-delivery-contact-name"
            type="text"
            className="order-fulfilment-details__input order-fulfilment-details__input--single"
            value={formValues.contactName}
            onChange={(event) => onFieldChange('contactName', event.target.value)}
            disabled={saving}
            placeholder="Name for delivery coordination"
            autoComplete="name"
            required
          />
        </div>

        <div className="order-fulfilment-details__field order-fulfilment-details__field--editable">
          <label className="order-fulfilment-details__label" htmlFor="order-delivery-contact-phone">
            Contact phone number
          </label>
          <input
            id="order-delivery-contact-phone"
            type="tel"
            className="order-fulfilment-details__input order-fulfilment-details__input--single"
            value={formValues.contactPhone}
            onChange={(event) => onFieldChange('contactPhone', event.target.value)}
            disabled={saving}
            placeholder="Phone number for delivery coordination"
            autoComplete="tel"
            required
          />
        </div>

        <div className="order-fulfilment-details__field order-fulfilment-details__field--editable">
          <label className="order-fulfilment-details__label" htmlFor="order-delivery-notes">
            Delivery notes / access instructions (optional)
          </label>
          <textarea
            id="order-delivery-notes"
            className="order-fulfilment-details__input"
            value={formValues.notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            disabled={saving}
            rows={3}
            placeholder="Parking, gate codes, unloading access, or other delivery notes"
          />
        </div>

        <footer className="order-fulfilment-details__footer">
          <button
            type="submit"
            className="order-fulfilment-details__save"
            disabled={saving || !canSave}
          >
            {saving ? 'Saving…' : 'Save delivery details'}
          </button>
          {saveSuccess ? (
            <p className="order-fulfilment-details__success" role="status">
              Delivery details saved
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
  const submitted = hasBuyerSubmittedDeliveryDetails(details)

  if (!submitted) {
    return (
      <p className="order-fulfilment-details__waiting" role="status">
        Waiting for buyer to provide delivery details.
      </p>
    )
  }

  return (
    <>
      {readOnly ? (
        <p className="order-fulfilment-details__admin-note" role="status">
          Admin view only. Delivery details cannot be edited here.
        </p>
      ) : null}
      {viewerRole === 'seller' ? (
        <p className="order-fulfilment-details__seller-prompt" role="status">
          Arrange delivery with the buyer, then show your handover QR code when delivering.
        </p>
      ) : null}
      <SellerDeliverySavedDetails details={details} />
    </>
  )
}

function createDeliveryFormState(details) {
  return {
    address: details?.buyerDeliveryAddress ?? '',
    contactName: details?.deliveryContactName ?? '',
    contactPhone: details?.deliveryContactPhone ?? '',
    notes: details?.deliveryNotes ?? '',
  }
}

function OrderFulfilmentDetailsCard({
  order,
  orderId,
  listingId,
  orderType,
  viewerRole,
  readOnly = false,
  onDetailsLoaded,
}) {
  const [collectionDetails, setCollectionDetails] = useState(null)
  const [deliveryDetails, setDeliveryDetails] = useState(null)
  const [formValues, setFormValues] = useState(() => createDeliveryFormState(null))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const isCollectionType = isCollectionFulfilmentOrderType(orderType)
  const isSellerDelivery = isSellerDeliveryFulfilmentOrderType(orderType)
  const cardTitle = useMemo(() => getOrderFulfilmentDetailsCardTitle(orderType), [orderType])
  const isBuyer = viewerRole === 'buyer'
  const buyerCanEdit = isBuyer && !readOnly && canBuyerEditDeliveryDetails(order)
  const buyerHasSubmitted = hasBuyerSubmittedDeliveryDetails(deliveryDetails)

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
          setFormValues(createDeliveryFormState(null))
          setLoading(false)
          return
        }

        setDeliveryDetails(data)
        setFormValues(createDeliveryFormState(data))
        onDetailsLoaded?.(data)
        setLoading(false)
        return
      }

      setLoading(false)
    }

    loadDetails()

    return () => {
      active = false
    }
  }, [isCollectionType, isSellerDelivery, listingId, onDetailsLoaded, orderId])

  useEffect(() => {
    if (!saveSuccess) return undefined

    const timeoutId = window.setTimeout(() => setSaveSuccess(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [saveSuccess])

  function handleFieldChange(field, value) {
    setFormValues((current) => ({ ...current, [field]: value }))
    setSaveError('')
    setSaveSuccess(false)
  }

  async function handleSaveDeliveryDetails(event) {
    event.preventDefault()

    if (!orderId || !buyerCanEdit || saving) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const { data, error } = await updateOrderDeliveryDetails(orderId, {
      buyerDeliveryAddress: formValues.address,
      deliveryContactName: formValues.contactName,
      deliveryContactPhone: formValues.contactPhone,
      deliveryNotes: formValues.notes,
    })

    setSaving(false)

    if (error) {
      setSaveError(getOrderDeliveryDetailsErrorMessage(error))
      return
    }

    setDeliveryDetails(data)
    setFormValues(createDeliveryFormState(data))
    onDetailsLoaded?.(data)
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

      {isSellerDelivery && buyerCanEdit ? (
        <SellerDeliveryBuyerForm
          formValues={formValues}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          showActionRequired={!buyerHasSubmitted}
          onSubmit={handleSaveDeliveryDetails}
          onFieldChange={handleFieldChange}
        />
      ) : null}

      {isSellerDelivery && isBuyer && !buyerCanEdit && buyerHasSubmitted ? (
        <SellerDeliverySavedDetails details={deliveryDetails} showPrivacy />
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
