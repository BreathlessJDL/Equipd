import { Link, useParams } from 'react-router-dom'
import HelpCentreMoreHelp from '../components/help/HelpCentreMoreHelp'
import HelpArticleContent from '../components/help/HelpArticleContent'
import HelpHero from '../components/help/HelpHero'
import HelpSearchResults from '../components/help/HelpSearchResults'
import HelpSidebar from '../components/help/HelpSidebar'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import '../components/help/HelpCentre.css'
import { getHelpArticleBySlug } from '../data/helpArticles'
import { useHelpCentreSearch } from '../hooks/useHelpCentreSearch'
import { usePageTitle } from '../hooks/usePageTitle'
import { buildHelpArticleBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import { useMemo } from 'react'

function HelpArticlePage() {
  const { slug } = useParams()
  const article = getHelpArticleBySlug(slug)
  usePageTitle(article?.title ?? 'Help Article')
  const { searchQuery, setSearchQuery, searchResults, isSearching, emptySearchMessage } =
    useHelpCentreSearch()
  const breadcrumbSchema = useMemo(
    () => (article ? buildHelpArticleBreadcrumbSchema(article) : null),
    [article],
  )

  return (
    <div className="help-centre">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <HelpHero searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="help-centre__body">
        <div className="help-centre__article-layout">
          <HelpSidebar activeSlug={slug} />

          <div>
            {isSearching ? (
              searchResults.length > 0 ? (
                <HelpSearchResults articles={searchResults} />
              ) : (
                <p className="help-centre__empty">{emptySearchMessage}</p>
              )
            ) : article ? (
              <>
                <HelpArticleContent article={article} />
                <HelpCentreMoreHelp />
              </>
            ) : (
              <div className="help-article__not-found">
                <h1 className="help-article__title">Article not found</h1>
                <p>
                  We could not find a help article for <code>{slug}</code>. Return to the{' '}
                  <Link to="/help">Help Centre</Link> to browse topics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpArticlePage
