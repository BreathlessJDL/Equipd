import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  enterImpersonationWithCustomerToken,
  searchAdminUsers,
  startAdminImpersonation,
} from '../lib/adminImpersonation'
import { formatAdminJoinedAt, formatAdminSignupName } from '../lib/adminUserStatistics'
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

  return (
    <section className="admin-intelligence admin-users">
      <header className="admin-intelligence__header">
        <h1 className="admin-intelligence__title">Users</h1>
        <p className="admin-intelligence__lead">
          Search Equipd accounts and log in as a user for support. Impersonation is audited and
          expires after 60 minutes.
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
                  <th scope="col">Name</th>
                  <th scope="col">Username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Signed up</th>
                  <th scope="col">Listings</th>
                  <th scope="col">Role</th>
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
                  return (
                    <tr key={row.id}>
                      <td data-label="Name">{name}</td>
                      <td data-label="Username">{row.username || '—'}</td>
                      <td data-label="Email" className="admin-dashboard__email">
                        {row.email || '—'}
                      </td>
                      <td data-label="Signed up">{formatAdminJoinedAt(row.createdAt)}</td>
                      <td data-label="Listings">{row.listingCount ?? 0}</td>
                      <td data-label="Role">{isAdmin ? 'Admin' : 'User'}</td>
                      <td data-label="Actions">
                        {isAdmin ? (
                          <span className="admin-users__unavailable">Unavailable</span>
                        ) : (
                          <button
                            type="button"
                            className="admin-users__login-btn"
                            onClick={() => {
                              setActionError('')
                              setConfirmUser({ ...row, _label: name })
                            }}
                            disabled={Boolean(startingId)}
                          >
                            Log in as user
                          </button>
                        )}
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
    </section>
  )
}

export default AdminUsersPage
