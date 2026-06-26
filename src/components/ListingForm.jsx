import ListingImageUpload from './ListingImageUpload'
import CollectionAddressAutocomplete from './listing/CollectionAddressAutocomplete'
import ListingLocationAutocomplete from './listing/ListingLocationAutocomplete'
import { LISTING_CONDITIONS } from '../lib/constants'
import {
  buildBrandSelectOptions,
  buildCategorySelectOptions,
  LISTING_RATING_OPTIONS,
} from '../lib/listingOptions'
import './ListingForm.css'

export const emptyListingForm = {
  title: '',
  description: '',
  categoryId: '',
  brand: '',
  condition: '',
  rating: '',
  model: '',
  colour: '',
  length: '',
  width: '',
  height: '',
  locationSearch: '',
  locationPlace: null,
  deliveryOptions: [],
  deliveryRangeMiles: '',
  collectionAddress: '',
  collectionPhone: '',
  collectionInstructions: '',
  price: '',
  collectionAvailable: true,
  courierAvailable: false,
  deliveryNotes: '',
}

const DELIVERY_OPTIONS = [
  {
    value: 'collection',
    label: 'Collection available',
    description: 'Buyer collects the item from you.',
  },
  {
    value: 'seller_delivery',
    label: 'Seller can personally deliver',
    description: 'You can deliver the item within your local area.',
  },
  {
    value: 'buyer_courier',
    label: 'Buyer can arrange courier / collection service',
    description: 'You are happy for the buyer to arrange their own courier or collection service.',
  },
]

function ListingFormRow({
  label,
  htmlFor,
  optional = false,
  children,
  className = '',
}) {
  return (
    <div className={`listing-form__row${className ? ` ${className}` : ''}`}>
      <label className="listing-form__row-label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="listing-form__optional">Optional</span> : null}
      </label>
      <div className="listing-form__row-control">{children}</div>
    </div>
  )
}

