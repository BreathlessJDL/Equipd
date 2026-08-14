import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { fetchAdminUserStatistics } from '../lib/admin'
import {
  formatAdminJoinedAt,
  formatAdminSignupName,
} from '../lib/adminUserStatistics'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminDashboard.css'

const USER_STAT_CARDS = [
  { key: 'totalUsers', label: 'Total users' },
  { key: 'newToday', label: 'New today' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'last30Days', label: 'Last 30 days' },
  { key: 'usersWhoHaveListed', label: 'Users who have listed' },
]

function AdminDashboardPage() {
  usePageTitle('Admin Dashboard')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadStats() {
      const { data, error: fetchError } = await fetchAdminUserStatistics()
      if (!active) return

      if (fetchError) {
        console.error('[admin-user-stats] failed to load user statistics')
        setError('Unable to load user statistics.')
        setStats(null)
      } else {
        setError('')
        setStats(data)
      }
      setLoading(false)
    }

    loadStats()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="admin-intelligence admin-dashboard">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-intelligence__title">Dashboard</h1>
        <p className="admin-intelligence__lead">
          A quick view of Equipd user growth from existing account data.
        </p>
      </header>

      <section className="admin-intelligence__panel" aria-labelledby="admin-user-stats-heading">
        <h2 id="admin-user-stats-heading" className="admin-intelligence__panel-title">
          Users
        </h2>

        {loading ? <LoadingState compact>Loading user statistics…</LoadingState> : null}
        {error ? <ErrorState compact>{error}</ErrorState> : null}

        {!loading && !error && stats ? (
          <>
            <div className="admin-intelligence__stats" aria-label="User statistics">
              {USER_STAT_CARDS.map((card) => (
                <div key={card.key} className="admin-intelligence__stat">
                  <span>{card.label}</span>
                  <strong>{stats[card.key]}</strong>
                </div>
              ))}
            </div>

            <div className="admin-dashboard__signups">
              <h3 className="admin-dashboard__signups-title">Latest sign-ups</h3>
              {stats.latestSignups.length === 0 ? (
                <EmptyState compact>No registered users yet.</EmptyState>
              ) : (
                <div className="admin-intelligence__table-wrap">
                  <table className="admin-intelligence__table admin-dashboard__table">
                    <thead>
                      <tr>
                        <th scope="col">User</th>
                        <th scope="col">Email</th>
                        <th scope="col">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.latestSignups.map((signup) => (
                        <tr key={signup.id ?? `${signup.username}-${signup.createdAt}`}>
                          <td>{formatAdminSignupName(signup)}</td>
                          <td className="admin-dashboard__email">{signup.email || '—'}</td>
                          <td>{formatAdminJoinedAt(signup.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </section>
  )
}

export default AdminDashboardPage
