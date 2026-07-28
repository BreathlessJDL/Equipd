import { useCallback, useEffect, useState } from 'react'
import { HubEmptyState } from '../hub/HubEmptyState'
import { HubSectionTabs } from '../hub/HubLayout'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import {
  WANTED_REQUEST_ACCOUNT_FILTERS,
  WANTED_REQUEST_CONDITION_OPTIONS,
  WANTED_REQUEST_RADIUS_OPTIONS,
  WANTED_REQUEST_SOURCES,
} from '../../lib/wantedRequestConstants'
import {
  cancelMyWantedRequest,
  listMyWantedRequests,
} from '../../lib/wantedRequests'
import { useWantedRequest } from './useWantedRequest'
import './WantedRequestsHubSection.css'

const FILTER_TABS = Object.fromEntries(
  WANTED_REQUEST_ACCOUNT_FILTERS.map((entry) => [entry.id, { id: entry.id, label: entry.label }]),
)

function formatBudgetPence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) return null
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(pence) / 100)
}

function formatRadiusLabel(row) {
  const criteriaRadius = row?.criteria?.radius
  if (criteriaRadius) {
    const match = WANTED_REQUEST_RADIUS_OPTIONS.find((option) => option.value === String(criteriaRadius))
    if (match) return match.label
    if (String(criteriaRadius) === 'nationwide') return 'Nationwide'
  }
  if (row?.radius_km == null) return 'Nationwide'
  const miles = Math.round(Number(row.radius_km) / 1.60934)
  return `${miles} miles`
}

function formatConditionLabel(row) {
  const key = String(row?.criteria?.conditionPreference ?? 'any')
  return (
    WANTED_REQUEST_CONDITION_OPTIONS.find((option) => option.value === key)?.label || 'Any'
  )
}

function statusLabel(status) {
  if (status === 'fulfilled') return 'Match found'
  if (status === 'archived' || status === 'paused') return 'Expired'
  return 'Active'
}

function WantedRequestsHubSection() {
  const { openWantedRequest } = useWantedRequest()
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState('')

  const refresh = useCallback(async (statusFilter = filter) => {
    const result = await listMyWantedRequests({ status: statusFilter })
    if (!result.ok) {
      setError(result.error || 'Failed to load wanted requests')
      setRows([])
      setLoading(false)
      return
    }
    setError('')
    setRows(result.rows)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    let cancelled = false

    listMyWantedRequests({ status: filter }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error || 'Failed to load wanted requests')
        setRows([])
        setLoading(false)
        return
      }
      setError('')
      setRows(result.rows)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [filter])

  function handleFilterChange(nextFilter) {
    setFilter(nextFilter)
    setLoading(true)
    setError('')
  }

  async function handleCancel(requestId) {
    setCancellingId(requestId)
    const result = await cancelMyWantedRequest(requestId)
    setCancellingId('')
    if (!result.ok) {
      setError(result.error || 'Failed to cancel request')
      return
    }
    setLoading(true)
    await refresh(filter)
  }

  return (
    <div className="hub-panel wanted-requests-hub">
      <header className="hub-panel__header">
        <div>
          <h3 className="hub-panel__title">My Wanted Equipment</h3>
          <p className="hub-panel__lead">
            Track equipment you&apos;ve requested. We&apos;ll notify you when matching listings
            become available.
          </p>
        </div>
        <button
          type="button"
          className="wanted-requests-hub__new"
          onClick={(event) =>
            openWantedRequest({
              source: WANTED_REQUEST_SOURCES.BUYER_DASHBOARD,
              triggerElement: event.currentTarget,
            })
          }
        >
          New request
        </button>
      </header>

      <HubSectionTabs
        tabs={FILTER_TABS}
        activeTab={filter}
        onChange={handleFilterChange}
        ariaLabel="Wanted request filters"
      />

      {error ? (
        <p className="wanted-requests-hub__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="wanted-requests-hub__loading">Loading your wanted requests…</p>
      ) : rows.length === 0 ? (
        <div className="wanted-requests-hub__empty">
          <HubEmptyState
            variant={EQUIPD_ICON_VARIANT.BUYING_BAG}
            title="You haven’t created any wanted requests yet"
            description="Tell us what equipment you’re looking for and we’ll notify you when a match becomes available."
          />
          <button
            type="button"
            className="wanted-requests-hub__empty-cta"
            onClick={(event) =>
              openWantedRequest({
                source: WANTED_REQUEST_SOURCES.BUYER_DASHBOARD,
                triggerElement: event.currentTarget,
              })
            }
          >
            Create a wanted request
          </button>
        </div>
      ) : (
        <ul className="wanted-requests-hub__list">
          {rows.map((row) => {
            const budget = formatBudgetPence(row.max_price_pence)
            const radius = formatRadiusLabel(row)
            const condition = formatConditionLabel(row)
            const isActive = row.status === 'active'

            return (
              <li key={row.id} className="wanted-requests-hub__item">
                <div className="wanted-requests-hub__item-main">
                  <div className="wanted-requests-hub__item-heading">
                    <h4 className="wanted-requests-hub__item-title">{row.title}</h4>
                    <span className={`wanted-requests-hub__status wanted-requests-hub__status--${row.status}`}>
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <p className="wanted-requests-hub__item-meta">
                    {[row.location || null, radius, condition, budget ? `Up to ${budget}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {isActive ? (
                  <button
                    type="button"
                    className="wanted-requests-hub__cancel"
                    disabled={cancellingId === row.id}
                    onClick={() => handleCancel(row.id)}
                  >
                    {cancellingId === row.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default WantedRequestsHubSection
