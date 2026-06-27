import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'

function LoginPage() {
  usePageTitle('Log In')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const redirectTo = location.state?.from ?? searchParams.get('redirect') ?? '/'

  function handleSuccess({ redirectTo: nextRedirect }) {
    navigate(nextRedirect ?? redirectTo, { replace: true })
  }

  return (
    <section className="page-stub">
      <LoginForm redirectTo={redirectTo} onSuccess={handleSuccess} />
    </section>
  )
}

export default LoginPage
