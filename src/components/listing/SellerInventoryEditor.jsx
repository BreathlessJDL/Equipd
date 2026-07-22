import { useState } from 'react'
import {
  canSubmitListingQuantityUpdate,
  getListingQuantityMinimumNote,
  getListingQuantityMinimumTotal,
  parseListingQuantity,
} from '../../lib/listingQuantity'
import {
  getListingErrorMessage,
  updateListingQuantity,
} from '../../lib/listings'

function SellerInventoryEditor({ listing, onListingChange }) {
  const [newTotal, setNewTotal] = useState(String(listing.quantity_total ?? 1))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const minimumTotal = getListingQuantityMinimumTotal(listing)
  const minimumNote = getListingQuantityMinimumNote(listing)
  const canSubmit = canSubmitListingQuantityUpdate({ newTotal, listing })

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit || saving) return

    setError('')
    setSuccess('')

    const quantity = parseListingQuantity(newTotal)
    if (quantity == null) {
      setError('Quantity must be a whole number between 1 and 999.')
      return
    }

    if (quantity < minimumTotal) {
      setError(
        minimumNote ??
          `Quantity cannot be reduced below ${minimumTotal}.`,
      )
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
    setNewTotal(String(data.quantity_total ?? quantity))
    setSuccess('Quantity updated.')
  }

  return (
    <section
      className="listing-form__section listing-form__section--quantity"
      aria-labelledby="listing-quantity-title"
    >
      <h2 id="listing-quantity-title" className="listing-form__section-title">
        Quantity
      </h2>
      <div className="listing-form__card listing-form__quantity-card">
        <form className="listing-form__quantity-editor" onSubmit={handleSubmit}>
          <div className="listing-form__quantity-field">
            <label
              className="listing-form__quantity-label"
              htmlFor="edit-listing-quantity-total"
            >
              Quantity available for this listing
            </label>
            <input
              id="edit-listing-quantity-total"
              className="listing-form__input listing-form__input--boxed listing-form__quantity-input"
              type="number"
              min={minimumTotal}
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
              aria-describedby={
                minimumNote ? 'edit-listing-quantity-minimum-note' : undefined
              }
            />
            {minimumNote ? (
              <p
                id="edit-listing-quantity-minimum-note"
                className="listing-form__hint listing-form__quantity-hint"
              >
                {minimumNote}
              </p>
            ) : null}
            <button
              type="submit"
              className="listing-form__button listing-form__button--secondary listing-form__quantity-editor-button"
              disabled={saving || !canSubmit}
            >
              {saving ? 'Updating…' : 'Update quantity'}
            </button>
          </div>

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
        </form>
      </div>
    </section>
  )
}

export default SellerInventoryEditor
