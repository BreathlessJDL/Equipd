import { Link } from 'react-router-dom'
import './UiState.css'

function LoadingState({ children = 'Loading…', compact = false, className = '' }) {
  return (
    <p
      className={`ui-state ui-state--loading${compact ? ' ui-state--compact' : ''}${className ? ` ${className}` : ''}`}
      role="status"
    >
      {children}
    </p>
  )
}

function EmptyState({ children, compact = false, className = '' }) {
  return (
    <p
      className={`ui-state ui-state--empty${compact ? ' ui-state--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </p>
  )
}

function ErrorState({
  children,
  compact = false,
  className = '',
  actionLabel,
  actionTo,
}) {
  return (
    <p
      className={`ui-state ui-state--error${compact ? ' ui-state--compact' : ''}${className ? ` ${className}` : ''}`}
      role="alert"
    >
      {children}
      {actionLabel && actionTo ? (
        <>
          {' '}
          <Link to={actionTo} className="ui-state__action">
            {actionLabel}
          </Link>
        </>
      ) : null}
    </p>
  )
}

export { EmptyState, ErrorState, LoadingState }
