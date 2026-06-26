import { Link } from 'react-router-dom'
import './SupportFlow.css'

function SupportProgress({ step }) {
  return <p className="support-flow__progress">Step {step} of 3</p>
}

function SupportFlowHeader({ step, title, subtitle, onBack, showBack = true }) {
  return (
    <header className="support-flow__header">
      {showBack ? (
        <button type="button" className="support-flow__back" onClick={onBack}>
          ← Back
        </button>
      ) : null}
      <SupportProgress step={step} />
      <h1 className="support-flow__title">{title}</h1>
      {subtitle ? <p className="support-flow__subtitle">{subtitle}</p> : null}
    </header>
  )
}

function SupportCategoryStep({ categories, onSelect }) {
  return (
    <div className="support-flow__grid support-flow__grid--categories">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className="support-flow__card"
          onClick={() => onSelect(category.id)}
        >
          <h2 className="support-flow__card-title">{category.title}</h2>
          <p className="support-flow__card-description">{category.description}</p>
        </button>
      ))}
    </div>
  )
}

function SupportIssueStep({ category, onSelect }) {
  return (
    <>
      <h2 className="support-flow__section-title">
        {category.issuePrompt ?? 'What is your issue?'}
      </h2>
      <div className="support-flow__grid">
        {category.issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            className="support-flow__card"
            onClick={() => onSelect(issue.id)}
          >
            <h3 className="support-flow__card-title">{issue.title}</h3>
          </button>
        ))}
      </div>
    </>
  )
}

function SupportArticlesStep({
  category,
  issue,
  articles,
  onSolved,
  onNeedHelp,
}) {
  return (
    <>
      <p className="support-flow__context">
        <strong>{category.title}</strong> · {issue.title}
      </p>

      <h2 className="support-flow__section-title">Suggested articles</h2>
      <div className="support-flow__articles">
        {articles.map((article) => (
          <Link
            key={article.slug}
            to={`/help/${article.slug}`}
            className="support-flow__article-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <h3 className="support-flow__article-title">{article.title}</h3>
            <p className="support-flow__article-excerpt">{article.excerpt}</p>
          </Link>
        ))}
      </div>

      <div className="support-flow__actions">
        <button
          type="button"
          className="support-flow__button support-flow__button--primary"
          onClick={onSolved}
        >
          This solved my issue
        </button>
        <button
          type="button"
          className="support-flow__button support-flow__button--secondary"
          onClick={onNeedHelp}
        >
          I still need help
        </button>
      </div>
    </>
  )
}

function SupportContactForm({
  category,
  issue,
  name,
  email,
  subject,
  message,
  submitting,
  error,
  onChange,
  onSubmit,
}) {
  return (
    <>
      <p className="support-flow__context">
        <strong>{category.title}</strong> · {issue.title}
      </p>

      <form className="support-flow__form" onSubmit={onSubmit} noValidate>
        <div className="support-flow__field">
          <label className="support-flow__label" htmlFor="support-name">
            Name
          </label>
          <input
            id="support-name"
            className="support-flow__input"
            type="text"
            name="name"
            value={name}
            onChange={onChange}
            autoComplete="name"
            required
          />
        </div>

        <div className="support-flow__field">
          <label className="support-flow__label" htmlFor="support-email">
            Email
          </label>
          <input
            id="support-email"
            className="support-flow__input"
            type="email"
            name="email"
            value={email}
            onChange={onChange}
            autoComplete="email"
            required
          />
        </div>

        <div className="support-flow__field">
          <label className="support-flow__label" htmlFor="support-subject">
            Subject
          </label>
          <input
            id="support-subject"
            className="support-flow__input"
            type="text"
            name="subject"
            value={subject}
            onChange={onChange}
            required
          />
        </div>

        <div className="support-flow__field">
          <label className="support-flow__label" htmlFor="support-message">
            Message
          </label>
          <textarea
            id="support-message"
            className="support-flow__textarea"
            name="message"
            value={message}
            onChange={onChange}
            required
          />
        </div>

        {error ? <p className="support-flow__error">{error}</p> : null}

        <button
          type="submit"
          className="support-flow__button support-flow__button--primary"
          disabled={submitting}
        >
          {submitting ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </>
  )
}

function SupportSuccess({ title, message, actionLabel, actionTo }) {
  return (
    <div className="support-flow__success">
      <h2 className="support-flow__success-title">{title}</h2>
      <p className="support-flow__success-text">{message}</p>
      <Link to={actionTo} className="support-flow__button support-flow__button--primary">
        {actionLabel}
      </Link>
    </div>
  )
}

export {
  SupportArticlesStep,
  SupportCategoryStep,
  SupportContactForm,
  SupportFlowHeader,
  SupportIssueStep,
  SupportSuccess,
}
