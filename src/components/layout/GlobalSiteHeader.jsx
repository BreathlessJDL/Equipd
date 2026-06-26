import { useLocation } from 'react-router-dom'
import HomeHeader from '../home/HomeHeader'
import CategoryTextNav from '../browse/CategoryTextNav'
import '../browse/CategoryTextNav.css'
import '../browse/MarketplaceBrowseShell.css'
import { isMobileHomepageRoute } from '../../lib/siteHeaderRoutes'
import './GlobalSiteHeader.css'

function GlobalSiteHeader({
  search,
  onSearchChange,
  onSearchSubmit,
  categories = [],
  activeCategoryId = '',
  activeRating = '',
  activeSearch = '',
  onNavSelect,
  linkMode = false,
  categoryNavClassName = '',
}) {
  const { pathname } = useLocation()
  const showMobileCategoryNav = isMobileHomepageRoute(pathname)
  const categoryNavClasses = [
    categoryNavClassName,
    showMobileCategoryNav ? '' : 'category-text-nav--hide-mobile',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="global-site-header home-header-stack">
      <HomeHeader
        search={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
      />
      <CategoryTextNav
        categories={categories}
        activeCategoryId={activeCategoryId}
        activeRating={activeRating}
        activeSearch={activeSearch}
        onSelectNavItem={onNavSelect}
        linkMode={linkMode}
        className={categoryNavClasses}
      />
    </div>
  )
}

export default GlobalSiteHeader
