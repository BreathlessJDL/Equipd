import { Link } from 'react-router-dom'
import { useRequireAuth } from '../../hooks/useRequireAuth'

function ProtectedLink({ to, onClick, children, ...rest }) {
  const { requireAuth } = useRequireAuth()

  function handleClick(event) {
    if (!requireAuth(to)) {
      event.preventDefault()
      return
    }

    onClick?.(event)
  }

  return (
    <Link to={to} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}

export default ProtectedLink
