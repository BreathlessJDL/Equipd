import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  COMPLETION_DASHBOARD_FILTER,
  buildCanonicalProductCompletionStats,
} from '../../lib/canonicalProductCompletionStats.js'
import { CANONICAL_COMPLETION_STATUS, deriveCanonicalProductCompletionStatus, formatCanonicalProductCompletionLabel } from '../../lib/equipmentResearchQueue.js'
import './CanonicalProductCompletionDashboard.css'

function CompletionStatusBadge({ status }) {
  const className = [
    'canonical-completion__badge',
    status === CANONICAL_COMPLETION_STATUS.COMPLETE ? 'canonical-completion__badge--complete' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_PRICE ? 'canonical-completion__badge--missing-price' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BASELINE ? 'canonical-completion__badge--missing-baseline' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH ? 'canonical-completion__badge--missing-both' : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={className}>
      {formatCanonicalProductCompletionLabel(status)}
    </span>
  )
}

function ProgressBar({ percentage }) {
  const value = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0
  return (
    <div className="canonical-completion__progress">
      <div className="canonical-completion__progress-track" aria-hidden="true">
        <div className="canonical-completion__progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="canonical-completion__progress-label">{value}%</span>
    </div>
  )
}

function buildProductsPageLink({ completionFilter, brand, equipmentType } = {}) {
  const params = new URLSearchParams()
  params.set('status', 'approved')
  if (completionFilter && completionFilter !== COMPLETION_DASHBOARD_FILTER.ALL) {
    params.set('completion', completionFilter)
  }
  if (brand) params.set('brand', brand)
  if (equipmentType) params.set('equipmentType', equipmentType)
  return `/admin/intelligence/products?${params.toString()}`
}

