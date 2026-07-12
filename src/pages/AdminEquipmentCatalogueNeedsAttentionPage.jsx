import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildCatalogueSummary,
  buildProductsPathWithAttention,
  CATALOGUE_ATTENTION,
  CATALOGUE_ATTENTION_LABELS,
} from '../lib/equipmentCatalogueAdmin'
import { fetchEquipmentProductContentAdminRows } from '../lib/equipmentProductContentAdmin'
import {
  fetchDedupedApprovedCanonicalProducts,
  fetchEquipmentProducts,
} from '../lib/equipmentProducts'
import { PRODUCT_STATUS } from '../lib/intelligenceCanonicalProducts'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import '../components/admin/EquipmentCatalogueNav.css'

function AdminEquipmentCatalogueNeedsAttentionPage() {
  usePageTitle('Needs attention — Equipment Catalogue')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [contentByProductId, setContentByProductId] = useState({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const [productsResult, contentResult] = await Promise.all([
        fetchEquipmentProducts(),
        fetchEquipmentProductContentAdminRows(),
      ])
      if (cancelled) return

      if (productsResult.error) {
        setError(getAdminErrorMessage(productsResult.error))
        setLoading(false)
        return
      }

      const allProducts = productsResult.products ?? []
      const approved = allProducts.filter((product) => product.status === PRODUCT_STATUS.APPROVED)
      const nonApproved = allProducts.filter((product) => product.status !== PRODUCT_STATUS.APPROVED
        && product.status !== PRODUCT_STATUS.EXCLUDED)
      const deduped = await fetchDedupedApprovedCanonicalProducts(approved)
      if (cancelled) return

      if (deduped.error) {
        setError(getAdminErrorMessage(deduped.error))
        setLoading(false)
        return
      }

      const contentMap = {}
      for (const row of contentResult.rows ?? []) {
        if (row?.equipment_product_id) contentMap[row.equipment_product_id] = row
      }

      setContentByProductId(contentMap)
      setProducts([...(deduped.products ?? []), ...nonApproved])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const summary = useMemo(
    () => buildCatalogueSummary(products, contentByProductId),
    [products, contentByProductId],
  )

  const cards = [
    { key: CATALOGUE_ATTENTION.NEEDS_IMAGE, count: summary.missingImage, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.NEEDS_IMAGE] },
    { key: CATALOGUE_ATTENTION.NEEDS_PRICE, count: summary.missingRrp, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.NEEDS_PRICE] },
    { key: CATALOGUE_ATTENTION.NEEDS_YEAR, count: summary.missingYear, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.NEEDS_YEAR] },
    { key: CATALOGUE_ATTENTION.NEEDS_CONTENT, count: summary.missingContent, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.NEEDS_CONTENT] },
    { key: CATALOGUE_ATTENTION.FAILED_CONTENT, count: summary.failedGeneration, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.FAILED_CONTENT] },
    { key: CATALOGUE_ATTENTION.NEEDS_REVIEW, count: summary.needsReview, label: CATALOGUE_ATTENTION_LABELS[CATALOGUE_ATTENTION.NEEDS_REVIEW] },
  ]

  return (
    <div className="admin-intelligence admin-products">
      <EquipmentCatalogueNav
        title="Needs attention"
        subtitle="Catalogue gaps across images, valuation data, and content."
      />

      {loading ? <LoadingState compact>Loading catalogue gaps…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {!loading && !error ? (
        <>
          <section className="equipment-catalogue-summary" aria-label="Attention counts">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="equipment-catalogue-summary__card"
                onClick={() => navigate(buildProductsPathWithAttention(card.key))}
              >
                <span>{card.label}</span>
                <strong>{card.count}</strong>
              </button>
            ))}
          </section>

          <section className="admin-intelligence__panel">
            <h2 className="admin-intelligence__panel-title">Open incomplete products</h2>
            <p className="admin-intelligence__lead">
              {summary.needsAttention} of {summary.total} products still need work.
            </p>
            <div className="admin-intelligence__actions">
              <Link
                to={buildProductsPathWithAttention(CATALOGUE_ATTENTION.ATTENTION)}
                className="admin-intelligence__button admin-intelligence__button--primary"
              >
                View all needing attention
              </Link>
              <Link
                to="/admin/intelligence/products"
                className="admin-intelligence__button admin-intelligence__button--secondary"
              >
                All products
              </Link>
            </div>
            {summary.needsAttention === 0 ? (
              <EmptyState compact>Catalogue looks complete for the current product set.</EmptyState>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}

export default AdminEquipmentCatalogueNeedsAttentionPage
