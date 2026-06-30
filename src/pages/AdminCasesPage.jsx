import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../components/AdminCases.css'
import '../components/AdminSupport.css'
import '../components/PageStub.css'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import {
  ADMIN_CASE_FILTERS,
  ADMIN_CASE_SORT_OPTIONS,
  fetchAdminCases,
  filterAdminCases,
  formatAdminCaseUserLabel,
  formatCaseAge,
  formatCaseReason,
  formatCaseStatusLabel,
  formatCaseTimestamp,
  formatCaseType,
  formatCaseWaitingOn,
  isCaseOverdue,
  sortAdminCases,
} from '../lib/adminCases'
import { formatOrderReference } from '../lib/orders'
import { getAdminErrorMessage } from '../lib/admin'
import { usePageTitle } from '../hooks/usePageTitle'

function AdminCaseUserCell({ displayName, email, userId }) {
  const name = displayName?.trim()
  const mail = email?.trim()

  if (name && mail) {
    return (
      <div className="admin-cases__user-cell">
        <span className="admin-cases__user-name">{name}</span>
        <span className="admin-cases__user-email">{mail}</span>
      </div>
    )
  }

  if (name) {
    return <span className="admin-cases__user-name">{name}</span>
  }

  if (mail) {
    return <span className="admin-cases__user-email">{mail}</span>
  }

  if (!userId) {
    return <span className="admin-cases__user-name">Unknown user</span>
  }

  return <span className="admin-cases__user-email">{userId.slice(0, 8)}…</span>
}

function CaseStatusBadge({ caseRow }) {
  const overdue = isCaseOverdue(caseRow)

  return (
    <span
      className={`admin-cases__badge${
        caseRow.is_active
          ? overdue
            ? ' admin-cases__badge--overdue'
            : ' admin-cases__badge--active'
          : ' admin-cases__badge--closed'
      }`}
    >
      {formatCaseStatusLabel(caseRow.case_type, caseRow.status)}
    </span>
  )
}

function AdminCaseActions({ caseRow }) {
  return (
    <div className="admin-cases__actions">
      <Link to={`/orders/${caseRow.order_id}`} className="admin-cases__action-link">
        View order
      </Link>
      <Link
        to={`/orders/${caseRow.order_id}`}
        className="admin-cases__action-link admin-cases__action-link--primary"
      >
        Manage
      </Link>
    </div>
  )
}

