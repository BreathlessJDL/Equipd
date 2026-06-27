import { useLocation, useNavigate } from 'react-router-dom'
import SignupForm from '../components/auth/SignupForm'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'

function SignupPage() {
  usePageTitle('Sign Up')
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/settings'

  function handleSuccess({ redirectTo: nextRedirect }) {
    navigate(nextRedirect ?? redirectTo, { replace: true })
  }

  return (
    <section className="page-stub">
      <SignupForm redirectTo={redirectTo} onSuccess={handleSuccess} />
    </section>
  )
}

export default SignupPage
