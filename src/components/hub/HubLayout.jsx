import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HUB_SECTIONS } from '../../lib/hubNavigation'
import './HubLayout.css'

const HUB_TABS_NUDGE_STORAGE_KEY = 'equipd-hub-tabs-scroll-nudge-v1'

function HubNavItem({ item, active, onSelect, badge }) {
  if (item.href) {
    return (
      <Link
        to={item.href}
        className={`hub-nav__item${active ? ' hub-nav__item--active' : ''}`}
      >
        <span className="hub-nav__label">{item.label}</span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={`hub-nav__item${active ? ' hub-nav__item--active' : ''}`}
      onClick={() => onSelect(item.id)}
    >
      <span className="hub-nav__label">{item.label}</span>
      {badge > 0 ? <span className="hub-nav__badge">{badge}</span> : null}
    </button>
  )
}

function HubSectionTabs({ tabs, activeTab, onChange, tabBadges = {}, ariaLabel = 'Section filters' }) {
  const entries = Object.values(tabs)
  const scrollRef = useRef(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [atScrollEnd, setAtScrollEnd] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined

    const updateScrollState = () => {
      const overflow = element.scrollWidth > element.clientWidth + 1
      setHasOverflow(overflow)
      setAtScrollEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2)
    }

    updateScrollState()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollState)
      : null

    resizeObserver?.observe(element)
    element.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      resizeObserver?.disconnect()
      element.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [entries.length, tabBadges])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !hasOverflow) return undefined
    if (localStorage.getItem(HUB_TABS_NUDGE_STORAGE_KEY)) return undefined

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      localStorage.setItem(HUB_TABS_NUDGE_STORAGE_KEY, '1')
      return undefined
    }

    const isMobileTabs = window.matchMedia('(max-width: 900px)').matches
    if (!isMobileTabs) return undefined

    const startTimer = window.setTimeout(() => {
      const startScrollLeft = element.scrollLeft
      element.scrollTo({ left: startScrollLeft + 20, behavior: 'smooth' })

      window.setTimeout(() => {
        element.scrollTo({ left: startScrollLeft, behavior: 'smooth' })
        localStorage.setItem(HUB_TABS_NUDGE_STORAGE_KEY, '1')
      }, 420)
    }, 700)

    return () => window.clearTimeout(startTimer)
  }, [hasOverflow])

  const scrollClassName = [
    'hub-tabs-scroll',
    hasOverflow ? 'hub-tabs-scroll--overflow' : '',
    hasOverflow && !atScrollEnd ? 'hub-tabs-scroll--fade-right' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={scrollClassName}>
      <div className="hub-tabs" ref={scrollRef} role="tablist" aria-label={ariaLabel}>
        {entries.map((tab) => {
          const badge = tabBadges[tab.id] ?? 0

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`hub-tabs__tab${activeTab === tab.id ? ' hub-tabs__tab--active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="hub-tabs__tab-label">{tab.label}</span>
              {badge > 0 ? <span className="hub-tabs__badge">{badge}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HubLayout({
  section,
  tab,
  onSectionChange,
  onTabChange,
  sectionBadges = {},
  title,
  lead,
  children,
}) {
  const navItems = Object.values(HUB_SECTIONS)

  return (
    <section className="hub-page hub-dashboard">
      <header className="hub-dashboard__header">
        <div>
          <h2 className="hub-page__title">{title ?? 'Hub'}</h2>
          {lead ? <p className="hub-page__lead">{lead}</p> : null}
        </div>
      </header>

      <div className="hub-dashboard__mobile-nav">
        <label className="hub-dashboard__mobile-label" htmlFor="hub-section-select">
          Section
        </label>
        <select
          id="hub-section-select"
          className="hub-dashboard__mobile-select"
          value={section}
          onChange={(event) => onSectionChange(event.target.value)}
        >
          {navItems
            .filter((item) => !item.href)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {sectionBadges[item.id] ? ` (${sectionBadges[item.id]})` : ''}
              </option>
            ))}
        </select>
      </div>

      <div className="hub-dashboard__body">
        <aside className="hub-dashboard__sidebar" aria-label="Hub navigation">
          <nav className="hub-nav">
            {navItems.map((item) =>
              item.href ? (
                <HubNavItem key={item.id} item={item} active={false} />
              ) : (
                <HubNavItem
                  key={item.id}
                  item={item}
                  active={section === item.id}
                  badge={sectionBadges[item.id]}
                  onSelect={onSectionChange}
                />
              ),
            )}
          </nav>
        </aside>

        <div className="hub-dashboard__main">
          {children}
        </div>
      </div>
    </section>
  )
}

export { HubLayout, HubSectionTabs }
