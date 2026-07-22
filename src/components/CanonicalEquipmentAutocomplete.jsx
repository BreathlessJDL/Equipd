import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  getEquipmentProductDisplayName,
  resolveValuationSearchMatches,
} from '../lib/equipmentValuation'
import { formatEquipmentProductSearchSuggestion } from '../lib/equipmentProductSearch'
import { resolveEquipmentProductImageUrl } from '../lib/equipmentProductImages'
import { supabase } from '../lib/supabase'
import { getValuationSearchIndex, getValuationSearchIndexLoadState } from '../lib/valuationCatalogCache'
import './CanonicalEquipmentAutocomplete.css'

const DEFAULT_LIMIT = 10
const DEFAULT_DEBOUNCE_MS = 250
const MIN_CHARS = 2

function SuggestionThumb({ product }) {
  const imageUrl = resolveEquipmentProductImageUrl(product, supabase)
  const label = getEquipmentProductDisplayName(product)

  if (!imageUrl) {
    return (
      <span className="canonical-autocomplete__thumb canonical-autocomplete__thumb--placeholder" aria-hidden="true">
        No image
      </span>
    )
  }

  return (
    <span className="canonical-autocomplete__thumb">
      <img
        src={imageUrl}
        alt=""
        className="canonical-autocomplete__thumb-image"
        loading="lazy"
        decoding="async"
      />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

/**
 * Shared canonical-equipment autocomplete for valuator entry points.
 */
export default function CanonicalEquipmentAutocomplete({
  id,
  value,
  onChange,
  selectedProduct = null,
  onSelectedProductChange,
  onSubmit,
  resultLimit = DEFAULT_LIMIT,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  placeholder = 'Search brand or model...',
  inputClassName = '',
  showImages = true,
  disabled = false,
}) {
  const generatedId = useId()
  const inputId = id || `canonical-autocomplete-${generatedId}`
  const listboxId = `${inputId}-listbox`
  const statusId = `${inputId}-status`

  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogFetched, setCatalogFetched] = useState(false)
  const [catalogError, setCatalogError] = useState(null)
  const [debouncedQuery, setDebouncedQuery] = useState(value)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(value)
    }, debounceMs)
    return () => window.clearTimeout(handle)
  }, [value, debounceMs])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  async function ensureCatalog() {
    if (catalogFetched && !catalogError) return

    // Synchronous session/memory hit — avoid flashing a loading state.
    const warm = getValuationSearchIndexLoadState()
    if (warm.ready) {
      const result = await getValuationSearchIndex()
      setCatalog(result.products ?? [])
      setCatalogError(result.error || null)
      setCatalogFetched(true)
      setCatalogLoading(false)
      return
    }

    setCatalogLoading(true)
    setCatalogError(null)
    const result = await getValuationSearchIndex()
    setCatalog(result.products ?? [])
    setCatalogError(result.error || null)
    setCatalogFetched(true)
    setCatalogLoading(false)
  }

  const searchState = useMemo(() => {
    const trimmed = String(debouncedQuery || '').trim()
    if (trimmed.length < MIN_CHARS) {
      return {
        matches: [],
        hasQuery: trimmed.length > 0,
        showNoMatch: false,
        ready: false,
      }
    }
    if (!catalogFetched || catalogLoading) {
      return {
        matches: [],
        hasQuery: true,
        showNoMatch: false,
        ready: false,
      }
    }
    const resolved = resolveValuationSearchMatches(catalog, trimmed)
    const matches = (resolved.scoredMatches.length
      ? resolved.scoredMatches.map((entry) => entry.product)
      : resolved.matches).slice(0, resultLimit)
    return {
      matches,
      hasQuery: true,
      showNoMatch: resolved.showNoMatch,
      ready: true,
    }
  }, [catalog, catalogFetched, catalogLoading, debouncedQuery, resultLimit])

  const trimmedValue = String(value || '').trim()
  const showDropdown = open
    && trimmedValue.length >= MIN_CHARS
    && !selectedProduct

  // Reserve a spinner for actual network index load — not local filtering/debounce.
  const isIndexLoading = showDropdown && catalogLoading && !catalogFetched
  const showLoadingMessage = isIndexLoading

  function updateQuery(nextValue) {
    onChange(nextValue)
    if (selectedProduct) {
      const selectedName = getEquipmentProductDisplayName(selectedProduct)
      if (nextValue.trim() !== selectedName) {
        onSelectedProductChange?.(null)
      }
    }
    setActiveIndex(-1)
    setOpen(true)
    if (String(nextValue || '').trim().length >= MIN_CHARS) {
      ensureCatalog()
    }
  }

  function selectProduct(product) {
    if (!product) return
    onSelectedProductChange?.(product)
    onChange(getEquipmentProductDisplayName(product))
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event) {
    if (!showDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!searchState.matches.length) return
      setActiveIndex((current) => (
        current < searchState.matches.length - 1 ? current + 1 : 0
      ))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!searchState.matches.length) return
      setActiveIndex((current) => (
        current > 0 ? current - 1 : searchState.matches.length - 1
      ))
      return
    }

    if (event.key === 'Enter') {
      if (showDropdown && activeIndex >= 0 && searchState.matches[activeIndex]) {
        event.preventDefault()
        selectProduct(searchState.matches[activeIndex])
        onSubmit?.({
          product: searchState.matches[activeIndex],
          query: getEquipmentProductDisplayName(searchState.matches[activeIndex]),
          source: 'suggestion-enter',
        })
        return
      }
      // Let the form submit handler run (button behaviour).
    }
  }

  const statusText = !showDropdown
    ? ''
    : showLoadingMessage
      ? 'Loading equipment…'
      : catalogError
        ? 'Search unavailable. You can still open the valuator.'
        : searchState.showNoMatch
          ? 'No matching equipment models found.'
          : searchState.matches.length
            ? `${searchState.matches.length} matching equipment model${searchState.matches.length === 1 ? '' : 's'}`
            : ''

  return (
    <div className="canonical-autocomplete" ref={rootRef}>
      <input
        id={inputId}
        className={`canonical-autocomplete__input ${inputClassName}`.trim()}
        type="search"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && searchState.matches[activeIndex]
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-describedby={statusId}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => updateQuery(event.target.value)}
        onFocus={() => {
          setOpen(true)
          ensureCatalog()
        }}
        onClick={() => {
          setOpen(true)
          ensureCatalog()
        }}
        onKeyDown={handleKeyDown}
      />

      <div id={statusId} className="visually-hidden" role="status" aria-live="polite">
        {statusText}
      </div>

      {showDropdown ? (
        <div className="canonical-autocomplete__dropdown" id={listboxId} role="listbox" aria-label="Matching equipment models">
          {showLoadingMessage ? (
            <p className="canonical-autocomplete__message">Loading equipment…</p>
          ) : null}

          {!showLoadingMessage && catalogError ? (
            <p className="canonical-autocomplete__message">
              Search unavailable. Use Value equipment to continue.
            </p>
          ) : null}

          {!showLoadingMessage && !catalogError && searchState.showNoMatch ? (
            <div className="canonical-autocomplete__empty">
              <p className="canonical-autocomplete__message">No matching equipment models found.</p>
              <button
                type="button"
                className="canonical-autocomplete__empty-action"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  onSubmit?.({
                    product: null,
                    query: value,
                    source: 'no-results',
                  })
                }}
              >
                Search in the full equipment valuator →
              </button>
            </div>
          ) : null}

          {!showLoadingMessage && !catalogError && searchState.matches.map((product, index) => {
            const active = index === activeIndex
            const suggestion = formatEquipmentProductSearchSuggestion(product)
            return (
              <div
                key={product.id || product.canonical_product_key || index}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={active}
                className={`canonical-autocomplete__option${active ? ' is-active' : ''}`}
                onMouseDown={(event) => {
                  // Prevent input blur before click selection is handled.
                  event.preventDefault()
                  selectProduct(product)
                  onSubmit?.({
                    product,
                    query: getEquipmentProductDisplayName(product),
                    source: 'suggestion-click',
                  })
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {showImages ? <SuggestionThumb product={product} /> : null}
                <span className="canonical-autocomplete__option-copy">
                  {suggestion.brand ? (
                    <span className="canonical-autocomplete__option-brand">{suggestion.brand}</span>
                  ) : null}
                  {suggestion.series ? (
                    <span className="canonical-autocomplete__option-series">{suggestion.series}</span>
                  ) : null}
                  <span className="canonical-autocomplete__option-title">
                    {suggestion.model || getEquipmentProductDisplayName(product)}
                  </span>
                  {suggestion.equipmentType ? (
                    <span className="canonical-autocomplete__option-meta">{suggestion.equipmentType}</span>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
