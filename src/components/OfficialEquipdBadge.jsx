import './OfficialEquipdBadge.css'

function OfficialEquipdBadge({ className = '' }) {
  return (
    <span className={`official-equipd-badge${className ? ` ${className}` : ''}`}>
      <svg className="official-equipd-badge__mark" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.5 2.8 3.7v3.9c0 3.3 2.1 6.3 5.2 7.4 3.1-1.1 5.2-4.1 5.2-7.4V3.7L8 1.5Zm-.2 9.1L4.8 7.6l1.1-1.1 1.8 1.8 3.3-3.3 1.1 1.1-4.3 4.5Z"
        />
      </svg>
      Official Equipd
    </span>
  )
}

export default OfficialEquipdBadge
