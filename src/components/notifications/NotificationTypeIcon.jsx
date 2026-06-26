import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import { getNotificationIconType } from '../../lib/notificationPresentation'

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

export function NotificationTypeIcon({ notification }) {
  const iconType = getNotificationIconType(notification)
  const variant = NOTIFICATION_TO_EQUIPD_VARIANT[iconType] ?? EQUIPD_ICON_VARIANT.DEFAULT

  return <EquipdTypeIcon variant={variant} />
}

export default NotificationTypeIcon
