import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Public alias for create-listing. Preserves query params (e.g. ?equipment=canonical-key).
 */
function SellRedirectPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `/listings/new?${query}` : '/listings/new'} replace />
}

export default SellRedirectPage
