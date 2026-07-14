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
import { usePageMeta } from '../hooks/usePageMeta'
import { buildHelpArticleBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import { useMemo } from 'react'

function HelpArticlePage() {
  const { slug } = useParams()
  const article = getHelpArticleBySlug(slug)
  usePageMeta({
    title: article?.title ?? 'Help Article',
    description: article?.excerpt
      || (article?.slug === 'buyer-protection'
        ? 'Learn how Equipd Buyer Protection works when buying used gym equipment, including fees, the 24-hour window and how to raise a dispute.'
        : 'Help and guidance for buying and selling used gym equipment on Equipd.'),
    canonicalPath: article?.slug ? `/help/${article.slug}` : '/help',
  })
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
