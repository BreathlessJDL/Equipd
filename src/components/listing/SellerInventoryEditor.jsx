import { useState } from 'react'
import {
  getListingErrorMessage,
  parseListingQuantity,
  updateListingQuantity,
} from '../../lib/listings'

function InventoryMetric({ label, value }) {
  return (
    <div className="listing-inventory__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function SellerInventoryEditor({ listing, onListingChange }) {
  const [newTotal, setNewTotal] = useState(String(listing.quantity_total ?? 1))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const minimumTotal = (listing.quantity_reserved ?? 0) + (listing.quantity_sold ?? 0)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const quantity = parseListingQuantity(newTotal)
    if (quantity == null) {
      setError('Quantity must be a whole number between 1 and 999.')
      return
    }

    if (quantity < minimumTotal) {
      setError(`Total quantity cannot be below reserved + sold (${minimumTotal}).`)
      return
    }

    if (quantity === listing.quantity_total) {
      setSuccess('Inventory is already up to date.')
      return
    }

    setSaving(true)
    const { data, error: updateError } = await updateListingQuantity(
      listing.id,
      quantity,
      listing.inventory_version,
    )
    setSaving(false)

    if (updateError) {
      setError(getListingErrorMessage(updateError))
      return
    }

    onListingChange(data)
    setSuccess('Inventory updated.')
  }

  return (
    <section className="listing-form__section" aria-labelledby="listing-inventory-title">
      <h2 id="listing-inventory-title" className="listing-form__section-title">
        Inventory
      </h2>
      <div className="listing-form__card listing-inventory">
        <dl className="listing-inventory__summary">
          <InventoryMetric label="Total" value={listing.quantity_total ?? 1} />
          <InventoryMetric label="Available" value={listing.quantity_available ?? 1} />
          <InventoryMetric label="Reserved" value={listing.quantity_reserved ?? 0} />
          <InventoryMetric label="Sold" value={listing.quantity_sold ?? 0} />
        </dl>

        <form className="listing-inventory__form" onSubmit={handleSubmit}>
          <label className="listing-form__row-label" htmlFor="edit-listing-quantity-total">
            Total quantity
          </label>
          <input
            id="edit-listing-quantity-total"
            className="listing-form__input listing-form__input--underline"
            type="number"
            min={Math.max(1, minimumTotal)}
            max="999"
            step="1"
            inputMode="numeric"
            value={newTotal}
            disabled={saving}
            onChange={(event) => {
              setNewTotal(event.target.value)
              setError('')
              setSuccess('')
            }}
            aria-describedby="edit-listing-quantity-hint"
          />
          <p id="edit-listing-quantity-hint" className="listing-form__hint listing-form__hint--inline">
            Reserved and sold items cannot be removed. Current minimum: {Math.max(1, minimumTotal)}.
          </p>
          <button
            type="submit"
            className="listing-form__button listing-form__button--secondary"
            disabled={saving}
          >
            {saving ? 'Updating…' : 'Update quantity'}
          </button>
        </form>

        {error ? (
          <p className="listing-form__message listing-form__message--error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="listing-form__message listing-form__message--success" role="status">
            {success}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default SellerInventoryEditor
