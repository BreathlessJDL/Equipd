import { useEffect, useState } from 'react'
import { WantedSearchIcon } from './WantedRequestIcons'
import { useWantedRequest } from './useWantedRequest'
import { trackWantedRequestCtaViewed } from '../../lib/wantedRequestAnalytics'
import { WANTED_REQUEST_SOURCES } from '../../lib/wantedRequestConstants'
import './HomepageWantedRequestFloatingTrigger.css'

const COLLAPSE_SCROLL_Y = 220

/**
 * Compact homepage-only floating prompt for wanted requests.
 * Not used on other routes — those have context-specific CTAs.
 */
function HomepageWantedRequestFloatingTrigger() {
  const { openWantedRequest, isWantedRequestOpen } = useWantedRequest()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    trackWantedRequestCtaViewed({ source: WANTED_REQUEST_SOURCES.HOMEPAGE, surface: 'floating' })
  }, [])

  useEffect(() => {
    function onScroll() {
      setCollapsed(window.scrollY > COLLAPSE_SCROLL_Y)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (isWantedRequestOpen) return null

  return (
    <div className={`home-wanted-float${collapsed ? ' home-wanted-float--collapsed' : ''}`}>
      <button
        type="button"
        className="home-wanted-float__button"
        aria-label="Create a wanted equipment request"
        onClick={(event) =>
          openWantedRequest({
            source: WANTED_REQUEST_SOURCES.HOMEPAGE,
            preferredEntryMode: 'catalogue',
            triggerElement: event.currentTarget,
          })
        }
      >
        <span className="home-wanted-float__icon" aria-hidden="true">
          <WantedSearchIcon />
        </span>
        <span className="home-wanted-float__label home-wanted-float__label--desktop">
          Can&apos;t find what you need?
        </span>
        <span className="home-wanted-float__label home-wanted-float__label--mobile">
          Can&apos;t find it?
        </span>
      </button>
    </div>
  )
}

export default HomepageWantedRequestFloatingTrigger