function ListingFormSection({ title, children }) {
  return (
    <section className="listing-form__section">
      <h2 className="listing-form__section-title">{title}</h2>
      <div className="listing-form__card">{children}</div>
    </section>
  )
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
  onReorderPendingFiles,
  onRemoveExistingImage,
  onReorderExistingImages,
  formError = '',
  formSuccess = '',
  onSubmit,
  children,
}) {
  function fieldId(name) {
    return `${idPrefix}-${name}`
  }

  const categoryOptions = buildCategorySelectOptions(categories, form.categoryId)
  const brandOptions = buildBrandSelectOptions(form.brand)
  const showItemDetails = Boolean(form.categoryId)
  const selectedDeliveryOptions = form.deliveryOptions ?? []
  const showCollectionPrivateFields =
    selectedDeliveryOptions.includes('collection')
    || selectedDeliveryOptions.includes('buyer_courier')
  const showSellerDeliveryRadius = selectedDeliveryOptions.includes('seller_delivery')

  function handleDeliveryToggle(value, checked) {
    const current = form.deliveryOptions ?? []
    const next = checked ? [...current, value] : current.filter((option) => option !== value)
    onFieldChange('deliveryOptions', next)
  }

  return (
    <form className="listing-form" onSubmit={onSubmit} noValidate>
      <ListingFormSection title="Photos">
        <ListingImageUpload
          variant="dropzone"
          existingImages={existingImages}
          pendingFiles={pendingFiles}
          uploading={uploadingImages}
          uploadError={imageError}
          disabled={imageUploadDisabled}
          onAddPendingFiles={onAddPendingFiles}
          onRemovePendingFile={onRemovePendingFile}
          onReorderPendingFiles={onReorderPendingFiles}
          onRemoveExistingImage={onRemoveExistingImage}
          onReorderExistingImages={onReorderExistingImages}
        />
      </ListingFormSection>

      <ListingFormSection title="About your item">
        <ListingFormRow label="Title" htmlFor={fieldId('title')}>
          <input
            id={fieldId('title')}
            className="listing-form__input listing-form__input--underline"
            type="text"
            maxLength={120}
            placeholder="Tell buyers what you're selling"
            value={form.title}
            onChange={(event) => onFieldChange('title', event.target.value)}
          />
        </ListingFormRow>

        <ListingFormRow label="Description" htmlFor={fieldId('description')} className="listing-form__row--top">
          <textarea
            id={fieldId('description')}
            className="listing-form__textarea listing-form__textarea--underline"
            placeholder="Tell buyers more about it — condition, usage, why you're selling"
            value={form.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            rows={4}
          />
        </ListingFormRow>
      </ListingFormSection>

      <ListingFormSection title="Item details">
        <ListingFormRow label="Category" htmlFor={fieldId('category')}>
          <select
            id={fieldId('category')}
            className="listing-form__select listing-form__select--underline"
            value={form.categoryId}
            onChange={(event) => onFieldChange('categoryId', event.target.value)}
          >
            <option value="">Select a category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </ListingFormRow>

        {showItemDetails ? (
          <div className="listing-form__expand">
            <ListingFormRow label="Brand" htmlFor={fieldId('brand')} optional>
              <select
                id={fieldId('brand')}
                className="listing-form__select listing-form__select--underline"
                value={form.brand}
                onChange={(event) => onFieldChange('brand', event.target.value)}
              >
                <option value="">Select a brand</option>
                {brandOptions.map((brandOption) => (
                  <option key={brandOption} value={brandOption}>
                    {brandOption}
                  </option>
                ))}
              </select>
            </ListingFormRow>

            <ListingFormRow label="Condition" htmlFor={fieldId('condition')}>
              <select
                id={fieldId('condition')}
                className="listing-form__select listing-form__select--underline"
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
            </ListingFormRow>

            <ListingFormRow label="Usage rating" htmlFor={fieldId('rating')} optional>
              <select
                id={fieldId('rating')}
                className="listing-form__select listing-form__select--underline"
                value={form.rating}
                onChange={(event) => onFieldChange('rating', event.target.value)}
              >
                <option value="">Select usage rating</option>
                {LISTING_RATING_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </ListingFormRow>

            <ListingFormRow label="Model" htmlFor={fieldId('model')} optional>
              <input
                id={fieldId('model')}
                className="listing-form__input listing-form__input--underline"
                type="text"
                placeholder="e.g. Pro 5000"
                value={form.model}
                onChange={(event) => onFieldChange('model', event.target.value)}
              />
            </ListingFormRow>

            <ListingFormRow label="Colour" htmlFor={fieldId('colour')} optional>
              <input
                id={fieldId('colour')}
                className="listing-form__input listing-form__input--underline"
                type="text"
                placeholder="e.g. Black"
                value={form.colour}
                onChange={(event) => onFieldChange('colour', event.target.value)}
              />
            </ListingFormRow>

            <ListingFormRow label="Length" htmlFor={fieldId('length')} optional>
              <input
                id={fieldId('length')}
                className="listing-form__input listing-form__input--underline"
                type="text"
                inputMode="decimal"
                placeholder="cm"
                value={form.length}
                onChange={(event) => onFieldChange('length', event.target.value)}
              />
            </ListingFormRow>

            <ListingFormRow label="Width" htmlFor={fieldId('width')} optional>
              <input
                id={fieldId('width')}
                className="listing-form__input listing-form__input--underline"
                type="text"
                inputMode="decimal"
                placeholder="cm"
                value={form.width}
                onChange={(event) => onFieldChange('width', event.target.value)}
              />
            </ListingFormRow>

            <ListingFormRow label="Height" htmlFor={fieldId('height')} optional>
              <input
                id={fieldId('height')}
                className="listing-form__input listing-form__input--underline"
                type="text"
                inputMode="decimal"
                placeholder="cm"
                value={form.height}
                onChange={(event) => onFieldChange('height', event.target.value)}
              />
            </ListingFormRow>
          </div>
        ) : null}
      </ListingFormSection>

      <ListingFormSection title="Location">
        <ListingFormRow label="Item location" htmlFor={fieldId('location')}>
          <ListingLocationAutocomplete
            inputId={fieldId('location')}
            value={form.locationSearch}
            selectedPlace={form.locationPlace}
            disabled={imageUploadDisabled}
            onSearchChange={(value) => onFieldChange('locationSearch', value)}
            onPlaceSelected={(value) => onFieldChange('locationPlace', value)}
          />
        </ListingFormRow>
      </ListingFormSection>

      <ListingFormSection title="Collection and delivery">
        <fieldset className="listing-form__delivery">
          <legend className="visually-hidden">Collection and delivery options</legend>
          {DELIVERY_OPTIONS.map((option) => {
            const isSelected = selectedDeliveryOptions.includes(option.value)

            return (
              <label
                key={option.value}
                className={`listing-form__delivery-option${
                  isSelected ? ' listing-form__delivery-option--selected' : ''
                }`}
              >
                <input
                  type="checkbox"
                  name={`${idPrefix}-delivery-option-${option.value}`}
                  className="listing-form__delivery-checkbox"
                  value={option.value}
                  checked={isSelected}
                  onChange={(event) => handleDeliveryToggle(option.value, event.target.checked)}
                />
                <span className="listing-form__delivery-copy">
                  <span className="listing-form__delivery-label">{option.label}</span>
                  <span className="listing-form__delivery-description">{option.description}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {showCollectionPrivateFields ? (
          <div className="listing-form__fulfilment-private">
            <p className="listing-form__hint">
              Your address and phone number remain private and are only shared with the buyer
              after payment.
            </p>

            <ListingFormRow label="Collection address" htmlFor={fieldId('collection-address')}>
              <CollectionAddressAutocomplete
                inputId={fieldId('collection-address')}
                value={form.collectionAddress}
                onChange={(nextValue) => onFieldChange('collectionAddress', nextValue)}
                placeholder="Start typing your collection address"
              />
            </ListingFormRow>

            <ListingFormRow label="Best contact number" htmlFor={fieldId('collection-phone')}>
              <input
                id={fieldId('collection-phone')}
                className="listing-form__input listing-form__input--underline"
                type="tel"
                autoComplete="tel"
                placeholder="Phone number for fulfilment coordination"
                value={form.collectionPhone}
                onChange={(event) => onFieldChange('collectionPhone', event.target.value)}
              />
            </ListingFormRow>

            <ListingFormRow
              label="Collection instructions"
              htmlFor={fieldId('collection-instructions')}
              optional
            >
              <textarea
                id={fieldId('collection-instructions')}
                className="listing-form__textarea listing-form__textarea--underline"
                placeholder="Access, parking, or loading notes"
                value={form.collectionInstructions}
                onChange={(event) => onFieldChange('collectionInstructions', event.target.value)}
                rows={3}
              />
            </ListingFormRow>
          </div>
        ) : null}

        {showSellerDeliveryRadius ? (
          <ListingFormRow label="Delivery radius" htmlFor={fieldId('delivery-range')}>
            <p className="listing-form__hint listing-form__hint--inline">
              How far are you willing to deliver this item?
            </p>
            <input
              id={fieldId('delivery-range')}
              className="listing-form__input listing-form__input--underline"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Miles"
              value={form.deliveryRangeMiles}
              onChange={(event) => onFieldChange('deliveryRangeMiles', event.target.value)}
            />
          </ListingFormRow>
        ) : null}
      </ListingFormSection>

      <ListingFormSection title="Pricing">
        <ListingFormRow label="Price" htmlFor={fieldId('price')}>
          <div className="listing-form__price-wrap">
            <span className="listing-form__price-prefix" aria-hidden="true">
              £
            </span>
            <input
              id={fieldId('price')}
              className="listing-form__input listing-form__input--underline listing-form__input--price"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={form.price}
              onChange={(event) => onFieldChange('price', event.target.value)}
            />
          </div>
        </ListingFormRow>
      </ListingFormSection>

      {showDraftHints ? (
        <p className="listing-form__footnote">
          Category is required to save. Title, description, photos, location, price, condition, at
          least one collection or delivery option, and any fulfilment details for your selected
          options are required to upload.
        </p>
      ) : null}

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
