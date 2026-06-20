import { LISTING_CONDITIONS } from '../lib/constants'

function ListingBrowseFilters({
  categories,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  condition,
  onConditionChange,
  brand,
  onBrandChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  idPrefix = 'listing-browse',
}) {
  return (
    <div className="listing-browse__filters">
      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-search`}>
          Search
        </label>
        <input
          id={`${idPrefix}-search`}
          className="listing-browse__input"
          type="search"
          placeholder="Title, model, or description"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-category`}>
          Category
        </label>
        <select
          id={`${idPrefix}-category`}
          className="listing-browse__select"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-condition`}>
          Condition
        </label>
        <select
          id={`${idPrefix}-condition`}
          className="listing-browse__select"
          value={condition}
          onChange={(event) => onConditionChange(event.target.value)}
        >
          <option value="">Any condition</option>
          {LISTING_CONDITIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-brand`}>
          Brand
        </label>
        <input
          id={`${idPrefix}-brand`}
          className="listing-browse__input"
          type="search"
          placeholder="e.g. Rogue, Eleiko"
          value={brand}
          onChange={(event) => onBrandChange(event.target.value)}
        />
      </div>

      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-min-price`}>
          Min price (GBP)
        </label>
        <input
          id={`${idPrefix}-min-price`}
          className="listing-browse__input"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={minPrice}
          onChange={(event) => onMinPriceChange(event.target.value)}
        />
      </div>

      <div className="listing-browse__field">
        <label className="listing-browse__label" htmlFor={`${idPrefix}-max-price`}>
          Max price (GBP)
        </label>
        <input
          id={`${idPrefix}-max-price`}
          className="listing-browse__input"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Any"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange(event.target.value)}
        />
      </div>
    </div>
  )
}

export default ListingBrowseFilters
