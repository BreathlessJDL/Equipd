import { Link } from 'react-router-dom'
import './HelpCentre.css'

function renderParagraphBlock(block, index) {
  if (block.segments?.length) {
    return (
      <p key={index}>
        {block.segments.map((segment, segmentIndex) => {
          if (segment.link) {
            return (
              <Link key={segmentIndex} to={segment.link.to}>
                {segment.link.label}
              </Link>
            )
          }

          return <span key={segmentIndex}>{segment.text}</span>
        })}
      </p>
    )
  }

  return <p key={index}>{block.text}</p>
}

function HelpArticleBody({ content }) {
  return (
    <div className="help-article__body">
      {content.map((block, index) => {
        if (block.type === 'heading') {
          return <h2 key={index}>{block.text}</h2>
        }

        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'note') {
          return (
            <aside key={index} className="help-article__note">
              {block.text}
            </aside>
          )
        }

        if (block.type === 'paragraph') {
          return renderParagraphBlock(block, index)
        }

        return null
      })}
    </div>
  )
}

function formatUpdatedDate(value) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function HelpArticleContent({ article }) {
  const updatedLabel = formatUpdatedDate(article.updatedAt)

  return (
    <article className="help-article">
      <div className="help-article__card">
        <header className="help-article__header">
          <h1 className="help-article__title">{article.title}</h1>
          {updatedLabel ? (
            <p className="help-article__meta">Last updated {updatedLabel}</p>
          ) : null}
        </header>

        <HelpArticleBody content={article.content} />
      </div>
    </article>
  )
}

export default HelpArticleContent
