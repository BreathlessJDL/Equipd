export const LOCATION_PAGES = {
  leeds: {
    slug: 'leeds',
    name: 'Leeds',
    heading: 'Used gym equipment in Leeds',
    intro:
      'Browse second-hand gym kit from sellers across Leeds and nearby West Yorkshire towns. Pick up locally and save on delivery.',
    areas: ['Leeds', 'Wakefield', 'Bradford', 'Huddersfield', 'York', 'Harrogate'],
  },
  manchester: {
    slug: 'manchester',
    name: 'Manchester',
    heading: 'Used gym equipment in Manchester',
    intro:
      'Find pre-owned weights, racks, and cardio gear from sellers in Greater Manchester and surrounding towns.',
    areas: ['Manchester', 'Salford', 'Bolton', 'Stockport', 'Oldham', 'Rochdale'],
  },
  birmingham: {
    slug: 'birmingham',
    name: 'Birmingham',
    heading: 'Used gym equipment in Birmingham',
    intro:
      'Shop used gym equipment listed by sellers across Birmingham and the West Midlands commuter belt.',
    areas: ['Birmingham', 'Wolverhampton', 'Coventry', 'Solihull', 'Walsall', 'Dudley'],
  },
  london: {
    slug: 'london',
    name: 'London',
    heading: 'Used gym equipment in London',
    intro:
      'Discover used home and commercial gym equipment from sellers across London and nearby towns.',
    areas: ['London', 'Croydon', 'Wembley', 'Stratford', 'Watford', 'Romford'],
  },
}

export const LOCATION_SLUGS = Object.keys(LOCATION_PAGES)

export function getLocationPage(slug) {
  return LOCATION_PAGES[slug] ?? null
}

export function formatLocationAreas(areas = []) {
  if (areas.length === 0) return ''
  if (areas.length === 1) return areas[0]
  if (areas.length === 2) return `${areas[0]} and ${areas[1]}`

  return `${areas.slice(0, -1).join(', ')}, and ${areas[areas.length - 1]}`
}
