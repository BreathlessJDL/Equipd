import { Navigate, useParams } from 'react-router-dom'
import CategoryLandingPage from '../components/marketing/CategoryLandingPage'
import {
  EQUIPMENT_LANDING_CONTENTS,
  EQUIPMENT_LANDING_PATH_SET,
  getEquipmentLandingContent,
} from '../lib/equipmentLandingPages.js'

/**
 * Shared route element for equipment-type SEO landings.
 * Path is taken from the matched route segment(s).
 */
export default function EquipmentLandingPage() {
  const params = useParams()
  const splat = params['*'] || params.landingSlug || ''
  const path = `/${String(splat).replace(/^\/+/, '')}`

  if (!EQUIPMENT_LANDING_PATH_SET.has(path)) {
    return <Navigate to="/browse" replace />
  }

  const content = getEquipmentLandingContent(path)
  if (!content) {
    return <Navigate to="/browse" replace />
  }

  return <CategoryLandingPage content={content} />
}

/** Explicit route helpers for App.jsx mapping. */
export function EquipmentLandingPageById({ id }) {
  const content = EQUIPMENT_LANDING_CONTENTS[id]
  if (!content) return <Navigate to="/browse" replace />
  return <CategoryLandingPage content={content} />
}
