import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { ArrowRightIcon } from '../icons/NavIcons'
import '../icons/NavIcons.css'
import { HUB_PNG_ICONS } from '../../lib/hubPngIcons'
import { HUB_SUMMARY_ICON_VARIANT } from '../../lib/equipdIconVariants'
import { HUB_ORDERS_SUB_TABS, HUB_ORDERS_TABS } from '../../lib/hubNavigation'
import HubScopedPngIcon from './HubScopedPngIcon'
import {
  HUB_ATTENTION_DISPLAY,
  getHubAttentionTone,
} from '../../lib/hubNeedsAttention'

export { HUB_ATTENTION_DISPLAY, getHubAttentionTone }

export const HUB_TRANSACTION_ACTION_CARDS = [
  {
    key: 'orders-in-progress',
    label: 'Orders in progress',
    section: 'orders',
    tab: HUB_ORDERS_TABS.purchases.id,
    subTab: HUB_ORDERS_SUB_TABS.in_progress.id,
    countKey: 'ordersInProgress',
    getSubtitle: (count) =>
      count === 0
        ? 'No active purchases'
        : `${count} active purchase${count === 1 ? '' : 's'}`,
  },
  {
    key: 'sales-in-progress',
    label: 'Sales in progress',
    section: 'orders',
    tab: HUB_ORDERS_TABS.sales.id,
    subTab: HUB_ORDERS_SUB_TABS.in_progress.id,
    countKey: 'salesInProgress',
    getSubtitle: (count) =>
      count === 0 ? 'No active sales' : `${count} active sale${count === 1 ? '' : 's'}`,
  },
]

export function HubAttentionChevron() {
  return (
    <span className="hub-attention__chevron" aria-hidden="true">
      <ArrowRightIcon />
    </span>
  )
}

export function HubTransactionActionIcon({ cardKey }) {
  if (cardKey === 'orders-in-progress') {
    return (
      <HubScopedPngIcon
        src={HUB_PNG_ICONS.orderInProgress}
        className="hub-transaction-action__icon hub-transaction-action__icon--orders-png"
      />
    )
  }

  return (
    <EquipdTypeIcon
      variant={HUB_SUMMARY_ICON_VARIANT[cardKey]}
      className="hub-transaction-action__icon"
    />
  )
}
