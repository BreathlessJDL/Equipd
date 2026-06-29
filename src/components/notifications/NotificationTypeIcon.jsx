import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import {
  getNotificationIconType,
  NOTIFICATION_ICON_TYPES,
} from '../../lib/notificationPresentation'
import { NOTIFICATION_PNG_ICONS } from '../../lib/notificationPngIcons'
import NotificationScopedPngIcon from './NotificationScopedPngIcon'

const NOTIFICATION_TO_EQUIPD_VARIANT = {
  new_offer: EQUIPD_ICON_VARIANT.NEW_OFFER,
  counter_offer: EQUIPD_ICON_VARIANT.COUNTER_OFFER,
  offer_accepted: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
  offer_declined: EQUIPD_ICON_VARIANT.OFFER_DECLINED,
  collection_confirmed: EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
  item_dispatched: EQUIPD_ICON_VARIANT.ITEM_DISPATCHED,
  delivery_confirmed: EQUIPD_ICON_VARIANT.DELIVERY_CONFIRMED,
  payout_payment: EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
  support_dispute: EQUIPD_ICON_VARIANT.SUPPORT_DISPUTE,
  review_received: EQUIPD_ICON_VARIANT.REVIEW_RECEIVED,
  default: EQUIPD_ICON_VARIANT.DEFAULT,
}

const NOTIFICATION_PNG_CONFIG = {
  [NOTIFICATION_ICON_TYPES.BUYER_PAYMENT_RECEIVED]: {
    src: NOTIFICATION_PNG_ICONS.buyerPayment,
    className: 'notification-icon--buyer-payment-png',
  },
  [NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED]: {
    src: NOTIFICATION_PNG_ICONS.collectionConfirmed,
    className: 'notification-icon--collection-confirmed-png',
  },
}

export function NotificationTypeIcon({ notification }) {
  const iconType = getNotificationIconType(notification)
  const pngConfig = NOTIFICATION_PNG_CONFIG[iconType]

  if (pngConfig) {
    return (
      <NotificationScopedPngIcon src={pngConfig.src} className={pngConfig.className} />
    )
  }

  const variant = NOTIFICATION_TO_EQUIPD_VARIANT[iconType] ?? EQUIPD_ICON_VARIANT.DEFAULT

  return <EquipdTypeIcon variant={variant} />
}

export default NotificationTypeIcon
