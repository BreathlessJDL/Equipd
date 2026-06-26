/**
 * Curated category rows for the mobile hamburger menu (logged-out).
 */

export const MOBILE_MENU_CATEGORIES = [
  { id: 'treadmills', label: 'Treadmills', slug: 'treadmill', icon: 'treadmill' },
  { id: 'crosstrainers', label: 'Crosstrainers', slug: 'crosstrainers', icon: 'crosstrainer' },
  { id: 'upright-bikes', label: 'Upright Bikes', slug: 'upright-bikes', icon: 'upright-bike' },
  { id: 'spin-bikes', label: 'Spin Bikes', slug: 'spin-bikes', icon: 'spin-bike' },
  { id: 'multi-gyms', label: 'Multi-gyms', slug: 'multi-gyms', icon: 'multi-gym' },
  { id: 'plate-loaded', label: 'Plate Loaded Machines', slug: 'plate-loaded-machine', icon: 'plate-loaded' },
  { id: 'pin-loaded', label: 'Pin Loaded Machines', slug: 'pin-loaded-machine', icon: 'pin-loaded' },
  { id: 'dumbbells', label: 'Dumbbells', slug: 'dumbbells', icon: 'dumbbell' },
  { id: 'weight-plates', label: 'Weight Plates', slug: 'weight-plates', icon: 'weight-plate' },
  { id: 'squat-racks', label: 'Squat Racks', slug: 'squat-rack', icon: 'squat-rack' },
]

export function getMobileMenuCategoryHref(slug) {
  return `/browse?category=${encodeURIComponent(slug)}`
}
