#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  formatAdminJoinedAt,
  formatAdminSignupName,
  parseAdminUserStatistics,
} from '../src/lib/adminUserStatistics.js'

assert.equal(formatAdminSignupName({ username: 'jordan', displayName: 'Jordan Smith' }), 'jordan')
assert.equal(formatAdminSignupName({ username: '', displayName: 'Jordan Smith' }), 'Jordan Smith')
assert.equal(formatAdminSignupName({}), 'Unknown user')

const now = new Date('2026-08-14T15:00:00.000Z')
assert.equal(
  formatAdminJoinedAt('2026-08-14T13:32:00.000Z', now),
  'Today, 14:32',
)
assert.equal(
  formatAdminJoinedAt('2026-08-13T17:42:00.000Z', now),
  '13 Aug 2026, 18:42',
)
assert.equal(formatAdminJoinedAt(null, now), '')

const parsed = parseAdminUserStatistics({
  total_users: 247,
  newToday: 3,
  last_7_days: 18,
  last30Days: 64,
  users_who_have_listed: 42,
  latest_signups: [
    {
      id: 'user-1',
      username: 'jordan',
      display_name: 'Jordan',
      email: 'jordan@example.com',
      created_at: '2026-08-14T13:32:00.000Z',
    },
  ],
})

assert.equal(parsed.totalUsers, 247)
assert.equal(parsed.newToday, 3)
assert.equal(parsed.last7Days, 18)
assert.equal(parsed.last30Days, 64)
assert.equal(parsed.usersWhoHaveListed, 42)
assert.equal(parsed.latestSignups.length, 1)
assert.equal(parsed.latestSignups[0].displayName, 'Jordan')
assert.equal(parsed.latestSignups[0].email, 'jordan@example.com')
assert.equal(parseAdminUserStatistics(null).totalUsers, 0)

console.log('test-admin-user-statistics: ok')
