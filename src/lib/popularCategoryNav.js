/**
 * Curated homepage / browse-shell category navigation.
 * Marketing shortcuts only — full taxonomy stays in filters and listing forms.
 */

export const POPULAR_CATEGORY_NAV_ITEMS = [
  { id: 'treadmills', label: 'Treadmills', type: 'category', slug: 'treadmill' },
  { id: 'crosstrainers', label: 'Crosstrainers', type: 'category', slug: 'crosstrainers' },
  { id: 'upright-bikes', label: 'Upright Bikes', type: 'category', slug: 'upright-bikes' },
  { id: 'spin-bikes', label: 'Spin Bikes', type: 'category', slug: 'spin-bikes' },
  { id: 'multi-gyms', label: 'Multi-gyms', type: 'category', slug: 'multi-gyms' },
  { id: 'full-commercial-equipment', label: 'Full Commercial Equipment', type: 'rating', rating: 'full_commercial' },
  { id: 'light-commercial-equipment', label: 'Light Commercial Equipment', type: 'rating', rating: 'light_commercial' },
  { id: 'pin-loaded-machines', label: 'Pin Loaded Machines', type: 'category', slug: 'pin-loaded-machine' },
  { id: 'plate-loaded-machines', label: 'Plate Loaded Machines', type: 'category', slug: 'plate-loaded-machine' },
]

export function resolvePopularNavTarget(item, categories = []) {
  if (item.type === 'category') {
    const category = categories.find((entry) => entry.slug === item.slug)

    return {
      navId: item.id,
      href: `/browse?category=${encodeURIComponent(item.slug)}`,
      categoryId: category?.id ?? '',
      rating: '',
      search: '',
    }
  }

  if (item.type === 'rating') {
    return {
      navId: item.id,
      href: `/browse?rating=${encodeURIComponent(item.rating)}`,
      categoryId: '',
      rating: item.rating,
      search: '',
    }
  }

  return {
    navId: item.id,
    href: '/browse',
    categoryId: '',
    rating: '',
    search: '',
  }
}

export function getActivePopularNavId({ categoryId = '', rating = '', categories = [] }) {
  if (categoryId) {
    const category = categories.find((entry) => entry.id === categoryId)
    if (category) {
      const match = POPULAR_CATEGORY_NAV_ITEMS.find(
        (item) => item.type === 'category' && item.slug === category.slug,
      )
      if (match) return match.id
    }
  }

  if (rating) {
    const match = POPULAR_CATEGORY_NAV_ITEMS.find(
      (item) => item.type === 'rating' && item.rating === rating,
    )
    if (match) return match.id
  }

  return ''
}
