import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { fetchCategories } from '../../lib/listings'
import { buildBrowseSearchPath } from '../../lib/browseSearchNavigation'
import { isBrowseShellRoute, isMessagesThreadRoute, isSellGymEquipmentRoute } from '../../lib/siteHeaderRoutes'
import { useActivityHeartbeat } from '../../hooks/useActivityHeartbeat'
import SiteStructuredData from '../seo/SiteStructuredData'
import GlobalSiteHeader from './GlobalSiteHeader'
import SiteFooter from './SiteFooter'
import './AppShell.css'

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  useActivityHeartbeat()
  const [categories, setCategories] = useState([])
  const [pageHeaderConfig, setPageHeaderConfig] = useState(null)
  const [fallbackSearch, setFallbackSearch] = useState('')
  const usesBrowseShellFooter = isBrowseShellRoute(location.pathname)
  const hideSiteFooter = isMessagesThreadRoute(location.pathname)
  const isEquipmentProductRoute = /^\/equipment\//.test(location.pathname)
  const isBrandsRoute = location.pathname === '/brands'
    || location.pathname.startsWith('/brands/')
  const isSellGymEquipmentRoutePage = isSellGymEquipmentRoute(location.pathname)
  const isListingDetailRoute =
    /^\/listings\/[^/]+$/.test(location.pathname) && !usesBrowseShellFooter

  const registerSiteHeader = useCallback((config) => {
    setPageHeaderConfig(config)
  }, [])

  useEffect(() => {
    setPageHeaderConfig(null)
  }, [location.pathname])

  useEffect(() => {
    let active = true

    async function loadCategories() {
      const { data, error } = await fetchCategories()

      if (!active || error) return

      setCategories(data ?? [])
    }

    loadCategories()

    return () => {
      active = false
    }
  }, [])

  const defaultHeaderConfig = useMemo(
    () => ({
      search: fallbackSearch,
      onSearchChange: setFallbackSearch,
      onSearchSubmit: () => {
        navigate(buildBrowseSearchPath(fallbackSearch))
      },
      categories,
      activeCategoryId: '',
      activeRating: '',
      activeSearch: '',
      onNavSelect: null,
      linkMode: true,
      categoryNavClassName: '',
    }),
    [categories, fallbackSearch, navigate],
  )

  const headerConfig = pageHeaderConfig ?? defaultHeaderConfig

  const outletContext = useMemo(
    () => ({
      registerSiteHeader,
      categories,
    }),
    [registerSiteHeader, categories],
  )

  return (
    <div className="app-shell app-shell--home">
      <SiteStructuredData />
      <GlobalSiteHeader {...headerConfig} />

      <main
        className={`app-shell__main${
          usesBrowseShellFooter || isSellGymEquipmentRoutePage ? ' app-shell__main--home' : ''
        }${isEquipmentProductRoute ? ' app-shell__main--equipment' : ''}${
          isBrandsRoute ? ' app-shell__main--brands' : ''
        }${isSellGymEquipmentRoutePage ? ' app-shell__main--sell' : ''}${
          isListingDetailRoute ? ' app-shell__main--listing-detail' : ''
        }${hideSiteFooter ? ' app-shell__main--messages' : ''}`}
      >
        <Outlet context={outletContext} />
      </main>

      <SiteFooter />
    </div>
  )
}

export default AppShell
