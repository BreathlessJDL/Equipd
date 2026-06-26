import { Link } from 'react-router-dom'
import { getHelpCategoryTitle } from '../../data/helpArticles'
import './HelpCentre.css'

function HelpSearchResults({ articles, title = 'Search results' }) {
  if (!articles.length) {
    return null
  }

  return (
    <section className="help-centre__results" aria-label={title}>
      <h2 className="help-centre__results-title">{title}</h2>
      <ul className="help-centre__results-list">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link to={`/help/${article.slug}`} className="help-centre__result-card">
              <p className="help-centre__result-card-title">{article.title}</p>
              <p className="help-centre__result-card-excerpt">
                {article.excerpt}
                <span aria-hidden="true"> · </span>
                <span>{getHelpCategoryTitle(article.category)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default HelpSearchResults
