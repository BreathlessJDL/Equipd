import ListingImageUpload from './ListingImageUpload'
import { LISTING_CONDITIONS } from '../lib/constants'
import './ListingForm.css'

export const emptyListingForm = {
  title: '',
  brand: '',
  model: '',
  categoryId: '',
  price: '',
  condition: '',
  location: '',
  description: '',
  collectionAvailable: true,
  courierAvailable: false,
  deliveryNotes: '',
}

function ListingForm({
  form,
  categories,
  idPrefix = 'listing',
  showDraftHints = false,
  existingImages = [],
  pendingFiles = [],
  uploadingImages = false,
  imageError = '',
  imageUploadDisabled = false,
  onFieldChange,
  onAddPendingFiles,
  onRemovePendingFile,
  onRemoveExistingImage,
  formError = '',
  formSuccess = '',
  onSubmit,
  children,
}) {
  function fieldId(name) {
    return `${idPrefix}-${name}`
  }

  return (
    <form className="listing-form" onSubmit={onSubmit}>
      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('title')}>
          Title
        </label>
        <input
          id={fieldId('title')}
          className="listing-form__input"
          type="text"
          maxLength={120}
          value={form.title}
          onChange={(event) => onFieldChange('title', event.target.value)}
        />
        {showDraftHints ? (
          <p className="listing-form__hint">Required to publish. Drafts use “Draft listing” if left blank.</p>
        ) : null}
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('brand')}>
          Brand
        </label>
        <input
          id={fieldId('brand')}
          className="listing-form__input"
          type="text"
          value={form.brand}
          onChange={(event) => onFieldChange('brand', event.target.value)}
        />
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('model')}>
          Model
        </label>
        <input
          id={fieldId('model')}
          className="listing-form__input"
          type="text"
          value={form.model}
          onChange={(event) => onFieldChange('model', event.target.value)}
        />
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('category')}>
          Category
        </label>
        <select
          id={fieldId('category')}
          className="listing-form__select"
          value={form.categoryId}
          onChange={(event) => onFieldChange('categoryId', event.target.value)}
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {showDraftHints ? (
          <p className="listing-form__hint">Required to save any listing.</p>
        ) : null}
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('price')}>
          Price (GBP)
        </label>
        <input
          id={fieldId('price')}
          className="listing-form__input"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          placeholder={showDraftHints ? '199.00' : undefined}
          value={form.price}
          onChange={(event) => onFieldChange('price', event.target.value)}
        />
        {showDraftHints ? (
          <p className="listing-form__hint">Required to publish. Drafts default to £1.00 if left blank.</p>
        ) : null}
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('condition')}>
          Condition
        </label>
        <select
          id={fieldId('condition')}
          className="listing-form__select"
          value={form.condition}
          onChange={(event) => onFieldChange('condition', event.target.value)}
        >
          <option value="">Select condition</option>
          {LISTING_CONDITIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {showDraftHints ? (
          <p className="listing-form__hint">Required to publish. Drafts default to Good if left blank.</p>
        ) : null}
      </div>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('location')}>
          Location
        </label>
        <input
          id={fieldId('location')}
          className="listing-form__input"
          type="text"
          placeholder="e.g. Manchester, UK"
          value={form.location}
          onChange={(event) => onFieldChange('location', event.target.value)}
        />
        {showDraftHints ? <p className="listing-form__hint">Required to publish.</p> : null}
      </div>

      <fieldset className="listing-form__fieldset">
        <legend className="listing-form__label">Collection and delivery</legend>

        <label className="listing-form__checkbox">
          <input
            type="checkbox"
            checked={form.collectionAvailable}
            onChange={(event) => onFieldChange('collectionAvailable', event.target.checked)}
          />
          <span>Collection available</span>
        </label>

        <label className="listing-form__checkbox">
          <input
            type="checkbox"
            checked={form.courierAvailable}
            onChange={(event) => onFieldChange('courierAvailable', event.target.checked)}
          />
          <span>Courier / delivery possible</span>
        </label>

        <div className="listing-form__field">
          <label className="listing-form__label" htmlFor={fieldId('delivery-notes')}>
            Delivery notes
          </label>
          <textarea
            id={fieldId('delivery-notes')}
            className="listing-form__textarea listing-form__textarea--compact"
            placeholder="e.g. Buyer collects from garage, or can arrange courier at buyer's cost"
            value={form.deliveryNotes}
            onChange={(event) => onFieldChange('deliveryNotes', event.target.value)}
          />
        </div>
      </fieldset>

      <div className="listing-form__field">
        <label className="listing-form__label" htmlFor={fieldId('description')}>
          Description
        </label>
        <textarea
          id={fieldId('description')}
          className="listing-form__textarea"
          value={form.description}
          onChange={(event) => onFieldChange('description', event.target.value)}
        />
      </div>

      <ListingImageUpload
        existingImages={existingImages}
        pendingFiles={pendingFiles}
        uploading={uploadingImages}
        uploadError={imageError}
        disabled={imageUploadDisabled}
        onAddPendingFiles={onAddPendingFiles}
        onRemovePendingFile={onRemovePendingFile}
        onRemoveExistingImage={onRemoveExistingImage}
      />

      {formError ? (
        <p className="listing-form__message listing-form__message--error" role="alert">
          {formError}
        </p>
      ) : null}

      {formSuccess ? (
        <p className="listing-form__message listing-form__message--success" role="status">
          {formSuccess}
        </p>
      ) : null}

      {children}
    </form>
  )
}

export default ListingForm
