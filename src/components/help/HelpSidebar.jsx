import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HomeIcon } from '../icons/NavIcons'
import { HELP_CATEGORY_SECTIONS, getHelpArticleBySlug } from '../../data/helpArticles'
import './HelpCentre.css'

function HelpSidebarGroup({ title, articleSlugs, activeSlug }) {
  return (
    <div className="help-sidebar__group">
      <h3 className="help-sidebar__group-title">{title}</h3>
      <ul className="help-sidebar__links">
        {articleSlugs.map((slug) => {
          const article = getHelpArticleBySlug(slug)
          if (!article) return null

          return (
            <li key={slug}>
              <Link
                to={`/help/${slug}`}
                className={`help-sidebar__link${
                  activeSlug === slug ? ' help-sidebar__link--active' : ''
                }`}
              >
                {article.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function HelpSidebarNav({ activeSlug }) {
  const isHomeActive = !activeSlug

  return (
    <>
      <p className="help-sidebar__heading">Topics</p>
      <div className="help-sidebar__home">
        <Link
          to="/help"
          className={`help-sidebar__home-link${
            isHomeActive ? ' help-sidebar__home-link--active' : ''
          }`}
        >
          <HomeIcon className="help-sidebar__home-icon" />
          <span>Help Centre Home</span>
        </Link>
        <hr className="help-sidebar__divider" />
      </div>
      {HELP_CATEGORY_SECTIONS.map((category) => (
        <HelpSidebarGroup
          key={category.id}
          title={category.title}
          articleSlugs={category.articleSlugs}
          activeSlug={activeSlug}
        />
      ))}
    </>
  )
}

function HelpSidebar({ activeSlug = '' }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="help-sidebar" aria-label="Help topics">
      <button
        type="button"
        className="help-sidebar__mobile-toggle"
        aria-expanded={mobileOpen}
        aria-controls="help-sidebar-mobile-panel"
        onClick={() => setMobileOpen((open) => !open)}
      >
        Browse help topics
      </button>

      <div
        id="help-sidebar-mobile-panel"
        className="help-sidebar__mobile-panel"
        hidden={!mobileOpen}
      >
        <div style={{ padding: 'var(--space-md)' }}>
          <HelpSidebarNav activeSlug={activeSlug} />
        </div>
      </div>

      <div className="help-sidebar__desktop">
        <HelpSidebarNav activeSlug={activeSlug} />
      </div>
    </nav>
  )
}

export default HelpSidebar
