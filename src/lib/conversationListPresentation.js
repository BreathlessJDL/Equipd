function startOfLocalDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function formatConversationListTime(value, now = new Date()) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const today = startOfLocalDay(now)
  const targetDay = startOfLocalDay(date)
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  }

  if (diffDays === 1) return 'Yesterday'

  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)
  }

  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}
