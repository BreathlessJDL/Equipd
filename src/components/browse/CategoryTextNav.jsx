import { Link } from 'react-router-dom'
import {
  getActivePopularNavId,
  POPULAR_CATEGORY_NAV_ITEMS,
  resolvePopularNavTarget,
} from '../../lib/popularCategoryNav'

function CategoryTextNav({
  categories = [],
  activeCategoryId = '',
  activeRating = '',
  activeSearch = '',
  onSelectNavItem,
  className = '',
  linkMode = false,
}) {
  const activeNavId = getActivePopularNavId({
    categoryId: activeCategoryId,
    rating: activeRating,
    search: activeSearch,
    categories,
  })

  return (
    <nav
      className={`category-text-nav${className ? ` ${className}` : ''}`}
      aria-label="Popular categories"
    >
      <div className="category-text-nav__inner">
        <ul className="category-text-nav__list">
          {POPULAR_CATEGORY_NAV_ITEMS.map((item) => {
            const target = resolvePopularNavTarget(item, categories)
            const isActive = activeNavId === target.navId

            return (
              <li key={item.id}>
                {linkMode || !onSelectNavItem ? (
                  <Link
                    to={target.href}
                    className={`category-text-nav__link${isActive ? ' category-text-nav__link--active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`category-text-nav__link${isActive ? ' category-text-nav__link--active' : ''}`}
                    onClick={() =>
                      onSelectNavItem({
                        categoryId: target.categoryId,
                        rating: target.rating,
                        search: target.search,
                      })
                    }
                  >
                    {item.label}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

export default CategoryTextNav
