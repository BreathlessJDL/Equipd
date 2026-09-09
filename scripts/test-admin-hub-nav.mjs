#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADMIN_HUB_NAV, ADMIN_HUB_TOOLS, isAdminHubNavActive } from '../src/lib/adminNav.js'

const root = process.cwd()
const appSrc = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const dashboardSrc = readFileSync(join(root, 'src/pages/AdminDashboardPage.jsx'), 'utf8')
const protectedSrc = readFileSync(join(root, 'src/components/AdminProtectedRoute.jsx'), 'utf8')
const navSrc = readFileSync(join(root, 'src/components/AppNav.jsx'), 'utf8')

assert.equal(ADMIN_HUB_NAV[0].to, '/admin')
assert.deepEqual(
  ADMIN_HUB_NAV.map((item) => item.label),
  ['Dashboard', 'Users', 'Cases', 'Support', 'Orders', 'Messages', 'Catalogue', 'Price Guide'],
)

for (const item of ADMIN_HUB_NAV) {
  if (item.to === '/admin') {
    assert.match(appSrc, /path="admin"/)
    continue
  }
  const nestedPath = item.to.replace(/^\/admin\//, '')
  assert.ok(
    appSrc.includes(`path="${nestedPath}"`) || appSrc.includes(`path="admin/${nestedPath}"`),
    `missing route for ${item.to}`,
  )
}

assert.match(appSrc, /path="catalogue"/)
assert.match(appSrc, /Navigate to="\/admin\/intelligence\/products"/)
assert.match(appSrc, /<AdminProtectedRoute \/>/)
assert.match(appSrc, /AdminUsersPage/)

assert.match(protectedSrc, /AdminHubNav/)
assert.match(protectedSrc, /<Outlet \/>/)
assert.match(protectedSrc, /AdminProtectedRoute/)
assert.match(protectedSrc, /isAdmin/)
assert.match(dashboardSrc, /User statistics/)
assert.match(dashboardSrc, /Latest sign-ups/)
assert.match(dashboardSrc, /Admin tools/)
assert.match(dashboardSrc, /USER_STAT_CARDS/)
assert.match(navSrc, /label: 'Admin'/)
assert.doesNotMatch(navSrc, /label: 'Cases'/)

assert.equal(isAdminHubNavActive('/admin', ADMIN_HUB_NAV[0]), true)
assert.equal(isAdminHubNavActive('/admin/users', ADMIN_HUB_NAV[1]), true)
assert.equal(isAdminHubNavActive('/admin/cases', ADMIN_HUB_NAV[0]), false)
assert.equal(isAdminHubNavActive('/admin/cases', ADMIN_HUB_NAV[2]), true)
assert.equal(isAdminHubNavActive('/admin/messages', ADMIN_HUB_NAV[5]), true)
assert.equal(isAdminHubNavActive('/admin/messages/abc', ADMIN_HUB_NAV[5]), true)
assert.equal(isAdminHubNavActive('/admin/intelligence/products', ADMIN_HUB_NAV[6]), true)
assert.equal(isAdminHubNavActive('/admin/intelligence/consoles', ADMIN_HUB_NAV[6]), true)
assert.equal(isAdminHubNavActive('/admin/catalogue', ADMIN_HUB_NAV[6]), true)
assert.equal(isAdminHubNavActive('/admin/price-guide/import', ADMIN_HUB_NAV[7]), true)
assert.equal(isAdminHubNavActive('/admin/cases', ADMIN_HUB_NAV[6]), false)

assert.equal(ADMIN_HUB_TOOLS.length, 7)
assert.equal(ADMIN_HUB_TOOLS[0].label, 'Users')
assert.equal(ADMIN_HUB_TOOLS[0].to, '/admin/users')
assert.equal(ADMIN_HUB_TOOLS[4].label, 'Messages')
assert.equal(ADMIN_HUB_TOOLS[4].to, '/admin/messages')
for (const tool of ADMIN_HUB_TOOLS) {
  assert.ok(tool.to && tool.label && tool.description && tool.cta)
}

const adminRouteCount = [...appSrc.matchAll(/path="(?:admin|users|cases|support|orders|catalogue|intelligence|price-guide)[^"]*"/g)].length
assert.ok(adminRouteCount >= 17, `expected the existing admin route set, found ${adminRouteCount}`)

console.log('test-admin-hub-nav: ok')