export default function CanonicalProductCompletionDashboard({
  products = [],
  statsOverride = null,
  variant = 'full',
  filters,
  onFiltersChange,
  onExportCompleted,
  onExportIncomplete,
  onOpenTop100,
  exporting = false,
  exportIncompleteDisabled = false,
  exportCompletedDisabled = false,
}) {
  const stats = useMemo(
    () => statsOverride ?? buildCanonicalProductCompletionStats(products, filters),
    [statsOverride, products, filters],
  )

  const incompleteScopeProducts = useMemo(
    () => (stats.scopeProducts ?? []).filter((product) => {
      const status = deriveCanonicalProductCompletionStatus(product)
      return status && status !== CANONICAL_COMPLETION_STATUS.COMPLETE
    }),
    [stats.scopeProducts],
  )

  const completedScopeProducts = useMemo(
    () => (stats.scopeProducts ?? []).filter((product) => deriveCanonicalProductCompletionStatus(product)
      === CANONICAL_COMPLETION_STATUS.COMPLETE),
    [stats.scopeProducts],
  )

  const isCompact = variant === 'compact'

  return (
    <section
      className={`admin-intelligence__panel canonical-completion${isCompact ? ' canonical-completion--compact' : ''}`}
      aria-labelledby={isCompact ? 'canonical-completion-compact-title' : 'canonical-completion-title'}
    >
      <div className="canonical-completion__header">
        <div>
          <h2
            id={isCompact ? 'canonical-completion-compact-title' : 'canonical-completion-title'}
            className="canonical-completion__title"
          >
            Canonical product completion
          </h2>
          {!isCompact ? (
            <p className="canonical-completion__lead">
              Approved products with original base price and valid baseline manufacture year are complete.
            </p>
          ) : null}
        </div>
        {!isCompact ? (
          <Link
            to="/admin/intelligence/products"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            All products
          </Link>
        ) : (
          <Link
            to="/admin/intelligence/original-prices-lifecycle"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            Full dashboard
          </Link>
        )}
      </div>

      <div className="canonical-completion__stats">
        <div className="canonical-completion__stat">
          <span>Total approved</span>
          <strong>{stats.overall.totalApproved}</strong>
        </div>
        <div className="canonical-completion__stat canonical-completion__stat--ok">
          <span>Completed</span>
          <strong>{stats.overall.completed}</strong>
        </div>
        <div className="canonical-completion__stat canonical-completion__stat--warn">
          <span>Incomplete</span>
          <strong>{stats.overall.incomplete}</strong>
        </div>
        <div className="canonical-completion__stat canonical-completion__stat--ok">
          <span>Completion</span>
          <strong>{stats.overall.completionPercentage}%</strong>
        </div>
      </div>

      {!isCompact ? (
        <>
          <div className="canonical-completion__breakdown" aria-label="Incomplete breakdown">
            <CompletionStatusBadge status={CANONICAL_COMPLETION_STATUS.MISSING_PRICE} />
            <span>{stats.overall.breakdown.missingPriceOnly}</span>
            <CompletionStatusBadge status={CANONICAL_COMPLETION_STATUS.MISSING_BASELINE} />
            <span>{stats.overall.breakdown.missingBaselineOnly}</span>
            <CompletionStatusBadge status={CANONICAL_COMPLETION_STATUS.MISSING_BOTH} />
            <span>{stats.overall.breakdown.missingBoth}</span>
          </div>

          <div className="canonical-completion__filters">
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Brand</span>
              <select
                className="admin-intelligence__select"
                value={filters.brand}
                onChange={(event) => onFiltersChange({ brand: event.target.value })}
              >
                <option value="">All brands</option>
                {stats.filterOptions.brands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </label>
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Equipment type</span>
              <select
                className="admin-intelligence__select"
                value={filters.equipmentType}
                onChange={(event) => onFiltersChange({ equipmentType: event.target.value })}
              >
                <option value="">All types</option>
                {stats.filterOptions.equipmentTypes.map((equipmentType) => (
                  <option key={equipmentType} value={equipmentType}>{equipmentType}</option>
                ))}
              </select>
            </label>
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Completion</span>
              <select
                className="admin-intelligence__select"
                value={filters.completionFilter}
                onChange={(event) => onFiltersChange({ completionFilter: event.target.value })}
              >
                <option value={COMPLETION_DASHBOARD_FILTER.ALL}>All</option>
                <option value={COMPLETION_DASHBOARD_FILTER.COMPLETE}>Complete</option>
                <option value={COMPLETION_DASHBOARD_FILTER.INCOMPLETE}>Incomplete</option>
                <option value={COMPLETION_DASHBOARD_FILTER.MISSING_PRICE}>Missing price</option>
                <option value={COMPLETION_DASHBOARD_FILTER.MISSING_BASELINE}>Missing baseline</option>
                <option value={COMPLETION_DASHBOARD_FILTER.MISSING_BOTH}>Missing both</option>
              </select>
            </label>
          </div>
        </>
      ) : null}

      <div className="canonical-completion__actions">
        <Link
          to={buildProductsPageLink({
            completionFilter: COMPLETION_DASHBOARD_FILTER.INCOMPLETE,
            brand: filters.brand,
            equipmentType: filters.equipmentType,
          })}
          className="admin-intelligence__button admin-intelligence__button--secondary"
        >
          View incomplete products
        </Link>
        <button
          type="button"
          className="admin-intelligence__button admin-intelligence__button--secondary"
          disabled={
            exporting
            || exportIncompleteDisabled
            || (
              !statsOverride
              && incompleteScopeProducts.length === 0
            )
            || (
              statsOverride
              && !(stats.overall?.incomplete > 0)
            )
          }
          onClick={() => onExportIncomplete?.(incompleteScopeProducts)}
        >
          {exporting ? 'Exporting…' : 'Export incomplete'}
        </button>
        <button
          type="button"
          className="admin-intelligence__button admin-intelligence__button--secondary"
          disabled={
            exporting
            || exportCompletedDisabled
            || (
              !statsOverride
              && completedScopeProducts.length === 0
            )
            || (
              statsOverride
              && !(stats.overall?.completed > 0)
            )
          }
          onClick={() => onExportCompleted?.(completedScopeProducts)}
        >
          Export completed
        </button>
        {!isCompact && onOpenTop100 ? (
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onOpenTop100}
          >
            Open Top 100 incomplete queue
          </button>
        ) : null}
      </div>

      <div className="admin-intelligence__table-wrap canonical-completion__brand-table-wrap">
        <table className="admin-intelligence__table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Approved</th>
              <th>Completed</th>
              <th>Incomplete</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {(isCompact ? stats.byBrand.slice(0, 5) : stats.byBrand).map((entry) => (
              <tr key={entry.brand}>
                <td>{entry.brand}</td>
                <td>{entry.totalApproved}</td>
                <td>{entry.completed}</td>
                <td>{entry.incomplete}</td>
                <td>
                  <ProgressBar percentage={entry.completionPercentage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isCompact && stats.byBrand.length > 5 ? (
        <p className="canonical-completion__lead">
          Showing top 5 brands by incomplete count. Open the full dashboard for all brands and filters.
        </p>
      ) : null}
    </section>
  )
}
