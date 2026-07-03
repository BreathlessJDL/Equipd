import { useNavigate } from 'react-router-dom'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { ArrowRightIcon } from '../icons/NavIcons'
import '../icons/NavIcons.css'
import { HUB_ORDERS_SUB_TABS, HUB_ORDERS_TABS } from '../../lib/hubNavigation'
import { getHubMenuIconSrc } from '../../lib/hubMenuIcons'
import {
  EQUIPD_ICON_VARIANT,
  HUB_ATTENTION_ICON_VARIANT,
} from '../../lib/equipdIconVariants'
import { HubItemThumbnail } from './HubItemRow'
import {
  HUB_ATTENTION_DISPLAY,
  HubAttentionChevron,
} from './HubSummaryShared'
import './HubMobileSummary.css'

const MOBILE_MARKETPLACE_NAV = [
  {
    section: 'buying',
    title: 'Buying',
    subtitle: 'Your purchases and orders',
    showSubtitle: true,
  },
  {
    section: 'selling',
    title: 'Selling',
    subtitle: 'Your listings and sales',
    showSubtitle: true,
  },
  {
    section: 'listings',
    title: 'Listings',
  },
  {
    section: 'offers',
    title: 'My offers',
  },
  {
    section: 'orders',
    title: 'Orders',
  },
  {
    section: 'saved',
    title: 'Saved listings',
  },
  {
    section: 'reviews',
    title: 'Reviews',
  },
]

const RECENT_ACTIVITY_LIMIT = 4

function HubMobileMarketplaceRow({ item, badge, onNavigate }) {
  const iconSrc = getHubMenuIconSrc(item.section)

  return (
    <li>
      <button
        type="button"
        className="hub-mobile-marketplace__row"
        onClick={() => onNavigate(item.section)}
      >
        {iconSrc ? (
          <span className="hub-mobile-marketplace__icon" aria-hidden="true">
            <img src={iconSrc} alt="" />
          </span>
        ) : null}
        <span className="hub-mobile-marketplace__body">
          <span className="hub-mobile-marketplace__title">{item.title}</span>
          {item.showSubtitle && item.subtitle ? (
            <span className="hub-mobile-marketplace__subtitle">{item.subtitle}</span>
          ) : null}
        </span>
        {badge > 0 ? (
          <span className="hub-mobile-marketplace__badge">{badge}</span>
        ) : null}
        <span className="hub-mobile-marketplace__chevron" aria-hidden="true">
          <ArrowRightIcon />
        </span>
      </button>
    </li>
  )
}

function HubMobileActivityRow({ entry }) {
  const navigate = useNavigate()

  return (
    <li>
      <button
        type="button"
        className="hub-mobile-activity__row"
        onClick={() => navigate(`/orders/${entry.orderId}`)}
      >
        <HubItemThumbnail src={entry.thumbnailUrl} alt="" />
        <span className="hub-mobile-activity__content">
          <span className="hub-mobile-activity__title">{entry.title}</span>
          <span className="hub-mobile-activity__secondary">{entry.secondaryText}</span>
        </span>
        <span className="hub-mobile-activity__chevron" aria-hidden="true">
          <ArrowRightIcon />
        </span>
      </button>
    </li>
  )
}

function HubMobileSummary({
  className = '',
  needsAttention,
  recentActivity,
  sectionBadges = {},
  onNavigate,
}) {
  const visibleActivity = recentActivity.slice(0, RECENT_ACTIVITY_LIMIT)

  return (
    <div className={`hub-mobile-summary${className ? ` ${className}` : ''}`}>
      {needsAttention.length > 0 ? (
        <section className="hub-attention hub-mobile-summary__attention" aria-labelledby="hub-mobile-attention-title">
          <h2 id="hub-mobile-attention-title" className="hub-attention__title">
            Needs your attention
          </h2>
          <ul className="hub-attention__list">
            {needsAttention.map((item) => {
              const display = HUB_ATTENTION_DISPLAY[item.id] ?? {}
              const description =
                typeof display.description === 'function'
                  ? display.description(item.count)
                  : item.label
              const urgent = Boolean(display.urgent)
              const iconVariant =
                HUB_ATTENTION_ICON_VARIANT[item.id] ?? EQUIPD_ICON_VARIANT.SUPPORT_DISPUTE

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`hub-attention__row hub-attention__row--mobile-summary${
                      urgent ? ' hub-attention__row--urgent' : ''
                    }`}
                    onClick={() => onNavigate(item.section, item.tab, item.offerId)}
                  >
                    <EquipdTypeIcon variant={iconVariant} />

                    <span className="hub-attention__content">
                      <span className="hub-attention__header">
                        <span className="hub-attention__label">{item.label}</span>
                        {item.count > 0 ? (
                          <span className="hub-attention__count">{item.count}</span>
                        ) : null}
                      </span>
                      <span className="hub-attention__description">{description}</span>
                    </span>

                    <HubAttentionChevron />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="hub-mobile-marketplace" aria-label="Marketplace navigation">
        <ul className="hub-mobile-marketplace__list">
          {MOBILE_MARKETPLACE_NAV.map((item) => (
            <HubMobileMarketplaceRow
              key={item.section}
              item={item}
              badge={sectionBadges[item.section] ?? 0}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </section>

      {visibleActivity.length > 0 ? (
        <section className="hub-mobile-activity" aria-labelledby="hub-mobile-activity-title">
          <div className="hub-mobile-activity__header">
            <h2 id="hub-mobile-activity-title" className="hub-mobile-summary__section-title hub-mobile-summary__section-title--secondary">
              Recent activity
            </h2>
            <button
              type="button"
              className="hub-mobile-activity__view-all"
              onClick={() =>
                onNavigate(
                  'orders',
                  HUB_ORDERS_TABS.purchases.id,
                  undefined,
                  HUB_ORDERS_SUB_TABS.completed.id,
                )
              }
            >
              View all
            </button>
          </div>
          <ul className="hub-mobile-activity__list">
            {visibleActivity.map((entry) => (
              <HubMobileActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

export default HubMobileSummary
