import { Component } from 'react'
import { Link } from 'react-router-dom'
import '../Hub.css'
import './HubErrorBoundary.css'

export class HubErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[hub] Render error caught by HubErrorBoundary', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (!error) {
      return this.props.children
    }

    const message = error?.message || 'Something went wrong loading My Hub.'
    const stack = error?.stack || ''

    return (
      <section className="hub-page hub-dashboard">
        <header className="hub-dashboard__header">
          <h2 className="hub-page__title">My Hub</h2>
        </header>
        <div className="hub-page__message hub-page__message--error" role="alert">
          <p>
            <strong>My Hub could not load.</strong> {message}
          </p>
          <p className="hub-page__lead">
            Your listings and orders are still safe. Try refreshing, or return to the homepage.
          </p>
          <div className="hub-panel__actions">
            <button type="button" className="hub-panel__action hub-panel__action--primary" onClick={this.handleRetry}>
              Try again
            </button>
            <Link to="/" className="hub-panel__action">
              Back to homepage
            </Link>
          </div>
          {import.meta.env.DEV && stack ? (
            <pre className="hub-error-boundary__stack">{stack}</pre>
          ) : null}
        </div>
      </section>
    )
  }
}

export default HubErrorBoundary
