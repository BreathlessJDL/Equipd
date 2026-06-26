import { Link } from 'react-router-dom'
import './HelpCentre.css'

function HelpCentreMoreHelp() {
  return (
    <section className="help-centre-more-help" aria-labelledby="help-centre-more-help-title">
      <h2 id="help-centre-more-help-title" className="help-centre-more-help__title">
        Need more help?
      </h2>
      <p className="help-centre-more-help__text">
        Can&apos;t find the answer you&apos;re looking for? Contact our support team and we&apos;ll
        guide you to the right place.
      </p>
      <Link to="/support" className="help-centre-more-help__button">
        Contact Support
      </Link>
    </section>
  )
}

export default HelpCentreMoreHelp
