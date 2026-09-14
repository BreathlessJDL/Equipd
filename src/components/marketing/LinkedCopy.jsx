import { Link } from 'react-router-dom'
import { plainTextFromLinkedCopy } from '../../lib/linkedCopy.js'

/**
 * Render plain or linked SEO copy using existing buy-page__guide-link styles.
 * @param {{ value: import('../../lib/linkedCopy.js').LinkedCopyValue, className?: string, as?: 'p' | 'span' }} props
 */
export default function LinkedCopy({ value, className = '', as = 'p' }) {
  const Tag = as === 'span' ? 'span' : 'p'

  if (value == null || value === '') {
    return null
  }

  if (typeof value === 'string') {
    return <Tag className={className || undefined}>{value}</Tag>
  }

  const parts = Array.isArray(value) ? value : [value]

  return (
    <Tag className={className || undefined}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={`t-${index}`}>{part}</span>
        }
        if (part?.link?.to && part?.link?.label) {
          return (
            <span key={`l-${index}-${part.link.to}`}>
              {part.before || ''}
              <Link to={part.link.to} className="buy-page__guide-link">
                {part.link.label}
              </Link>
              {part.after || ''}
            </span>
          )
        }
        return <span key={`f-${index}`}>{plainTextFromLinkedCopy(part)}</span>
      })}
    </Tag>
  )
}
