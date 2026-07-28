import { useEffect, useId, useMemo, useRef, useState } from 'react'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import { useAuth } from '../../hooks/useAuth'
import {
  WANTED_REQUEST_CONDITION_OPTIONS,
  WANTED_REQUEST_DEFAULT_CONDITION,
  WANTED_REQUEST_DEFAULT_RADIUS,
  WANTED_REQUEST_ENTRY_MODES,
  WANTED_REQUEST_EQUIPMENT_TYPE_OPTIONS,
  WANTED_REQUEST_RADIUS_OPTIONS,
  WANTED_REQUEST_SOURCES,
  WANTED_REQUEST_UNKNOWN_BRAND,
} from '../../lib/wantedRequestConstants'
import {
  trackWantedRequestUiCompleted,
  trackWantedRequestValidationFailed,
} from '../../lib/wantedRequestAnalytics'
import { getEquipmentProductDisplayName } from '../../lib/equipmentValuation'
import { resolveEquipmentProductImageUrl } from '../../lib/equipmentProductImages'
import { supabase } from '../../lib/supabase'
import { createWantedRequest, createWantedRequestClientId } from '../../lib/wantedRequests'
import {
  toWantedRequestProductSummary,
  validateWantedRequestForm,
} from '../../lib/wantedRequestTypes'
import { WantedBellIcon } from './WantedRequestIcons'
import '../auth/AuthModal.css'
import './WantedRequestModal.css'

