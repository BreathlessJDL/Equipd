import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { summarizeBrowseFilterValues } from '../../lib/browseFilters'

const SORT_DISPLAY_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  price_asc: 'Price low to high',
  price_desc: 'Price high to low',
  nearest: 'Nearest first',
}

function CheckIndicator({ selected }) {
  return (
    <span
      className={`browse-mobile-filter__check${selected ? ' browse-mobile-filter__check--selected' : ''}`}
      aria-hidden="true"
    >
      {selected ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.25 6.5 11.25 12.5 4.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  )
}

function BrowseMobileFilterDrawer({
  open,
  onClose,
  onApply,
  onReset,
  idPrefix = 'browse-mobile-filter',
  sort,
  onSortChange,
  sortOptions,
  sortNotice = '',
  categoryIds = [],
  onToggleCategory,
  onClearCategories,
  categoryMenuOptions,
  brands = [],
  onToggleBrand,
  onClearBrands,
  brandMenuOptions,
  conditions = [],
  onToggleCondition,
  onClearConditions,
  conditionMenuOptions,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}) {
  const [screen, setScreen] = useState(null)
  const [brandSearch, setBrandSearch] = useState('')
  const titleId = useId()

  const selectedSort = sortOptions.find((entry) => entry.value === sort) ?? sortOptions[0]
  const hasPriceFilter = Boolean(minPrice?.trim() || maxPrice?.trim())

  const sortSummary =
    SORT_DISPLAY_LABELS[selectedSort?.value] ?? selectedSort?.label ?? 'Newest first'
  const categorySummary = summarizeBrowseFilterValues(
    categoryIds
      .map((id) => categoryMenuOptions.find((entry) => entry.value === id)?.label)
      .filter(Boolean),
  )
  const brandSummary = summarizeBrowseFilterValues(brands)
  const conditionSummary = summarizeBrowseFilterValues(
    conditions
      .map((value) => conditionMenuOptions.find((entry) => entry.value === value)?.label)
      .filter(Boolean),
  )
  const priceSummary = hasPriceFilter
    ? minPrice?.trim() && maxPrice?.trim()
      ? `£${minPrice} – £${maxPrice}`
      : minPrice?.trim()
        ? `From £${minPrice}`
        : `Up to £${maxPrice}`
    : 'All'

  const filteredBrandOptions = useMemo(() => {
    const query = brandSearch.trim().toLowerCase()
    const allOption = brandMenuOptions.find((entry) => entry.value === '')
    const brands = brandMenuOptions.filter((entry) => entry.value !== '')

    if (!query) {
      return allOption ? [allOption, ...brands] : brands
    }

    const matches = brands.filter((entry) => entry.label.toLowerCase().includes(query))
    return allOption ? [allOption, ...matches] : matches
  }, [brandMenuOptions, brandSearch])

  const sortMenuOptions = useMemo(
    () =>
      sortOptions.map((option) => ({
        ...option,
        label: SORT_DISPLAY_LABELS[option.value] ?? option.label,
      })),
    [sortOptions],
  )

  useEffect(() => {
    if (!open) {
      setScreen(null)
      setBrandSearch('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key !== 'Escape') return
      if (screen) {
        setScreen(null)
        setBrandSearch('')
        return
      }
      onClose()
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose, screen])

  if (!open) return null

  function handleShowResults() {
    onApply?.()
    onClose()
  }

  function handleClearAll() {
    onReset?.()
    setScreen(null)
    setBrandSearch('')
  }

  function clearCurrentScreen() {
    switch (screen) {
      case 'sort':
        onSortChange('newest')
        break
      case 'category':
        onClearCategories?.()
        break
      case 'brand':
        onClearBrands?.()
        setBrandSearch('')
        break
      case 'condition':
        onClearConditions?.()
        break
      case 'price':
        onMinPriceChange('')
        onMaxPriceChange('')
        break
      default:
        break
    }
  }

  function renderOverviewRows() {
    const rows = [
      { id: 'sort', label: 'Sort by', value: sortSummary, active: sort !== 'newest' },
      { id: 'category', label: 'Category', value: categorySummary, active: categoryIds.length > 0 },
      { id: 'brand', label: 'Brand', value: brandSummary, active: brands.length > 0 },
      { id: 'condition', label: 'Condition', value: conditionSummary, active: conditions.length > 0 },
      { id: 'price', label: 'Price', value: priceSummary, active: hasPriceFilter },
    ]

    return (
      <ul className="browse-mobile-filter__overview-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="browse-mobile-filter__overview-row"
              onClick={() => setScreen(row.id)}
            >
              <span className="browse-mobile-filter__overview-label">{row.label}</span>
              <span className="browse-mobile-filter__overview-value-wrap">
                <span
                  className={`browse-mobile-filter__overview-value${
                    row.active ? ' browse-mobile-filter__overview-value--active' : ''
                  }`}
                >
                  {row.value}
                </span>
                <span className="browse-mobile-filter__overview-chevron" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  function renderOptionRows(options, selectedValues, onToggle, { multi = false } = {}) {
    const selectedList = multi
      ? selectedValues
      : selectedValues
        ? [selectedValues]
        : []

    return (
      <ul className="browse-mobile-filter__option-list" role="listbox">
        {options.map((option) => {
          const selected = multi
            ? option.value === ''
              ? selectedList.length === 0
              : selectedList.includes(option.value)
            : selectedValueEquals(selectedList[0], option.value)

          return (
            <li key={option.value || '__all__'}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`browse-mobile-filter__option-row${
                  selected ? ' browse-mobile-filter__option-row--selected' : ''
                }`}
                onClick={() => onToggle(option.value)}
              >
                <span className="browse-mobile-filter__option-label">{option.label}</span>
                <CheckIndicator selected={selected} />
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  function selectedValueEquals(left, right) {
    return left === right
  }

  function renderScreenContent() {
    switch (screen) {
      case 'sort':
        return (
          <>
            {sortNotice ? <p className="browse-mobile-filter__notice">{sortNotice}</p> : null}
            {renderOptionRows(sortMenuOptions, sort, onSortChange)}
          </>
        )
      case 'category':
        return renderOptionRows(categoryMenuOptions, categoryIds, onToggleCategory, { multi: true })
      case 'brand':
        return (
          <>
            <label className="browse-mobile-filter__search" htmlFor={`${idPrefix}-brand-search`}>
              <span className="browse-mobile-filter__search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16.5 16.5 20 20" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id={`${idPrefix}-brand-search`}
                className="browse-mobile-filter__search-input"
                type="search"
                placeholder="Search for brands"
                value={brandSearch}
                onChange={(event) => setBrandSearch(event.target.value)}
                autoComplete="off"
              />
            </label>
            {renderOptionRows(filteredBrandOptions, brands, onToggleBrand, { multi: true })}
          </>
        )
      case 'condition':
        return renderOptionRows(conditionMenuOptions, conditions, onToggleCondition, { multi: true })
      case 'price': {
        const minId = `${idPrefix}-min-price`
        const maxId = `${idPrefix}-max-price`

        return (
          <div className="browse-mobile-filter__price">
            <div className="browse-mobile-filter__price-inputs">
              <input
                id={minId}
                className="browse-mobile-filter__price-input"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                placeholder="Min £"
                value={minPrice}
                onChange={(event) => onMinPriceChange(event.target.value)}
                aria-label="Minimum price in GBP"
              />
              <span className="browse-mobile-filter__price-separator">to</span>
              <input
                id={maxId}
                className="browse-mobile-filter__price-input"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                placeholder="Max £"
                value={maxPrice}
                onChange={(event) => onMaxPriceChange(event.target.value)}
                aria-label="Maximum price in GBP"
              />
            </div>
            <div className="browse-mobile-filter__price-actions">
              <button
                type="button"
                className="listing-browse__button listing-browse__button--primary browse-mobile-filter__price-button"
                onClick={() => setScreen(null)}
              >
                Apply price
              </button>
              <button
                type="button"
                className="listing-browse__button listing-browse__button--secondary browse-mobile-filter__price-button"
                onClick={() => {
                  onMinPriceChange('')
                  onMaxPriceChange('')
                }}
              >
                Clear price
              </button>
            </div>
          </div>
        )
      }
      default:
        return renderOverviewRows()
    }
  }

  const screenTitles = {
    sort: 'Sort by',
    category: 'Category',
    brand: 'Brand',
    condition: 'Condition',
    price: 'Price',
  }

  const isOverview = !screen

  const drawer = (
    <div
      id={`${idPrefix}-panel`}
      className="browse-mobile-filter"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="browse-mobile-filter__header">
        {isOverview ? (
          <button
            type="button"
            className="browse-mobile-filter__header-button browse-mobile-filter__header-button--close"
            aria-label="Close filters"
            onClick={onClose}
          >
            ×
          </button>
        ) : (
          <button
            type="button"
            className="browse-mobile-filter__header-button browse-mobile-filter__header-button--back"
            onClick={() => {
              setScreen(null)
              setBrandSearch('')
            }}
          >
            <span className="browse-mobile-filter__back-icon" aria-hidden="true" />
            Back
          </button>
        )}

        <h2 id={titleId} className="browse-mobile-filter__title">
          {isOverview ? 'Filter' : screenTitles[screen]}
        </h2>

        {isOverview ? (
          onReset ? (
            <button
              type="button"
              className="browse-mobile-filter__header-button browse-mobile-filter__header-button--clear"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          ) : (
            <span className="browse-mobile-filter__header-spacer" aria-hidden="true" />
          )
        ) : (
          <button
            type="button"
            className="browse-mobile-filter__header-button browse-mobile-filter__header-button--clear"
            onClick={clearCurrentScreen}
          >
            Clear
          </button>
        )}
      </header>

      <div className="browse-mobile-filter__body">{renderScreenContent()}</div>

      <footer className="browse-mobile-filter__footer">
        <button
          type="button"
          className="listing-browse__button listing-browse__button--primary browse-mobile-filter__submit"
          onClick={handleShowResults}
        >
          Show results
        </button>
      </footer>
    </div>
  )

  return createPortal(drawer, document.body)
}

export default BrowseMobileFilterDrawer
