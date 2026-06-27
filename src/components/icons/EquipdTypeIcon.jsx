import {
  ArrowLeftRightIcon,
  BellIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  HandCoinsIcon,
  HeartIcon,
  ListChecksIcon,
  MessageCircleIcon,
  NewOfferTagIcon,
  PackageIcon,
  SettingsIcon,
  SellingStallIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  StarIcon,
  StoreIcon,
  TruckIcon,
  WalletIcon,
} from './NotificationIcons'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import './EquipdTypeIcon.css'

const ICON_CONFIG = {
  [EQUIPD_ICON_VARIANT.NEW_OFFER]: { Icon: NewOfferTagIcon },
  [EQUIPD_ICON_VARIANT.COUNTER_OFFER]: { Icon: ArrowLeftRightIcon },
  [EQUIPD_ICON_VARIANT.OFFER_ACCEPTED]: { Icon: CircleCheckIcon },
  [EQUIPD_ICON_VARIANT.OFFER_DECLINED]: { Icon: CircleXIcon },
  [EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED]: { Icon: PackageIcon },
  [EQUIPD_ICON_VARIANT.ITEM_DISPATCHED]: { Icon: TruckIcon },
  [EQUIPD_ICON_VARIANT.DELIVERY_CONFIRMED]: { Icon: ShieldCheckIcon },
  [EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT]: { Icon: WalletIcon },
  [EQUIPD_ICON_VARIANT.SUPPORT_DISPUTE]: { Icon: ShieldAlertIcon },
  [EQUIPD_ICON_VARIANT.REVIEW_RECEIVED]: { Icon: StarIcon },
  [EQUIPD_ICON_VARIANT.SELLING_STORE]: { Icon: StoreIcon },
  [EQUIPD_ICON_VARIANT.SELLING_STALL]: { Icon: SellingStallIcon },
  [EQUIPD_ICON_VARIANT.SELLING_HAND_COINS]: { Icon: HandCoinsIcon },
  [EQUIPD_ICON_VARIANT.MY_LISTINGS]: { Icon: ListChecksIcon },
  [EQUIPD_ICON_VARIANT.BUYING_BAG]: { Icon: ShoppingBagIcon },
  [EQUIPD_ICON_VARIANT.SAVED_HEART]: { Icon: HeartIcon },
  [EQUIPD_ICON_VARIANT.MESSAGES]: { Icon: MessageCircleIcon },
  [EQUIPD_ICON_VARIANT.SETTINGS]: { Icon: SettingsIcon },
  [EQUIPD_ICON_VARIANT.DRAFTS]: { Icon: FileTextIcon },
  [EQUIPD_ICON_VARIANT.DEFAULT]: { Icon: BellIcon },
}

export function EquipdTypeIcon({ variant = EQUIPD_ICON_VARIANT.DEFAULT, className = '' }) {
  const resolvedVariant = ICON_CONFIG[variant] ? variant : EQUIPD_ICON_VARIANT.DEFAULT
  const { Icon } = ICON_CONFIG[resolvedVariant]

  return (
    <span
      className={`equipd-type-icon equipd-type-icon--${resolvedVariant}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <Icon className="equipd-type-icon__svg" />
    </span>
  )
}

export default EquipdTypeIcon
