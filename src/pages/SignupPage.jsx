import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SignupEmailConfirmation from '../components/auth/SignupEmailConfirmation'
import SignupForm from '../components/auth/SignupForm'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'

function SignupPage() {
  usePageTitle('Sign Up')
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/settings'
  const [confirmationEmail, setConfirmationEmail] = useState('')

  function handleSuccess({ redirectTo: nextRedirect }) {
    navigate(nextRedirect ?? redirectTo, { replace: true })
  }

  if (confirmationEmail) {
    return (
      <section className="page-stub">
        <SignupEmailConfirmation
          idPrefix="signup-page-confirmation"
          email={confirmationEmail}
          onOpenLogin={() => navigate('/login', { state: { from: redirectTo } })}
          onClose={() => navigate('/')}
        />
      </section>
    )
  }

  return (
    <section className="page-stub">
      <SignupForm
        redirectTo={redirectTo}
        onSuccess={handleSuccess}
        onEmailConfirmationRequired={({ email }) => setConfirmationEmail(email)}
      />
    </section>
  )
}

export default SignupPage
