import { useMemo, useState } from 'react'
import { formatCaseUpdateStatus, formatCaseUpdateTimestamp, getCaseUpdateMessageForViewer } from '../lib/caseUpdates'
import './OrderCaseUpdatesHistory.css'

const DEFAULT_PREVIEW_COUNT = 2

function OrderCaseUpdatesHistory({
  updates,
  viewerRole = null,
  isAdminViewer = false,
  hideTitle = false,
  previewCount = DEFAULT_PREVIEW_COUNT,
}) {
  const [showAll, setShowAll] = useState(false)

  const visibleUpdates = useMemo(() => {
    if (!updates?.length) return []

    const chronological = [...updates].sort(
      (left, right) => new Date(left.created_at) - new Date(right.created_at),
    )

    if (showAll || chronological.length <= previewCount) {
      return chronological
    }

    return chronological.slice(-previewCount)
  }, [previewCount, showAll, updates])

  if (!updates?.length) return null

  const hiddenCount = updates.length - visibleUpdates.length

  return (
    <section className="order-case-updates" aria-labelledby="order-case-updates-title">
      {hideTitle ? null : (
        <h3 id="order-case-updates-title" className="order-case-updates__title">
          Support updates
        </h3>
      )}
      <ol className="order-case-updates__list">
        {visibleUpdates.map((update) => {
          const customerMessage = getCaseUpdateMessageForViewer(update, viewerRole)

          return (
            <li key={update.id} className="order-case-updates__item">
              <article className="order-case-updates__card">
                <header className="order-case-updates__header">
                  <p className="order-case-updates__status">
                    {formatCaseUpdateStatus(update.status)}
                  </p>
                  <time className="order-case-updates__time" dateTime={update.created_at}>
                    {formatCaseUpdateTimestamp(update.created_at)}
                  </time>
                </header>

                {customerMessage ? (
                  <div className="order-case-updates__message-block">
                    <p className="order-case-updates__label">Message from Equipd</p>
                    <p className="order-case-updates__message">{customerMessage}</p>
                  </div>
                ) : null}

                {isAdminViewer && update.internal_note?.trim() ? (
                  <div className="order-case-updates__internal">
                    <p className="order-case-updates__label">Internal note</p>
                    <p className="order-case-updates__internal-note">{update.internal_note}</p>
                  </div>
                ) : null}
              </article>
            </li>
          )
        })}
      </ol>

      {!showAll && hiddenCount > 0 ? (
        <button
          type="button"
          className="order-case-updates__show-all"
          onClick={() => setShowAll(true)}
        >
          Show all {updates.length} updates
        </button>
      ) : null}
    </section>
  )
}

export default OrderCaseUpdatesHistory
