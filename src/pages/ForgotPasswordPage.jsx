import ForgotPasswordForm from '../components/auth/ForgotPasswordForm'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'

function ForgotPasswordPage() {
  usePageTitle('Forgot Password')

  return (
    <section className="page-stub">
      <ForgotPasswordForm idPrefix="forgot-password-page" showBackLink />
    </section>
  )
}

export default ForgotPasswordPage
