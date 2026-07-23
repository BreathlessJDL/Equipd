import { Link } from 'react-router-dom'
import { buildListingIntelligenceSummary } from '../../lib/listingDiscovery'
import './ListingEquipmentIntelligence.css'

/**
 * Concise Equipd Intelligence panel for mapped listings only.
 */
function ListingEquipmentIntelligence({ listing, equipmentProduct }) {
  const summary = buildListingIntelligenceSummary(listing, equipmentProduct)
  if (!summary) return null

  return (
    <section
      className="listing-equipment-intelligence"
      aria-labelledby="listing-equipment-intelligence-title"
    >
      <header className="listing-equipment-intelligence__header">
        <h2 id="listing-equipment-intelligence-title" className="listing-equipment-intelligence__title">
          About this equipment
        </h2>
        <p className="listing-equipment-intelligence__eyebrow">Equipd Intelligence</p>
      </header>

      <p className="listing-equipment-intelligence__disclaimer">{summary.disclaimer}</p>

      <dl className="listing-equipment-intelligence__fields">
        {summary.fields.map((field) => (
          <div key={field.key} className="listing-equipment-intelligence__row">
            <dt>{field.label}</dt>
            <dd>
              {field.value}
              {field.note ? (
                <span className="listing-equipment-intelligence__field-note">{field.note}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="listing-equipment-intelligence__actions">
        {summary.equipmentHref ? (
          <Link to={summary.equipmentHref} className="listing-equipment-intelligence__link">
            View full product information
          </Link>
        ) : null}
        {summary.valuationHref ? (
          <Link to={summary.valuationHref} className="listing-equipment-intelligence__link">
            Value this equipment
          </Link>
        ) : null}
        {summary.brandHref ? (
          <Link to={summary.brandHref} className="listing-equipment-intelligence__link listing-equipment-intelligence__link--secondary">
            More from this brand
          </Link>
        ) : null}
      </div>
    </section>
  )
}

export default ListingEquipmentIntelligence
