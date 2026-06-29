import './OrderDisputeSection.css'

function SupportUpdateCard({ statusLabel, message, updatedAt }) {
  const trimmedMessage = message?.trim()
  if (!trimmedMessage) return null

  return (
    <section className="order-support-update" aria-labelledby="order-support-update-title">
      <h3 id="order-support-update-title" className="order-support-update__title">
        Support update
      </h3>
      <dl className="order-support-update__meta">
        <div className="order-support-update__row">
          <dt className="order-support-update__label">Status</dt>
          <dd className="order-support-update__value">{statusLabel}</dd>
        </div>
        <div className="order-support-update__row order-support-update__row--message">
          <dt className="order-support-update__label">Message from Equipd</dt>
          <dd className="order-support-update__message">{trimmedMessage}</dd>
        </div>
        {updatedAt ? (
          <div className="order-support-update__row">
            <dt className="order-support-update__label">Updated</dt>
            <dd className="order-support-update__value">{updatedAt}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

export default SupportUpdateCard