function AdminCasesPage() {
  usePageTitle('Admin Cases')
  const [filter, setFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState('newest')
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const visibleCases = useMemo(
    () => sortAdminCases(filterAdminCases(cases, searchQuery), sortKey),
    [cases, searchQuery, sortKey],
  )

  const loadCases = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await fetchAdminCases(filter)

    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
      setCases([])
      setLoading(false)
      return
    }

    setCases(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  return (
    <section className="admin-cases">
      <header className="admin-cases__header">
        <p className="admin-support__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-cases__title">Support cases</h1>
        <p className="admin-cases__lead">
          Buyer Protection disputes and support requests in one queue. Active cases appear first;
          older open cases are highlighted after 7 days.
        </p>
      </header>

      <div className="admin-support__filters" role="tablist" aria-label="Case filters">
        {ADMIN_CASE_FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={filter === entry.value}
            className={`admin-support__filter${
              filter === entry.value ? ' admin-support__filter--active' : ''
            }`}
            onClick={() => setFilter(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="admin-cases__toolbar">
        <label className="admin-cases__search">
          <span className="admin-cases__search-label">Search</span>
          <input
            type="search"
            className="admin-cases__search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Case/order #, buyer, seller, listing title…"
          />
        </label>

        <label className="admin-cases__sort">
          <span className="admin-cases__sort-label">Sort</span>
          <select
            className="admin-cases__sort-select"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
          >
            {ADMIN_CASE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {loading ? (
        <LoadingState compact>Loading support cases…</LoadingState>
      ) : visibleCases.length === 0 ? (
        <EmptyState compact>
          {cases.length === 0 ? 'No support cases' : 'No cases match your search'}
        </EmptyState>
      ) : (
        <>
          <div className="admin-cases__table-wrap admin-cases__desktop-only">
            <table className="admin-cases__table">
              <thead>
                <tr>
                  <th scope="col" className="admin-cases__col admin-cases__col--type admin-cases__col--sticky">
                    Type
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--status admin-cases__col--sticky">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="admin-cases__col admin-cases__col--listing admin-cases__col--sticky admin-cases__col--sticky-last"
                  >
                    Listing
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--order">
                    Order
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--buyer">
                    Buyer
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--seller">
                    Seller
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--reason">
                    Reason
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--evidence">
                    Evidence
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--opened">
                    Opened
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--updated">
                    Updated
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--age">
                    Age
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--waiting">
                    Waiting on
                  </th>
                  <th scope="col" className="admin-cases__col admin-cases__col--actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((caseRow) => (
                  <tr
                    key={`${caseRow.case_type}-${caseRow.case_id}`}
                    className={isCaseOverdue(caseRow) ? 'admin-cases__row--overdue' : undefined}
                  >
                    <td className="admin-cases__col admin-cases__col--type admin-cases__col--sticky">
                      {formatCaseType(caseRow.case_type)}
                    </td>
                    <td className="admin-cases__col admin-cases__col--status admin-cases__col--sticky">
                      <CaseStatusBadge caseRow={caseRow} />
                    </td>
                    <td className="admin-cases__col admin-cases__col--listing admin-cases__col--sticky admin-cases__col--sticky-last">
                      {caseRow.listing_title}
                    </td>
                    <td className="admin-cases__col admin-cases__col--order">
                      <Link to={`/orders/${caseRow.order_id}`} className="admin-support__link">
                        #{formatOrderReference(caseRow.order_id)}
                      </Link>
                    </td>
                    <td className="admin-cases__col admin-cases__col--buyer">
                      <AdminCaseUserCell
                        displayName={caseRow.buyer_display_name}
                        email={caseRow.buyer_email}
                        userId={caseRow.buyer_id}
                      />
                    </td>
                    <td className="admin-cases__col admin-cases__col--seller">
                      <AdminCaseUserCell
                        displayName={caseRow.seller_display_name}
                        email={caseRow.seller_email}
                        userId={caseRow.seller_id}
                      />
                    </td>
                    <td className="admin-cases__col admin-cases__col--reason">
                      {formatCaseReason(caseRow.case_type, caseRow.reason)}
                    </td>
                    <td className="admin-cases__col admin-cases__col--evidence">{caseRow.evidence_count}</td>
                    <td className="admin-cases__col admin-cases__col--opened">
                      {formatCaseTimestamp(caseRow.opened_at)}
                    </td>
                    <td className="admin-cases__col admin-cases__col--updated">
                      {formatCaseTimestamp(caseRow.updated_at)}
                    </td>
                    <td className="admin-cases__col admin-cases__col--age">{formatCaseAge(caseRow.opened_at)}</td>
                    <td className="admin-cases__col admin-cases__col--waiting">
                      {formatCaseWaitingOn(caseRow.waiting_on)}
                    </td>
                    <td className="admin-cases__col admin-cases__col--actions">
                      <AdminCaseActions caseRow={caseRow} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="admin-cases__cards admin-cases__mobile-only">
            {visibleCases.map((caseRow) => (
              <li
                key={`${caseRow.case_type}-${caseRow.case_id}-card`}
                className={`admin-cases__card${
                  isCaseOverdue(caseRow) ? ' admin-cases__card--overdue' : ''
                }`}
              >
                <div className="admin-cases__card-header">
                  <p className="admin-cases__card-type">{formatCaseType(caseRow.case_type)}</p>
                  <CaseStatusBadge caseRow={caseRow} />
                </div>

                <dl className="admin-cases__card-meta">
                  <div className="admin-cases__card-row">
                    <dt>Listing</dt>
                    <dd>{caseRow.listing_title}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Order</dt>
                    <dd>
                      <Link to={`/orders/${caseRow.order_id}`} className="admin-support__link">
                        #{formatOrderReference(caseRow.order_id)}
                      </Link>
                    </dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Buyer</dt>
                    <dd>
                      {formatAdminCaseUserLabel(
                        caseRow.buyer_display_name,
                        caseRow.buyer_email,
                        caseRow.buyer_id,
                      )}
                    </dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Seller</dt>
                    <dd>
                      {formatAdminCaseUserLabel(
                        caseRow.seller_display_name,
                        caseRow.seller_email,
                        caseRow.seller_id,
                      )}
                    </dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Reason</dt>
                    <dd>{formatCaseReason(caseRow.case_type, caseRow.reason)}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Evidence</dt>
                    <dd>{caseRow.evidence_count}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Opened</dt>
                    <dd>{formatCaseTimestamp(caseRow.opened_at)}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Updated</dt>
                    <dd>{formatCaseTimestamp(caseRow.updated_at)}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Age</dt>
                    <dd>{formatCaseAge(caseRow.opened_at)}</dd>
                  </div>
                  <div className="admin-cases__card-row">
                    <dt>Waiting on</dt>
                    <dd>{formatCaseWaitingOn(caseRow.waiting_on)}</dd>
                  </div>
                </dl>

                <AdminCaseActions caseRow={caseRow} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default AdminCasesPage
