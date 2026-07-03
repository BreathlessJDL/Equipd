import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { ArrowRightIcon } from '../icons/NavIcons'
import '../icons/NavIcons.css'
import { HUB_PNG_ICONS } from '../../lib/hubPngIcons'
import { HUB_SUMMARY_ICON_VARIANT } from '../../lib/equipdIconVariants'
import { HUB_ORDERS_SUB_TABS, HUB_ORDERS_TABS } from '../../lib/hubNavigation'
import HubScopedPngIcon from './HubScopedPngIcon'

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

export const HUB_ATTENTION_DISPLAY = {
  'offers-received': {
    actionRequired: true,
    description: (count) =>
      `${count} offer${count === 1 ? '' : 's'} need accepting, declining, or countering.`,
    actionLabel: 'Review offers',
  },
  'buyer-pay': {
    actionRequired: true,
    description: (count) =>
      `${count} accepted offer${count === 1 ? '' : 's'} waiting for your payment.`,
    actionLabel: 'Complete payment',
  },
  'seller-awaiting-pay': {
    actionRequired: true,
    description: (count) =>
      `${count} buyer${count === 1 ? '' : 's'} still need to complete checkout.`,
    actionLabel: 'View sales',
  },
  'buyer-collection': {
    actionRequired: true,
    description: (count) =>
      `${count} order${count === 1 ? '' : 's'} ready for collection or delivery.`,
    actionLabel: 'View orders',
  },
  'courier-evidence': {
    actionRequired: true,
    description: () => 'Upload handover evidence before courier collection.',
    actionLabel: 'Submit evidence',
  },
  disputes: {
    description: (count) =>
      `${count} open dispute${count === 1 ? '' : 's'} need your attention.`,
    actionLabel: 'View disputes',
    urgent: true,
  },
  'counter-offers-received': {
    actionRequired: true,
    description: (count) =>
      `${count} counter offer${count === 1 ? '' : 's'} need your response.`,
    actionLabel: 'Review counter offers',
  },
  'payout-setup': {
    description: () => 'Connect your payout account to receive funds from reserved listings.',
    actionLabel: 'Set up payouts',
    urgent: true,
  },
  'pending-reviews': {
    actionRequired: true,
    description: () => 'Leave a review for completed orders.',
    actionLabel: 'Review orders',
  },
}

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
