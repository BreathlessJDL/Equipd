import './HelpCentre.css'

function SearchIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HelpSearch({ value, onChange, placeholder, id = 'help-centre-search' }) {
  return (
    <div className="help-centre__search">
      <SearchIcon className="help-centre__search-icon" />
      <input
        id={id}
        type="search"
        className="help-centre__search-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
      />
    </div>
  )
}

export default HelpSearch
