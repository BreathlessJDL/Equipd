export const ADMIN_HUB_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/cases', label: 'Cases' },
  { to: '/admin/support', label: 'Support' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/messages', label: 'Messages', match: 'messages' },
  { to: '/admin/intelligence/products', label: 'Catalogue', match: 'catalogue' },
  { to: '/admin/price-guide/import', label: 'Price Guide', match: 'price-guide' },
]

export const ADMIN_HUB_TOOLS = [
  {
    to: '/admin/users',
    label: 'Users',
    description: 'Search accounts and log in as a user for support.',
    cta: 'View users',
  },
  {
    to: '/admin/cases',
    label: 'Cases',
    description: 'Manage customer support and marketplace cases.',
    cta: 'View cases',
  },
  {
    to: '/admin/support',
    label: 'Support',
    description: 'Review support requests and record resolutions.',
    cta: 'View support',
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    description: 'View and manage marketplace orders.',
    cta: 'View orders',
  },
  {
    to: '/admin/messages',
    label: 'Messages',
    description: 'Review marketplace conversations for support, disputes and safety.',
    cta: 'View messages',
  },
  {
    to: '/admin/intelligence/products',
    label: 'Catalogue',
    description: 'Manage equipment catalogue data.',
    cta: 'Manage catalogue',
  },
  {
    to: '/admin/price-guide/import',
    label: 'Price Guide',
    description: 'Import market observations for the price guide.',
    cta: 'Open price guide',
  },
]

export function isAdminHubNavActive(pathname, item) {
  const path = String(pathname || '')
  if (!item?.to) return false
  if (item.match === 'messages') {
    return path === '/admin/messages' || path.startsWith('/admin/messages/')
  }
  if (item.match === 'catalogue') {
    return path.startsWith('/admin/intelligence') || path.startsWith('/admin/catalogue')
  }
  if (item.match === 'price-guide') {
    return path.startsWith('/admin/price-guide')
  }
  if (item.end) {
    return path === item.to
  }
  return path === item.to || path.startsWith(`${item.to}/`)
}
