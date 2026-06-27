import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import BrowseMobileFilterDrawer from './browse/BrowseMobileFilterDrawer'
import { LISTING_CONDITIONS } from '../lib/constants'
import { buildBrandSelectOptions, buildCategoryFilterOptions } from '../lib/listingOptions'
import { BROWSE_SORT_OPTIONS } from '../lib/listingSort'

function FilterOptionList({
  options,
  selectedValue,
  selectedValues = [],
  multiSelect = false,
  onSelect,
  onToggle,
  ariaLabel,
  onChoose,
}) {
  const selectedList = multiSelect
    ? selectedValues
    : selectedValue != null && selectedValue !== ''
      ? [selectedValue]
      : []

  return (
    <ul
      className="browse-filter-option-list"
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={multiSelect || undefined}
    >
      {options.map((option) => {
        const selected = multiSelect
          ? option.value === ''
            ? selectedList.length === 0
            : selectedList.includes(option.value)
          : selectedValue === option.value

        return (
          <li key={option.value || '__all__'}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`browse-filter-option-list__option${
                selected ? ' browse-filter-option-list__option--selected' : ''
              }${multiSelect ? ' browse-filter-option-list__option--multi' : ''}`}
              onClick={() => {
                if (multiSelect) {
                  onToggle?.(option.value)
                  return
                }

                onSelect?.(option.value)
                onChoose?.()
              }}
            >
              <span className="browse-filter-option-list__label">{option.label}</span>
              {multiSelect ? (
                <span
                  className={`browse-filter-option-list__check${
                    selected ? ' browse-filter-option-list__check--selected' : ''
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FilterPill({
  id,
  label,
  active,
  open,
  onToggle,
  children,
  className = '',
  align = 'left',
}) {
  const menuId = `${id}-menu`
  const triggerRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuStyle(null)
      return undefined
    }

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const nextStyle = {
        position: 'fixed',
        top: `${rect.bottom + 6}px`,
        zIndex: 1100,
        minWidth: `${Math.max(rect.width, 224)}px`,
      }

      if (align === 'right') {
        nextStyle.left = 'auto'
        nextStyle.right = `${Math.max(8, window.innerWidth - rect.right)}px`
      } else {
        nextStyle.left = `${Math.max(8, rect.left)}px`
        nextStyle.right = 'auto'
      }

      setMenuStyle(nextStyle)
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, align])

  const menu =
    open && menuStyle
      ? createPortal(
          <div
            id={menuId}
            className="browse-filter-pill__menu browse-filter-pill__menu--portal"
            style={menuStyle}
            role="presentation"
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <div className={`browse-filter-pill${open ? ' browse-filter-pill--open' : ''} ${className}`.trim()}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`browse-filter-pill__trigger${active ? ' browse-filter-pill__trigger--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={onToggle}
      >
        <span className="browse-filter-pill__label">{label}</span>
        <span className="browse-filter-pill__chevron" aria-hidden="true" />
      </button>
      {menu}
    </div>
  )
}

function ListingBrowseFilters({
  categories,
  categoryId,
  categoryIds = [],
  onCategoryChange,
  onToggleCategoryId,
  onClearCategories,
  condition,
  conditions = [],
  onConditionChange,
  onToggleCondition,
  onClearConditions,
  brand,
  brands = [],
  onBrandChange,
  onToggleBrand,
  onClearBrands,
  sort,
  onSortChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  panelFilterCount = 0,
  sortNotice = '',
  idPrefix = 'listing-browse',
  onReset,
  onApply,
}) {
  const rootId = useId()
  const rootRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const categoryOptions = buildCategoryFilterOptions(categories)
  const brandOptions = buildBrandSelectOptions(brand)
  const sortOptions = BROWSE_SORT_OPTIONS

  const categoryMenuOptions = [
    { value: '', label: 'All categories' },
    ...categoryOptions.map((category) => ({ value: category.id, label: category.label })),
  ]
  const brandMenuOptions = [
    { value: '', label: 'All brands' },
    ...brandOptions.map((brandOption) => ({ value: brandOption, label: brandOption })),
  ]
  const conditionMenuOptions = [
    { value: '', label: 'All conditions' },
    ...LISTING_CONDITIONS.map(({ value, label }) => ({ value, label })),
  ]

  const selectedCategory = categoryOptions.find(
    (entry) => entry.id === (categoryIds[0] ?? categoryId),
  )
  const selectedCondition = LISTING_CONDITIONS.find(
    (entry) => entry.value === (conditions[0] ?? condition),
  )
  const selectedSort = sortOptions.find((entry) => entry.value === sort) ?? sortOptions[0]
  const hasPriceFilter = Boolean(minPrice?.trim() || maxPrice?.trim())

  const categoryLabel =
    categoryIds.length > 1
      ? `${categoryIds.length} categories`
      : (selectedCategory?.label ?? 'Category')
  const brandLabel =
    brands.length > 1 ? `${brands.length} brands` : brands[0]?.trim() || brand?.trim() || 'Brand'
  const conditionLabel =
    conditions.length > 1
      ? `${conditions.length} conditions`
      : (selectedCondition?.label ?? 'Condition')
  const priceLabel = hasPriceFilter
    ? minPrice?.trim() && maxPrice?.trim()
      ? `£${minPrice} – £${maxPrice}`
      : minPrice?.trim()
        ? `from £${minPrice}`
        : `up to £${maxPrice}`
    : 'Price'

  useEffect(() => {
    if (!openMenu && !mobileOpen) return undefined

    function handlePointerDown(event) {
      const target = event.target
      if (rootRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.browse-filter-pill__menu--portal')) return

      setOpenMenu(null)
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [openMenu, mobileOpen])

  function toggleMenu(menu) {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  function closeMenus() {
    setOpenMenu(null)
  }

  function handleApplyFilters() {
    onApply?.()
    setMobileOpen(false)
    closeMenus()
  }

  function closeMobileDrawer() {
    setMobileOpen(false)
  }

  function renderCategoryMenu() {
    return (
      <FilterOptionList
        ariaLabel="Category"
        options={categoryMenuOptions}
        multiSelect
        selectedValues={categoryIds}
        onToggle={onToggleCategoryId}
      />
    )
  }

  function renderBrandMenu() {
    return (
      <FilterOptionList
        ariaLabel="Brand"
        options={brandMenuOptions}
        multiSelect
        selectedValues={brands}
        onToggle={onToggleBrand}
      />
    )
  }

  function renderConditionMenu() {
    return (
      <FilterOptionList
        ariaLabel="Condition"
        options={conditionMenuOptions}
        multiSelect
        selectedValues={conditions}
        onToggle={onToggleCondition}
      />
    )
  }

  function renderPriceMenu({ showActions = false, onChoose } = {}) {
    const minId = `${idPrefix}-min-price`
    const maxId = `${idPrefix}-max-price`

    return (
      <div className="browse-filter-price-menu">
        <div className="browse-filter-price-menu__inputs">
          <input
            id={minId}
            className="browse-filter-price-menu__input"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            placeholder="Min £"
            value={minPrice}
            onChange={(event) => onMinPriceChange(event.target.value)}
            aria-label="Minimum price in GBP"
          />
          <span className="browse-filter-price-menu__separator">to</span>
          <input
            id={maxId}
            className="browse-filter-price-menu__input"
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
        {showActions ? (
          <div className="browse-filter-price-menu__actions">
            <button
              type="button"
              className="listing-browse__button listing-browse__button--primary browse-filter-price-menu__button"
              onClick={() => {
                onApply?.()
                onChoose?.()
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className="listing-browse__button listing-browse__button--secondary browse-filter-price-menu__button"
              onClick={() => {
                onMinPriceChange('')
                onMaxPriceChange('')
                onChoose?.()
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  function renderSortMenu(onSelect) {
    return (
      <FilterOptionList
        ariaLabel="Sort listings"
        options={sortOptions}
        selectedValue={sort}
        onSelect={(value) => {
          onSortChange(value)
          onSelect?.()
        }}
      />
    )
  }

  function renderDesktopBar() {
    return (
      <div className="listing-browse__filter-bar listing-browse__filter-bar--desktop">
        <div className="listing-browse__filter-pills">
          <FilterPill
            id={`${rootId}-category`}
            label={categoryLabel}
            active={categoryIds.length > 0 || Boolean(categoryId)}
            open={openMenu === 'category'}
            onToggle={() => toggleMenu('category')}
          >
            {renderCategoryMenu()}
          </FilterPill>

          <FilterPill
            id={`${rootId}-brand`}
            label={brandLabel}
            active={brands.length > 0 || Boolean(brand?.trim())}
            open={openMenu === 'brand'}
            onToggle={() => toggleMenu('brand')}
          >
            {renderBrandMenu()}
          </FilterPill>

          <FilterPill
            id={`${rootId}-condition`}
            label={conditionLabel}
            active={conditions.length > 0 || Boolean(condition)}
            open={openMenu === 'condition'}
            onToggle={() => toggleMenu('condition')}
          >
            {renderConditionMenu()}
          </FilterPill>

          <FilterPill
            id={`${rootId}-price`}
            label={priceLabel}
            active={hasPriceFilter}
            open={openMenu === 'price'}
            onToggle={() => toggleMenu('price')}
          >
            {renderPriceMenu({ showActions: true, onChoose: closeMenus })}
          </FilterPill>
        </div>

        <FilterPill
          id={`${rootId}-sort`}
          label={`Sort: ${selectedSort.label}`}
          active={sort !== 'newest'}
          open={openMenu === 'sort'}
          onToggle={() => toggleMenu('sort')}
          className="listing-browse__filter-sort"
          align="right"
        >
          {renderSortMenu(handleApplyFilters)}
        </FilterPill>
      </div>
    )
  }

  function renderMobileBar() {
    return (
      <div className="listing-browse__filter-bar listing-browse__filter-bar--mobile">
        <button
          type="button"
          className="listing-browse__mobile-filter-button"
          aria-expanded={mobileOpen}
          aria-controls={`${idPrefix}-mobile-panel`}
          onClick={() => {
            setMobileOpen((open) => !open)
            setOpenMenu(null)
          }}
        >
          Filters{panelFilterCount > 0 ? ` (${panelFilterCount})` : ''}
        </button>
      </div>
    )
  }

  function renderMobileDrawer() {
    return (
      <BrowseMobileFilterDrawer
        open={mobileOpen}
        onClose={closeMobileDrawer}
        onApply={handleApplyFilters}
        onReset={onReset}
        idPrefix={`${idPrefix}-mobile`}
        sort={sort}
        onSortChange={onSortChange}
        sortOptions={sortOptions}
        sortNotice={sortNotice}
        categoryIds={categoryIds}
        onToggleCategory={onToggleCategoryId}
        onClearCategories={onClearCategories}
        categoryMenuOptions={categoryMenuOptions}
        brands={brands}
        onToggleBrand={onToggleBrand}
        onClearBrands={onClearBrands}
        brandMenuOptions={brandMenuOptions}
        conditions={conditions}
        onToggleCondition={onToggleCondition}
        onClearConditions={onClearConditions}
        conditionMenuOptions={conditionMenuOptions}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinPriceChange={onMinPriceChange}
        onMaxPriceChange={onMaxPriceChange}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      id="browse-filters-anchor"
      className="listing-browse__filters"
    >
      {renderDesktopBar()}
      {renderMobileBar()}
      {renderMobileDrawer()}
      {sortNotice ? (
        <p className="listing-browse__sort-notice" role="status">
          {sortNotice}{' '}
          <Link className="listing-browse__sort-notice-link" to="/settings">
            Open Settings
          </Link>
        </p>
      ) : null}
    </div>
  )
}

export default ListingBrowseFilters
