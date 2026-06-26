import './BrowseActiveFilterChips.css'

function BrowseActiveFilterChips({ chips = [], onRemove, onReset, showReset = false }) {
  if (chips.length === 0 && !showReset) return null

  return (
    <div className="browse-active-filters">
      {chips.length > 0 ? (
        <ul className="browse-active-filters__list" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                className="browse-active-filters__chip"
                onClick={() => onRemove?.(chip.removeKey, chip.removeValue)}
              >
                <span>{chip.label}</span>
                <span className="browse-active-filters__chip-remove" aria-hidden="true">
                  ×
                </span>
                <span className="visually-hidden">Remove {chip.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showReset && chips.length > 0 ? (
        <button type="button" className="browse-active-filters__reset" onClick={onReset}>
          Reset filters
        </button>
      ) : null}
    </div>
  )
}

export default BrowseActiveFilterChips
