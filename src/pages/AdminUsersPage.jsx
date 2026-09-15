import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  enterImpersonationWithCustomerToken,
  searchAdminUsers,
  startAdminImpersonation,
} from '../lib/adminImpersonation'
import { suspendUser, unsuspendUser } from '../lib/adminModeration'
import { formatAdminJoinedAt, formatAdminSignupName } from '../lib/adminUserStatistics'
import { formatAdminActivityClass } from '../lib/adminMarketplaceActivity'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminUsersPage.css'

function AdminUsersPage() {
  usePageTitle('Admin users')
  const navigate = useNavigate()
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmUser, setConfirmUser] = useState(null)
  const [startingId, setStartingId] = useState('')
  const [actionError, setActionError] = useState('')
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(queryInput.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [queryInput])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await searchAdminUsers(query, 50)
      if (!active) return
      if (fetchError) {
        setError(getAdminErrorMessage(fetchError))
        setItems([])
      } else {
        setItems(data.items)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [query])

  async function handleConfirmLogin() {
    if (!confirmUser || startingId) return
    setActionError('')
    setStartingId(confirmUser.id)

    const { data, error: startError } = await startAdminImpersonation(confirmUser.id)
    if (startError || !data?.customerHashedToken) {
      setActionError(startError?.message || 'Could not start impersonation.')
      setStartingId('')
      return
    }

    const { error: enterError } = await enterImpersonationWithCustomerToken({
      customerHashedToken: data.customerHashedToken,
      adminRestoreHashedToken: data.adminRestoreHashedToken,
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      target: data.target,
      adminUserId: data.adminUserId,
    })

    if (enterError) {
      setActionError(enterError.message || 'Could not enter impersonation.')
      setStartingId('')
      return
    }

    setConfirmUser(null)
    navigate('/my-listings', { replace: true })
  }

  async function handleConfirmSuspend() {
    if (!suspendTarget || busyId) return
    setBusyId(suspendTarget.id)
    setActionError('')
    const { error: suspendError, warning } = await suspendUser(suspendTarget.id, suspendReason)
    setBusyId('')
    if (suspendError) {
      setActionError(getAdminErrorMessage(suspendError))
      return
    }
    if (warning) {
      setActionError(warning)
    }
    setSuspendTarget(null)
    setSuspendReason('')
    setLoading(true)
    const { data, error: fetchError } = await searchAdminUsers(query, 50)
    setLoading(false)
    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
      return
    }
    setItems(data.items)
  }

  async function handleUnsuspend(userId) {
    if (!userId || busyId) return
    setBusyId(userId)
    setActionError('')
    const { error: unsuspendError, warning } = await unsuspendUser(userId, 'Admin unsuspend')
    setBusyId('')
    if (unsuspendError) {
      setActionError(getAdminErrorMessage(unsuspendError))
      return
    }
    if (warning) {
      setActionError(warning)
    }
    const { data, error: fetchError } = await searchAdminUsers(query, 50)
    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
      return
    }
    setItems(data.items)
  }

  return (
    <section className="admin-intelligence admin-users">
      <header className="admin-intelligence__header">
        <h1 className="admin-intelligence__title">Users</h1>
        <p className="admin-intelligence__lead">
          Search Equipd accounts, review marketplace activity, and log in as a user for support.
          Impersonation is audited and expires after 60 minutes.
        </p>
      </header>

      <section className="admin-intelligence__panel" aria-labelledby="admin-users-search-heading">
        <h2 id="admin-users-search-heading" className="admin-intelligence__panel-title">
          Search users
        </h2>
        <label className="admin-users__search-label" htmlFor="admin-users-search">
          Search by name, username, or email
        </label>
        <input
          id="admin-users-search"
          className="admin-users__search"
          type="search"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Name, username, or email"
          autoComplete="off"
        />

        {actionError ? (
          <p className="admin-users__action-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {loading ? <LoadingState compact>Loading users…</LoadingState> : null}
        {!loading && error ? <ErrorState compact>{error}</ErrorState> : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState compact>No users matched that search.</EmptyState>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="admin-users__table-wrap">
            <table className="admin-dashboard__table admin-users__table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Listings</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Offers made</th>
                  <th scope="col">Offers received</th>
                  <th scope="col">Conversations</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const name =
                    row.displayName?.trim() ||
                    row.username?.trim() ||
                    formatAdminSignupName(row)
                  const isAdmin = row.isAdmin === true
                  const isSuspended = row.isSuspended === true
                  const isOfficial = row.isOfficialEquipd === true
                  const activityClass = row.activityClass || 'none'
                  return (
                    <tr key={row.id}>
                      <td data-label="User">
                        <div>
                          <Link
                            className="admin-users__link admin-users__view-link"
                            to={`/admin/users/${row.id}`}
                          >
                            {row.username || name}
                          </Link>
                        </div>
                        <div className="admin-dashboard__email">{row.email || '—'}</div>
                        <div className="admin-users__meta">
                          {formatAdminJoinedAt(row.createdAt)}
                          {isOfficial ? ' · Official' : isAdmin ? ' · Admin' : ''}
                        </div>
                      </td>
                      <td data-label="Listings" className="admin-users__metric-cell">
                        {row.listingCount ?? 0}
                      </td>
                      <td data-label="Saved" className="admin-users__metric-cell">
                        {row.savedCount ?? 0}
                      </td>
                      <td data-label="Offers made" className="admin-users__metric-cell">
                        {row.offersMadeCount ?? 0}
                      </td>
                      <td data-label="Offers received" className="admin-users__metric-cell">
                        {row.offersReceivedCount ?? 0}
                      </td>
                      <td data-label="Conversations" className="admin-users__metric-cell">
                        {row.conversationCount ?? 0}
                      </td>
                      <td data-label="Activity">
                        <span className={`admin-users__activity admin-users__activity--${activityClass}`}>
                          {formatAdminActivityClass(activityClass)}
                        </span>
                      </td>
                      <td data-label="Status">
                        {isSuspended ? (
                          <span className="admin-users__badge admin-users__badge--suspended">
                            SUSPENDED
                          </span>
                        ) : (
                          'Active'
                        )}
                      </td>
                      <td data-label="Actions">
                        <div className="admin-users__actions">
                          <Link
                            className="admin-users__link"
                            to={`/admin/users/${row.id}`}
                          >
                            Activity
                          </Link>
                          <Link className="admin-users__link" to={`/admin/trust-safety`}>
                            Investigate
                          </Link>
                          {isAdmin || isOfficial ? (
                            <span className="admin-users__unavailable">Unavailable</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="admin-users__login-btn"
                                onClick={() => {
                                  setActionError('')
                                  setConfirmUser({ ...row, _label: name })
                                }}
                                disabled={Boolean(startingId) || isSuspended}
                              >
                                Log in as user
                              </button>
                              {isSuspended ? (
                                <button
                                  type="button"
                                  className="admin-users__login-btn"
                                  onClick={() => handleUnsuspend(row.id)}
                                  disabled={busyId === row.id}
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-users__danger-btn"
                                  onClick={() =>
                                    setSuspendTarget({ id: row.id, label: name })
                                  }
                                  disabled={busyId === row.id}
                                >
                                  Suspend
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {confirmUser ? (
        <div className="admin-users__dialog-backdrop" role="presentation">
          <div
            className="admin-users__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-users-confirm-title"
          >
            <h2 id="admin-users-confirm-title" className="admin-users__dialog-title">
              Log in as {confirmUser._label || formatAdminSignupName(confirmUser)}?
            </h2>
            <p className="admin-users__dialog-copy">
              You will temporarily operate Equipd using this user&apos;s account. Actions run as
              their identity under normal permissions. Impersonation is audited and expires after
              60 minutes.
            </p>
            <div className="admin-users__dialog-actions">
              <button
                type="button"
                className="admin-users__dialog-cancel"
                onClick={() => setConfirmUser(null)}
                disabled={Boolean(startingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-users__login-btn"
                onClick={handleConfirmLogin}
                disabled={Boolean(startingId)}
              >
                {startingId === confirmUser.id ? 'Starting…' : 'Log in as user'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {suspendTarget ? (
        <div className="admin-users__dialog-backdrop" role="presentation">
          <div className="admin-users__dialog" role="dialog" aria-modal="true">
            <h2 className="admin-users__dialog-title">Suspend {suspendTarget.label}?</h2>
            <p className="admin-users__dialog-copy">
              They will lose messaging, listing, offer and profile edit access immediately. Existing
              data remains available for investigation.
            </p>
            <label className="admin-users__search-label" htmlFor="admin-users-suspend-reason">
              Reason
            </label>
            <textarea
              id="admin-users-suspend-reason"
              className="admin-users__search"
              rows={3}
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
            />
            <div className="admin-users__dialog-actions">
              <button
                type="button"
                className="admin-users__dialog-cancel"
                onClick={() => setSuspendTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-users__danger-btn"
                onClick={handleConfirmSuspend}
                disabled={Boolean(busyId)}
              >
                {busyId ? 'Suspending…' : 'Confirm suspend'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default AdminUsersPage
