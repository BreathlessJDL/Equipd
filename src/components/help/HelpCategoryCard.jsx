import { Link } from 'react-router-dom'
import { HELP_CATEGORY_SECTIONS, getHelpArticleBySlug } from '../../data/helpArticles'
import './HelpCentre.css'

function HelpCategoryCard({ category }) {
  const articles = category.articleSlugs
    .map((slug) => getHelpArticleBySlug(slug))
    .filter(Boolean)

  return (
    <article className="help-category-card">
      <h2 className="help-category-card__title">{category.title}</h2>
      <ul className="help-category-card__links">
        {articles.map((article) => (
          <li key={`${category.id}-${article.slug}`}>
            <Link to={`/help/${article.slug}`} className="help-category-card__link">
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default HelpCategoryCard
