import { HeartIcon } from '../icons/NavIcons'

function ListingSavedCountOverlay({ count = 0 }) {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0
  const label = safeCount === 1 ? '1 saved' : `${safeCount} saved`

  return (
    <div className="listing-gallery__saved-count" aria-label={label}>
      <HeartIcon className="listing-gallery__saved-count-icon" />
      <span className="listing-gallery__saved-count-number">{safeCount}</span>
    </div>
  )
}

export default ListingSavedCountOverlay
