import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage, fetchAdminReports, updateReportStatus } from '../lib/admin'
import {
  contactedUsersToCsv,
  fetchHighVolumeNewConversationAccounts,
  fetchSuspiciousMessageFlags,
  fetchSuspendedUsers,
  fetchUsersContactedBy,
  fetchAdminUserModerationSummary,
  suspendUser,
  unsuspendUser,
} from '../lib/adminModeration'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminUsersPage.css'

function AdminTrustSafetyPage() {
  usePageTitle('Trust & Safety')
  const [tab, setTab] = useState('reports')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reports, setReports] = useState([])
  const [flags, setFlags] = useState([])
  const [suspended, setSuspended] = useState([])
  const [highVolume, setHighVolume] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [summary, setSummary] = useState(null)
  const [contacted, setContacted] = useState([])
  const [actionError, setActionError] = useState('')
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const [reportsRes, flagsRes, suspendedRes, volumeRes] = await Promise.all([
      fetchAdminReports('open'),
      fetchSuspiciousMessageFlags({ status: 'open', limit: 50 }),
      fetchSuspendedUsers(50),
      fetchHighVolumeNewConversationAccounts({ hours: 24, minConversations: 8, limit: 50 }),
    ])

    if (reportsRes.error || flagsRes.error || suspendedRes.error || volumeRes.error) {
      setError(
        getAdminErrorMessage(
          reportsRes.error || flagsRes.error || suspendedRes.error || volumeRes.error,
        ),
      )
      setLoading(false)
      return
    }

    setReports(Array.isArray(reportsRes.data) ? reportsRes.data : [])
    setFlags(flagsRes.data || [])
    setSuspended(suspendedRes.data || [])
    setHighVolume(volumeRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let active = true
    async function loadUser() {
      if (!selectedUserId) {
        setSummary(null)
        setContacted([])
        return
      }
      const [summaryRes, contactedRes] = await Promise.all([
        fetchAdminUserModerationSummary(selectedUserId),
        fetchUsersContactedBy(selectedUserId),
      ])
      if (!active) return
      if (summaryRes.error) {
        setActionError(getAdminErrorMessage(summaryRes.error))
        return
      }
      setSummary(summaryRes.data)
      setContacted(contactedRes.data || [])
    }
    loadUser()
    return () => {
      active = false
    }
  }, [selectedUserId])

  const tabs = useMemo(
    () => [
      { id: 'reports', label: 'Open reports' },
      { id: 'flags', label: 'Suspicious messages' },
      { id: 'suspended', label: 'Suspended users' },
      { id: 'volume', label: 'High-volume outreach' },
    ],
    [],
  )

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
    await load()
    if (selectedUserId === suspendTarget.id) {
      setSelectedUserId(suspendTarget.id)
    }
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
    await load()
  }

  async function handleResolveReport(reportId, status) {
    if (!reportId || busyId) return
    setBusyId(reportId)
    setActionError('')
    const { error: resolveError } = await updateReportStatus({
      reportId,
      status,
      adminNote: status === 'resolved' ? 'Resolved from Trust & Safety' : 'Dismissed from Trust & Safety',
    })
    setBusyId('')
    if (resolveError) {
      setActionError(getAdminErrorMessage(resolveError))
      return
    }
    await load()
  }

  function downloadContactedCsv() {
    const csv = contactedUsersToCsv(contacted)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `equipd-contacted-users-${selectedUserId}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="admin-intelligence admin-users">
      <header className="admin-intelligence__header">
        <h1 className="admin-intelligence__title">Trust &amp; Safety</h1>
        <p className="admin-intelligence__lead">
          Review reports, suspicious message flags, suspensions, and high-volume outreach.
        </p>
      </header>

      <div className="admin-users__tabs" role="tablist" aria-label="Trust and safety sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`admin-users__tab${tab === item.id ? ' admin-users__tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {actionError ? (
        <p className="admin-users__action-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? <LoadingState>Loading moderation data…</LoadingState> : null}
      {!loading && error ? <ErrorState>{error}</ErrorState> : null}

      {!loading && !error && tab === 'reports' ? (
        <section className="admin-intelligence__panel">
          {reports.length === 0 ? <EmptyState compact>No open reports.</EmptyState> : null}
          {reports.length > 0 ? (
            <div className="admin-users__table-wrap">
              <table className="admin-dashboard__table admin-users__table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Reported user</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((row) => (
                    <tr key={row.id}>
                      <td>{row.report_type || row.reportType || '—'}</td>
                      <td>{row.reason || '—'}</td>
                      <td>{row.reported_user_id || row.reportedUserId || '—'}</td>
                      <td>
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td>
                        <div className="admin-users__actions">
                          <button
                            type="button"
                            className="admin-users__login-btn"
                            onClick={() =>
                              setSelectedUserId(row.reported_user_id || row.reportedUserId || '')
                            }
                          >
                            Investigate
                          </button>
                          {row.conversation_id || row.conversationId ? (
                            <Link
                              className="admin-users__link"
                              to={`/admin/messages/${row.conversation_id || row.conversationId}`}
                            >
                              Open conversation
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            className="admin-users__login-btn"
                            disabled={busyId === row.id}
                            onClick={() => handleResolveReport(row.id, 'resolved')}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="admin-users__dialog-cancel"
                            disabled={busyId === row.id}
                            onClick={() => handleResolveReport(row.id, 'dismissed')}
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && tab === 'flags' ? (
        <section className="admin-intelligence__panel">
          {flags.length === 0 ? (
            <EmptyState compact>No open suspicious message flags.</EmptyState>
          ) : null}
          {flags.length > 0 ? (
            <div className="admin-users__table-wrap">
              <table className="admin-dashboard__table admin-users__table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Rule</th>
                    <th scope="col">Score</th>
                    <th scope="col">Snippet</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((row) => (
                    <tr key={row.id}>
                      <td>{row.username || row.display_name || row.user_id}</td>
                      <td>{row.rule_key}</td>
                      <td>{row.score}</td>
                      <td>{row.snippet || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-users__login-btn"
                          onClick={() => setSelectedUserId(row.user_id)}
                        >
                          Investigate
                        </button>
                        {row.conversation_id ? (
                          <Link
                            className="admin-users__link"
                            to={`/admin/messages/${row.conversation_id}`}
                          >
                            Open conversation
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && tab === 'suspended' ? (
        <section className="admin-intelligence__panel">
          {suspended.length === 0 ? <EmptyState compact>No suspended users.</EmptyState> : null}
          {suspended.length > 0 ? (
            <div className="admin-users__table-wrap">
              <table className="admin-dashboard__table admin-users__table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Email</th>
                    <th scope="col">Suspended</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suspended.map((row) => (
                    <tr key={row.id}>
                      <td>{row.username || row.display_name || row.id}</td>
                      <td>{row.email || '—'}</td>
                      <td>
                        {row.suspended_at
                          ? new Date(row.suspended_at).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td>{row.suspension_reason || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-users__login-btn"
                          onClick={() => handleUnsuspend(row.id)}
                          disabled={busyId === row.id}
                        >
                          {busyId === row.id ? 'Working…' : 'Unsuspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && tab === 'volume' ? (
        <section className="admin-intelligence__panel">
          {highVolume.length === 0 ? (
            <EmptyState compact>No high-volume new-conversation accounts in the last 24h.</EmptyState>
          ) : null}
          {highVolume.length > 0 ? (
            <div className="admin-users__table-wrap">
              <table className="admin-dashboard__table admin-users__table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Email</th>
                    <th scope="col">Account created</th>
                    <th scope="col">Conversations</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {highVolume.map((row) => (
                    <tr key={row.id}>
                      <td>{row.username || row.display_name || row.id}</td>
                      <td>{row.email || '—'}</td>
                      <td>
                        {row.account_created_at
                          ? new Date(row.account_created_at).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td>{row.conversation_count}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-users__login-btn"
                          onClick={() => setSelectedUserId(row.id)}
                        >
                          Investigate
                        </button>
                        <button
                          type="button"
                          className="admin-users__danger-btn"
                          onClick={() =>
                            setSuspendTarget({
                              id: row.id,
                              label: row.username || row.display_name || row.email || row.id,
                            })
                          }
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {summary ? (
        <section className="admin-intelligence__panel" aria-label="User investigation">
          <h2 className="admin-intelligence__panel-title">Investigation</h2>
          <dl className="admin-users__summary">
            <div>
              <dt>User ID</dt>
              <dd>{summary.id}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{summary.username || '—'}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{summary.displayName || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{summary.email || '—'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                {summary.createdAt ? new Date(summary.createdAt).toLocaleString('en-GB') : '—'}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {summary.isSuspended ? 'SUSPENDED' : 'Active'}
                {summary.isOfficialEquipd ? ' · Official Equipd' : ''}
                {summary.isAdmin ? ' · Admin' : ''}
              </dd>
            </div>
            <div>
              <dt>Listings</dt>
              <dd>
                {summary.listingCount} total / {summary.activeListingCount} active
              </dd>
            </div>
            <div>
              <dt>Conversations / messages</dt>
              <dd>
                {summary.conversationCount} / {summary.messageCount}
              </dd>
            </div>
            <div>
              <dt>Unique users contacted</dt>
              <dd>{summary.uniqueUsersContacted}</dd>
            </div>
            <div>
              <dt>Open reports / flags</dt>
              <dd>
                {summary.openReportCount} / {summary.openSuspiciousFlagCount}
              </dd>
            </div>
          </dl>

          <div className="admin-users__dialog-actions">
            {!summary.isSuspended && !summary.isAdmin && !summary.isOfficialEquipd ? (
              <button
                type="button"
                className="admin-users__danger-btn"
                onClick={() =>
                  setSuspendTarget({
                    id: summary.id,
                    label: summary.username || summary.displayName || summary.email || summary.id,
                  })
                }
              >
                Suspend user
              </button>
            ) : null}
            {summary.isSuspended ? (
              <button
                type="button"
                className="admin-users__login-btn"
                onClick={() => handleUnsuspend(summary.id)}
              >
                Unsuspend user
              </button>
            ) : null}
            <button type="button" className="admin-users__dialog-cancel" onClick={downloadContactedCsv}>
              Export contacted users CSV
            </button>
          </div>

          <h3 className="admin-intelligence__panel-title">Users contacted</h3>
          {contacted.length === 0 ? (
            <EmptyState compact>No conversations found for this user.</EmptyState>
          ) : (
            <div className="admin-users__table-wrap">
              <table className="admin-dashboard__table admin-users__table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Email</th>
                    <th scope="col">First contact</th>
                    <th scope="col">Latest</th>
                    <th scope="col">Messages sent</th>
                    <th scope="col">Conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {contacted.map((row) => (
                    <tr key={`${row.conversation_id}-${row.contacted_user_id}`}>
                      <td>{row.username || row.display_name || row.contacted_user_id}</td>
                      <td>{row.email || '—'}</td>
                      <td>
                        {row.first_contact_at
                          ? new Date(row.first_contact_at).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td>
                        {row.last_contact_at
                          ? new Date(row.last_contact_at).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td>{row.messages_sent_by_user}</td>
                      <td>
                        <Link to={`/admin/messages/${row.conversation_id}`}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {suspendTarget ? (
        <div className="admin-users__dialog-backdrop" role="presentation">
          <div className="admin-users__dialog" role="dialog" aria-modal="true">
            <h2 className="admin-users__dialog-title">Suspend {suspendTarget.label}?</h2>
            <p className="admin-users__dialog-copy">
              They will immediately lose access to messaging, listings, offers, profile edits and
              marketplace purchases. Existing data is retained for investigation.
            </p>
            <label className="admin-users__search-label" htmlFor="suspend-reason">
              Reason
            </label>
            <textarea
              id="suspend-reason"
              className="admin-users__search"
              rows={3}
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              placeholder="Scam / impersonation / suspicious payment request"
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

export default AdminTrustSafetyPage
