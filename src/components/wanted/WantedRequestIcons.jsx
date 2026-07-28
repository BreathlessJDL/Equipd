/** Lightweight icons for wanted-request UI (no external asset dependency). */

export function WantedBellIcon({ className = '', title = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22Zm7-5.5V11a7 7 0 1 0-14 0v5.5L3 18.5V20h18v-1.5l-2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function WantedSearchIcon({ className = '', title = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.4 15.4 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