function getFocusableElements(root) {
  if (!root) return []
  return [
    ...root.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
}

function ProductSummary({ product }) {
  if (!product) return null

  return (
    <div className="wanted-request-modal__product">
      {product.imageUrl ? (
        <img
          className="wanted-request-modal__product-image"
          src={product.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className="wanted-request-modal__product-image wanted-request-modal__product-image--empty"
          aria-hidden="true"
        />
      )}
      <div className="wanted-request-modal__product-copy">
        <p className="wanted-request-modal__product-name">{product.productName}</p>
        <p className="wanted-request-modal__product-meta">
          {[product.brand, product.equipmentType].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function resolveInitialEntryMode(draft) {
  if (draft?.preferredEntryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL) {
    return WANTED_REQUEST_ENTRY_MODES.MANUAL
  }
  if (draft?.suggestManualFromSearch && draft?.searchTerm && !draft?.product) {
    return WANTED_REQUEST_ENTRY_MODES.MANUAL
  }
  return WANTED_REQUEST_ENTRY_MODES.CATALOGUE
}

function buildInitialState(draft, userEmail) {
  const entryMode = resolveInitialEntryMode(draft)
  const product = draft?.product ?? null
  const searchTerm = draft?.searchTerm || ''

  return {
    entryMode,
    product,
    equipmentQuery: product?.productName || (entryMode === 'catalogue' ? searchTerm : '') || draft?.brand || '',
    selectedCatalogProduct: null,
    manualBrand: product?.brand || draft?.brand || '',
    manualModelName:
      entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL
        ? product?.productName || searchTerm || ''
        : product?.productName || '',
    manualEquipmentType: product?.equipmentType || draft?.equipmentType || '',
    searchTerm,
    location: draft?.location || '',
    radius: WANTED_REQUEST_DEFAULT_RADIUS,
    maximumBudget: '',
    conditionPreference: WANTED_REQUEST_DEFAULT_CONDITION,
    notes: '',
    email: userEmail ? String(userEmail) : '',
    saveAsAlert: true,
  }
}

function WantedRequestModal({ open, draft, onClose }) {
  const { user } = useAuth()
  const titleId = useId()
  const dialogRef = useRef(null)
  const initial = useMemo(() => buildInitialState(draft, user?.email), [draft, user?.email])

  const [entryMode, setEntryMode] = useState(initial.entryMode)
  const [product, setProduct] = useState(initial.product)
  const [equipmentQuery, setEquipmentQuery] = useState(initial.equipmentQuery)
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null)
  const [manualBrand, setManualBrand] = useState(initial.manualBrand)
  const [manualModelName, setManualModelName] = useState(initial.manualModelName)
  const [manualEquipmentType, setManualEquipmentType] = useState(initial.manualEquipmentType)
  const [location, setLocation] = useState(initial.location)
  const [radius, setRadius] = useState(initial.radius)
  const [maximumBudget, setMaximumBudget] = useState(initial.maximumBudget)
  const [conditionPreference, setConditionPreference] = useState(initial.conditionPreference)
  const [notes, setNotes] = useState(initial.notes)
  const [email, setEmail] = useState(initial.email)
  const [saveAsAlert, setSaveAsAlert] = useState(initial.saveAsAlert)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const clientRequestIdRef = useRef(createWantedRequestClientId())

  const source = draft?.source || WANTED_REQUEST_SOURCES.HOMEPAGE
  const isManual = entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL
  const searchTerm = draft?.searchTerm || initial.searchTerm || ''

  const fieldIds = useMemo(
    () => ({
      equipment: `${titleId}-equipment`,
      manualBrand: `${titleId}-manual-brand`,
      manualModel: `${titleId}-manual-model`,
      manualType: `${titleId}-manual-type`,
      location: `${titleId}-location`,
      budget: `${titleId}-budget`,
      notes: `${titleId}-notes`,
      email: `${titleId}-email`,
      alert: `${titleId}-alert`,
    }),
    [titleId],
  )

  useEffect(() => {
    if (!open) return undefined

    clientRequestIdRef.current = createWantedRequestClientId()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    window.requestAnimationFrame(() => {
      const focusables = getFocusableElements(dialog)
      const preferred = dialog?.querySelector('[data-wanted-initial-focus]')
      ;(preferred || focusables[0] || dialog)?.focus?.()
    })

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialog) return

      const focusables = getFocusableElements(dialog)
      if (focusables.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  function switchToManual({ brand = '', model = '', equipmentType = '' } = {}) {
    setEntryMode(WANTED_REQUEST_ENTRY_MODES.MANUAL)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.equipment
      return next
    })
    if (brand) setManualBrand(brand)
    else if (product?.brand) setManualBrand(product.brand)
    else if (draft?.brand) setManualBrand(draft.brand)

    if (model) setManualModelName(model)
    else if (product?.productName) setManualModelName(product.productName)
    else if (searchTerm) setManualModelName(searchTerm)

    if (equipmentType) setManualEquipmentType(equipmentType)
    else if (product?.equipmentType) setManualEquipmentType(product.equipmentType)
  }

  function switchToCatalogue() {
    setEntryMode(WANTED_REQUEST_ENTRY_MODES.CATALOGUE)
    setProduct(null)
    setSelectedCatalogProduct(null)
    setEquipmentQuery(manualModelName || draft?.brand || searchTerm || '')
    setErrors((prev) => {
      const next = { ...prev }
      delete next.manualBrand
      delete next.manualModelName
      delete next.equipment
      return next
    })
  }

  function handleCatalogProductChange(nextProduct) {
    setSelectedCatalogProduct(nextProduct)
    if (!nextProduct) {
      setProduct(null)
      return
    }

    const imageUrl = resolveEquipmentProductImageUrl(nextProduct, supabase)
    const summary = toWantedRequestProductSummary(nextProduct, {
      imageUrl,
      productName: getEquipmentProductDisplayName(nextProduct),
    })

    // Catalogue validity depends on a selected product identifier, not typed text.
    if (!summary?.productId && !summary?.canonicalProductKey) {
      setProduct(null)
      setErrors((prev) => ({
        ...prev,
        equipment: 'Select equipment from the catalogue, or enter it manually.',
      }))
      return
    }

    setProduct(summary)
    setEquipmentQuery(summary.productName || '')
    setErrors((prev) => {
      if (!prev.equipment && !prev.manualBrand && !prev.manualModelName) return prev
      const next = { ...prev }
      delete next.equipment
      delete next.manualBrand
      delete next.manualModelName
      return next
    })
  }

  function handleEquipmentQueryChange(nextValue) {
    const next = String(nextValue ?? '')
    setEquipmentQuery(next)

    // Keep selection when autocomplete writes back the selected display name after pick.
    // Clear selection only when the typed text no longer matches the selected product.
    setProduct((current) => {
      if (!current) return current
      const selectedName = String(current.productName || '').trim()
      if (next.trim() === selectedName) return current
      return null
    })
    setSelectedCatalogProduct((current) => {
      if (!current) return current
      const selectedName = getEquipmentProductDisplayName(current).trim()
      if (next.trim() === selectedName) return current
      return null
    })
  }

  function clearCatalogueSelection() {
    setSelectedCatalogProduct(null)
    setProduct(null)
    setEquipmentQuery('')
    setErrors((prev) => {
      if (!prev.equipment) return prev
      const next = { ...prev }
      delete next.equipment
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const result = validateWantedRequestForm(
      {
        entryMode,
        product,
        equipmentQuery,
        manualBrand,
        manualModelName,
        manualEquipmentType,
        searchTerm,
        location,
        radius,
        maximumBudget,
        conditionPreference,
        notes,
        email,
        saveAsAlert,
      },
      {
        requireEmail: true,
        source,
      },
    )

    if (!result.ok) {
      setErrors(result.errors)
      setSubmitError('')
      trackWantedRequestValidationFailed({
        source,
        entry_mode: entryMode,
        fields: Object.keys(result.errors).join(','),
      })
      return
    }

    const payload = result.payload
    setErrors({})
    setSubmitError('')
    setSubmitting(true)

    try {
      const response = await createWantedRequest(payload, {
        clientRequestId: clientRequestIdRef.current,
      })

      if (!response.ok) {
        setSubmitError(response.error || 'Something went wrong. Please try again.')
        return
      }

      trackWantedRequestUiCompleted({
        source: payload.source,
        entry_mode: payload.entryMode,
        product_id: payload.productId,
        brand: payload.brand,
        radius: payload.radius,
        condition: payload.conditionPreference,
        has_budget: payload.maximumBudget != null,
        save_as_alert: payload.saveAsAlert,
      })

      setSuccess(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-modal wanted-request-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="auth-modal__dialog wanted-request-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button type="button" className="auth-modal__close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {success ? (
          <div className="wanted-request-modal__success">
            <span className="wanted-request-modal__success-icon" aria-hidden="true">
              <WantedBellIcon />
            </span>
            <h2 id={titleId} className="wanted-request-modal__title">
              Request created
            </h2>
            <p className="wanted-request-modal__success-copy">
              We&apos;ll notify you when matching equipment becomes available.
            </p>
            <button
              type="button"
              className="wanted-request-modal__submit"
              onClick={onClose}
              data-wanted-initial-focus
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="wanted-request-modal__title">
              {isManual ? 'Request equipment' : 'Request this equipment'}
            </h2>
            {isManual ? (
              <p className="wanted-request-modal__lead">
                Enter the equipment details below and we&apos;ll notify you if a suitable match
                becomes available.
              </p>
            ) : null}

            {!isManual && product ? <ProductSummary product={product} /> : null}

            <form className="wanted-request-modal__form" onSubmit={handleSubmit} noValidate>
              {isManual ? (
                <div className="wanted-request-modal__manual-block">
                  <div className="wanted-request-modal__field">
                    <label className="wanted-request-modal__label" htmlFor={fieldIds.manualBrand}>
                      Brand
                    </label>
                    <div className="wanted-request-modal__brand-row">
                      <input
                        id={fieldIds.manualBrand}
                        className="wanted-request-modal__input"
                        value={manualBrand === WANTED_REQUEST_UNKNOWN_BRAND ? '' : manualBrand}
                        onChange={(event) => setManualBrand(event.target.value)}
                        placeholder="e.g. Technogym"
                        disabled={manualBrand === WANTED_REQUEST_UNKNOWN_BRAND}
                        data-wanted-initial-focus
                        aria-invalid={Boolean(errors.manualBrand)}
                      />
                      <button
                        type="button"
                        className={`wanted-request-modal__unknown${
                          manualBrand === WANTED_REQUEST_UNKNOWN_BRAND
                            ? ' wanted-request-modal__unknown--active'
                            : ''
                        }`}
                        aria-pressed={manualBrand === WANTED_REQUEST_UNKNOWN_BRAND}
                        onClick={() =>
                          setManualBrand((current) =>
                            current === WANTED_REQUEST_UNKNOWN_BRAND
                              ? ''
                              : WANTED_REQUEST_UNKNOWN_BRAND,
                          )
                        }
                      >
                        Unknown
                      </button>
                    </div>
                    {errors.manualBrand ? (
                      <p className="wanted-request-modal__error" role="alert">
                        {errors.manualBrand}
                      </p>
                    ) : null}
                  </div>

                  <div className="wanted-request-modal__field">
                    <label className="wanted-request-modal__label" htmlFor={fieldIds.manualModel}>
                      Model or equipment name
                    </label>
                    <input
                      id={fieldIds.manualModel}
                      className="wanted-request-modal__input"
                      value={manualModelName}
                      onChange={(event) => setManualModelName(event.target.value)}
                      placeholder="e.g. Skillmill Connect"
                      aria-invalid={Boolean(errors.manualModelName)}
                    />
                    {errors.manualModelName ? (
                      <p className="wanted-request-modal__error" role="alert">
                        {errors.manualModelName}
                      </p>
                    ) : null}
                  </div>

                  <div className="wanted-request-modal__field">
                    <label className="wanted-request-modal__label" htmlFor={fieldIds.manualType}>
                      Equipment type <span className="wanted-request-modal__optional">(optional)</span>
                    </label>
                    <select
                      id={fieldIds.manualType}
                      className="wanted-request-modal__input"
                      value={manualEquipmentType}
                      onChange={(event) => setManualEquipmentType(event.target.value)}
                    >
                      {WANTED_REQUEST_EQUIPMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value || 'empty'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="wanted-request-modal__mode-link"
                    onClick={switchToCatalogue}
                  >
                    Search Equipd equipment instead
                  </button>
                </div>
              ) : (
                <div className="wanted-request-modal__catalogue-block">
                  <div className="wanted-request-modal__field">
                    <label className="wanted-request-modal__label" htmlFor={fieldIds.equipment}>
                      Equipment
                    </label>
                    <CanonicalEquipmentAutocomplete
                      id={fieldIds.equipment}
                      value={equipmentQuery}
                      onChange={handleEquipmentQueryChange}
                      selectedProduct={selectedCatalogProduct}
                      onSelectedProductChange={handleCatalogProductChange}
                      placeholder={
                        draft?.brand ? `Search ${draft.brand} models…` : 'Search brand or model…'
                      }
                      inputClassName="wanted-request-modal__input"
                      showImages
                    />
                    {product ? (
                      <div className="wanted-request-modal__selection-actions">
                        <button
                          type="button"
                          className="wanted-request-modal__mode-link"
                          onClick={clearCatalogueSelection}
                        >
                          Clear selection
                        </button>
                      </div>
                    ) : null}
                    {errors.equipment ? (
                      <p className="wanted-request-modal__error" role="alert">
                        {errors.equipment}
                      </p>
                    ) : null}
                  </div>

                  {searchTerm && !product ? (
                    <button
                      type="button"
                      className="wanted-request-modal__suggest"
                      onClick={() =>
                        switchToManual({
                          brand: draft?.brand || '',
                          model: searchTerm,
                        })
                      }
                    >
                      Use &lsquo;{searchTerm}&rsquo; as a manual request
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="wanted-request-modal__mode-link"
                    onClick={() =>
                      switchToManual({
                        brand: product?.brand || draft?.brand || '',
                        model: product?.productName || searchTerm || '',
                        equipmentType: product?.equipmentType || '',
                      })
                    }
                  >
                    Can&apos;t find your equipment? Enter it manually
                  </button>
                </div>
              )}

              <div className="wanted-request-modal__field">
                <label className="wanted-request-modal__label" htmlFor={fieldIds.location}>
                  Location
                </label>
                <input
                  id={fieldIds.location}
                  className="wanted-request-modal__input"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. London, SW1 or nationwide"
                  autoComplete="address-level2"
                />
              </div>

              <fieldset className="wanted-request-modal__fieldset">
                <legend className="wanted-request-modal__label">Search distance</legend>
                <div className="wanted-request-modal__pills" role="radiogroup" aria-label="Search distance">
                  {WANTED_REQUEST_RADIUS_OPTIONS.map((option) => {
                    const selected = radius === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`wanted-request-modal__pill${selected ? ' wanted-request-modal__pill--selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setRadius(option.value)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="wanted-request-modal__field">
                <label className="wanted-request-modal__label" htmlFor={fieldIds.budget}>
                  Maximum budget <span className="wanted-request-modal__optional">(optional)</span>
                </label>
                <input
                  id={fieldIds.budget}
                  className="wanted-request-modal__input"
                  inputMode="decimal"
                  value={maximumBudget}
                  onChange={(event) => setMaximumBudget(event.target.value)}
                  placeholder="e.g. £5,000"
                  aria-invalid={Boolean(errors.maximumBudget)}
                />
                {errors.maximumBudget ? (
                  <p className="wanted-request-modal__error" role="alert">
                    {errors.maximumBudget}
                  </p>
                ) : null}
              </div>

              <fieldset className="wanted-request-modal__fieldset">
                <legend className="wanted-request-modal__label">Condition preference</legend>
                <div
                  className="wanted-request-modal__pills"
                  role="radiogroup"
                  aria-label="Condition preference"
                >
                  {WANTED_REQUEST_CONDITION_OPTIONS.map((option) => {
                    const selected = conditionPreference === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`wanted-request-modal__pill${selected ? ' wanted-request-modal__pill--selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setConditionPreference(option.value)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="wanted-request-modal__field">
                <label className="wanted-request-modal__label" htmlFor={fieldIds.notes}>
                  Additional notes <span className="wanted-request-modal__optional">(optional)</span>
                </label>
                <textarea
                  id={fieldIds.notes}
                  className="wanted-request-modal__textarea"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Any specific requirements?"
                />
              </div>

              <div className="wanted-request-modal__field">
                <label className="wanted-request-modal__label" htmlFor={fieldIds.email}>
                  Email address
                </label>
                <input
                  id={fieldIds.email}
                  className="wanted-request-modal__input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <p className="wanted-request-modal__error" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="wanted-request-modal__info" role="note">
                We&apos;ll notify you when matching equipment becomes available.
              </div>

              <label className="wanted-request-modal__checkbox" htmlFor={fieldIds.alert}>
                <input
                  id={fieldIds.alert}
                  type="checkbox"
                  checked={saveAsAlert}
                  onChange={(event) => setSaveAsAlert(event.target.checked)}
                />
                <span>Also save this as an alert for new listings</span>
              </label>

              {submitError ? (
                <p className="wanted-request-modal__error" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                className="wanted-request-modal__submit"
                disabled={submitting}
              >
                {submitting ? 'Creating request…' : 'Create request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default WantedRequestModal
