import HelpCentreMoreHelp from '../components/help/HelpCentreMoreHelp'
import HelpCategoryCard from '../components/help/HelpCategoryCard'
import HelpHero from '../components/help/HelpHero'
import HelpSearchResults from '../components/help/HelpSearchResults'
import '../components/help/HelpCentre.css'
import { useHelpCentreSearch } from '../hooks/useHelpCentreSearch'
import { usePageTitle } from '../hooks/usePageTitle'

function HelpCentrePage() {
  usePageTitle('Help Centre')
  const { searchQuery, setSearchQuery, searchResults, isSearching, emptySearchMessage, categories } =
    useHelpCentreSearch()

  return (
    <div className="help-centre">
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
