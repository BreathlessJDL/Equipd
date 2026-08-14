const LONDON_TZ = 'Europe/London'

function londonCalendarDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function formatAdminSignupName(signup) {
  const username = signup?.username?.trim()
  if (username) return username
  const displayName = signup?.displayName?.trim() || signup?.display_name?.trim()
  if (displayName) return displayName
  return 'Unknown user'
}

export function formatAdminJoinedAt(value, now = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  if (londonCalendarDate(date) === londonCalendarDate(now)) {
    return `Today, ${time}`
  }

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)

  return `${day}, ${time}`
}

function toCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.trunc(n)
}

export function parseAdminUserStatistics(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const latest = Array.isArray(source.latestSignups)
    ? source.latestSignups
    : Array.isArray(source.latest_signups)
      ? source.latest_signups
      : []

  return {
    totalUsers: toCount(source.totalUsers ?? source.total_users),
    newToday: toCount(source.newToday ?? source.new_today),
    last7Days: toCount(source.last7Days ?? source.last_7_days),
    last30Days: toCount(source.last30Days ?? source.last_30_days),
    usersWhoHaveListed: toCount(source.usersWhoHaveListed ?? source.users_who_have_listed),
    latestSignups: latest.map((row) => ({
      id: row?.id ?? null,
      username: row?.username ?? '',
      displayName: row?.displayName ?? row?.display_name ?? '',
      email: row?.email ?? '',
      createdAt: row?.createdAt ?? row?.created_at ?? null,
    })),
  }
}
