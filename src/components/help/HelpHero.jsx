import { HELP_CENTRE_HERO } from '../../data/helpArticles'
import HelpSearch from './HelpSearch'
import './HelpCentre.css'

function HelpHero({ searchQuery, onSearchChange }) {
  return (
    <header className="help-centre__hero">
      <div className="help-centre__hero-inner">
        <div className="help-centre__hero-copy">
          <h1 className="help-centre__hero-title">{HELP_CENTRE_HERO.title}</h1>
          <p className="help-centre__hero-subtitle">{HELP_CENTRE_HERO.subtitle}</p>
        </div>

        <div className="help-centre__search-wrap">
          <HelpSearch
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={HELP_CENTRE_HERO.searchPlaceholder}
          />
        </div>
      </div>
    </header>
  )
}

export default HelpHero
