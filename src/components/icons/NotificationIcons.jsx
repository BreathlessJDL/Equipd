const NOTIFICATION_ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function NotificationSvg({ className = '', children }) {
  return (
    <svg aria-hidden="true" className={className} {...NOTIFICATION_ICON_PROPS}>
      {children}
    </svg>
  )
}

/** Lucide-style price tag for new offers */
export function NewOfferTagIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </NotificationSvg>
  )
}

export function ArrowLeftRightIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </NotificationSvg>
  )
}

export function CircleCheckIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </NotificationSvg>
  )
}

export function CircleXIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </NotificationSvg>
  )
}

export function PackageIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 12 21 7" />
    </NotificationSvg>
  )
}

export function TruckIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </NotificationSvg>
  )
}

export function ShieldCheckIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </NotificationSvg>
  )
}

export function WalletIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </NotificationSvg>
  )
}

export function ShieldAlertIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </NotificationSvg>
  )
}

export function StarIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </NotificationSvg>
  )
}

export function BellIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </NotificationSvg>
  )
}

export function StoreIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
      <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 2.5 2.5 0 0 1-3.771 0" />
      <path d="M2 10.5V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5.5" />
    </NotificationSvg>
  )
}

export function ShoppingBagIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M3.103 6.034h17.794" />
      <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </NotificationSvg>
  )
}

export function HeartIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </NotificationSvg>
  )
}

export function MessageCircleIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.997l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.549" />
    </NotificationSvg>
  )
}

export function SettingsIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </NotificationSvg>
  )
}

export function FileTextIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </NotificationSvg>
  )
}

export function ListChecksIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M13 5h8" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      <path d="m5 5 1 1 2-2" />
      <path d="m5 12 1 1 2-2" />
      <path d="m5 19 1 1 2-2" />
    </NotificationSvg>
  )
}

/** Lucide-style hand with coins — seller earnings / marketplace selling */
export function HandCoinsIcon({ className = '' }) {
  return (
    <NotificationSvg className={className}>
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1-.2-1.4-.6A3 3 0 0 1 7 10c0-1.7 1.3-3 3-3h2a2 2 0 1 1 0 4H9c-.6 0-1.1.2-1.4.6A3 3 0 0 0 9 14c0 1.7 1.3 3 3 3z" />
      <path d="M12 11v12" />
      <path d="M17 13h2" />
      <path d="M15 9V7" />
      <path d="M19 9v8" />
      <path d="M21 17h-4" />
    </NotificationSvg>
  )
}
