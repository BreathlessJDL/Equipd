export const HUB_SECTIONS = {
  summary: { id: 'summary', label: 'Summary' },
  buying: { id: 'buying', label: 'Buying' },
  selling: { id: 'selling', label: 'Selling' },
  listings: { id: 'listings', label: 'Listings' },
  offers: { id: 'offers', label: 'My offers' },
  orders: { id: 'orders', label: 'Orders' },
  saved: { id: 'saved', label: 'Saved listings' },
  reviews: { id: 'reviews', label: 'Reviews' },
  settings: { id: 'settings', label: 'Settings', href: '/settings' },
}

export const HUB_BUYING_TABS = {
  offers: { id: 'offers', label: 'Offers' },
  awaiting_payment: { id: 'awaiting_payment', label: 'Awaiting payment' },
  in_progress: { id: 'in_progress', label: 'In progress' },
  completed: { id: 'completed', label: 'Completed' },
  cancelled: { id: 'cancelled', label: 'Cancelled' },
}

export const HUB_SELLING_TABS = {
  offers: { id: 'offers', label: 'Offers received' },
  awaiting_payment: { id: 'awaiting_payment', label: 'Awaiting payment' },
  active: { id: 'active', label: 'Active sales' },
  sold: { id: 'sold', label: 'Sold' },
  cancelled: { id: 'cancelled', label: 'Cancelled' },
}

export const HUB_LISTINGS_TABS = {
  active: { id: 'active', label: 'Active' },
  draft: { id: 'draft', label: 'Draft' },
  reserved: { id: 'reserved', label: 'Reserved' },
  sold: { id: 'sold', label: 'Sold' },
}

export const HUB_ORDERS_TABS = {
  purchases: { id: 'purchases', label: 'Purchases' },
  sales: { id: 'sales', label: 'Sales' },
}

export const HUB_ORDERS_SUB_TABS = {
  in_progress: { id: 'in_progress', label: 'In progress' },
  completed: { id: 'completed', label: 'Completed' },
}

/** @deprecated Use HUB_ORDERS_SUB_TABS */
export const HUB_ORDERS_SALES_TABS = HUB_ORDERS_SUB_TABS

export const HUB_REVIEWS_TABS = {
  received: { id: 'received', label: 'Reviews received' },
  left: { id: 'left', label: 'Reviews left' },
  pending: { id: 'pending', label: 'Pending' },
}

const DEFAULT_SECTION = HUB_SECTIONS.summary.id

const SECTION_TAB_DEFAULTS = {
  buying: HUB_BUYING_TABS.offers.id,
  selling: HUB_SELLING_TABS.offers.id,
  listings: HUB_LISTINGS_TABS.active.id,
  orders: HUB_ORDERS_TABS.purchases.id,
  reviews: HUB_REVIEWS_TABS.received.id,
}

export function parseHubNavigation(searchParams) {
  const rawSection = searchParams.get('section')?.trim() ?? ''
  let section = Object.values(HUB_SECTIONS).some((entry) => entry.id === rawSection)
    ? rawSection
    : DEFAULT_SECTION

  const rawTab = searchParams.get('tab')?.trim() ?? ''

  // Offers received now live under Selling.
  if (section === 'offers' && rawTab === 'received') {
    section = 'selling'
  }

  const tabDefaults = SECTION_TAB_DEFAULTS[section]
  const tab = tabDefaults ? resolveHubTab(section, rawTab === 'received' ? '' : rawTab) : ''

  let subTab = ''
  if (section === HUB_SECTIONS.orders.id) {
    const ordersTab = tab === HUB_ORDERS_TABS.sales.id || tab === HUB_ORDERS_TABS.purchases.id
    if (ordersTab) {
      const rawSubTab = searchParams.get('subTab')?.trim() ?? ''
      subTab = Object.values(HUB_ORDERS_SUB_TABS).some((entry) => entry.id === rawSubTab)
        ? rawSubTab
        : HUB_ORDERS_SUB_TABS.in_progress.id
    }
  }

  return { section, tab, subTab }
}

function resolveHubTab(section, rawTab) {
  const tabMaps = {
    buying: HUB_BUYING_TABS,
    selling: HUB_SELLING_TABS,
    listings: HUB_LISTINGS_TABS,
    orders: HUB_ORDERS_TABS,
    reviews: HUB_REVIEWS_TABS,
  }

  const map = tabMaps[section]
  if (!map) return ''

  if (Object.values(map).some((entry) => entry.id === rawTab)) {
    return rawTab
  }

  return SECTION_TAB_DEFAULTS[section] ?? ''
}

export function buildHubSearchParams({ section, tab, subTab, preserve = new URLSearchParams() }) {
  const next = new URLSearchParams(preserve)

  next.set('section', section || DEFAULT_SECTION)

  const defaultTab = SECTION_TAB_DEFAULTS[section]
  const resolvedTab = tab || defaultTab
  if (resolvedTab) {
    next.set('tab', resolvedTab)
  } else {
    next.delete('tab')
  }

  if (
    (section || DEFAULT_SECTION) === HUB_SECTIONS.orders.id &&
    (resolvedTab || defaultTab) === HUB_ORDERS_TABS.purchases.id &&
    subTab
  ) {
    next.set('subTab', subTab)
  } else if (
    (section || DEFAULT_SECTION) === HUB_SECTIONS.orders.id &&
    (resolvedTab || defaultTab) === HUB_ORDERS_TABS.sales.id &&
    subTab
  ) {
    next.set('subTab', subTab)
  } else {
    next.delete('subTab')
  }

  return next
}

export function getHubSectionMeta(sectionId) {
  return Object.values(HUB_SECTIONS).find((entry) => entry.id === sectionId) ?? HUB_SECTIONS.summary
}
