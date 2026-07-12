function OverviewParagraphs({ text }) {
  const paragraphs = String(text ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (!paragraphs.length) {
    return <p className="equipment-product-content__overview-text">{text}</p>
  }

  return paragraphs.map((paragraph) => (
    <p key={paragraph.slice(0, 48)} className="equipment-product-content__overview-text">
      {paragraph}
    </p>
  ))
}

export function EquipmentProductAboutSection({
  overviewText,
  contentBadgeLabel = null,
}) {
  const text = String(overviewText ?? '').trim()
  if (!text) return null

  return (
    <section
      className="equipment-product-content equipment-product-content--about"
      aria-labelledby="equipment-about-title"
    >
      <div className="equipment-product-content__heading-row">
        <h2 id="equipment-about-title" className="equipment-product-content__title">
          Product information
        </h2>
        {contentBadgeLabel ? (
          <span className="equipment-product-content__draft-badge">
            {contentBadgeLabel}
          </span>
        ) : null}
      </div>
      <div className="equipment-product-content__overview">
        <OverviewParagraphs text={text} />
      </div>
    </section>
  )
}

export function EquipmentProductFaqSection({
  faqs = [],
  contentBadgeLabel = null,
}) {
  if (!faqs.length) return null

  return (
    <section
      className="equipment-product-content equipment-product-content--faq"
      aria-labelledby="equipment-faq-title"
    >
      <div className="equipment-product-content__heading-row">
        <h2 id="equipment-faq-title" className="equipment-product-content__title">
          Common questions
        </h2>
        {contentBadgeLabel ? (
          <span className="equipment-product-content__draft-badge">
            {contentBadgeLabel}
          </span>
        ) : null}
      </div>
      <div className="equipment-product-content__faq-list">
        {faqs.map((entry) => (
          <details key={entry.question} className="equipment-product-content__faq-item">
            <summary className="equipment-product-content__faq-question">
              {entry.question}
            </summary>
            <p className="equipment-product-content__faq-answer">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
