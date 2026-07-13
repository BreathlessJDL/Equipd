import { useMemo } from 'react'
import HelpCentreMoreHelp from '../components/help/HelpCentreMoreHelp'
import HelpCategoryCard from '../components/help/HelpCategoryCard'
import HelpHero from '../components/help/HelpHero'
import HelpSearchResults from '../components/help/HelpSearchResults'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import '../components/help/HelpCentre.css'
import { useHelpCentreSearch } from '../hooks/useHelpCentreSearch'
import { usePageTitle } from '../hooks/usePageTitle'
import { buildHelpCentreBreadcrumbSchema } from '../lib/breadcrumbStructuredData'

function HelpCentrePage() {
  usePageTitle('Help Centre')
  const { searchQuery, setSearchQuery, searchResults, isSearching, emptySearchMessage, categories } =
    useHelpCentreSearch()
  const breadcrumbSchema = useMemo(() => buildHelpCentreBreadcrumbSchema(), [])

  return (
    <div className="help-centre">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <HelpHero searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="help-centre__body">
        {isSearching ? (
          searchResults.length > 0 ? (
            <HelpSearchResults articles={searchResults} />
          ) : (
            <p className="help-centre__empty">{emptySearchMessage}</p>
          )
        ) : (
          <div className="help-centre__home-grid">
            {categories.map((category) => (
              <HelpCategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
        {!isSearching ? <HelpCentreMoreHelp /> : null}
      </div>
    </div>
  )
}

export default HelpCentrePage
