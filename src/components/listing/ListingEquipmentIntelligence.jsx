import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductManufacturedFromYear, productHasValuationRrp } from '../../lib/equipmentValuation'
import { buildListingIntelligenceSummary } from '../../lib/listingDiscovery'
import './ListingEquipmentIntelligence.css'

function canRequestValuationContext(equipmentProduct) {
  return Boolean(
    equipmentProduct?.id
    && productHasValuationRrp(equipmentProduct)
    && getProductManufacturedFromYear(equipmentProduct) != null,
  )
}

/**
 * Compact Equipd Intelligence panel for mapped listings only.
 */
function ListingEquipmentIntelligence({ listing, equipmentProduct }) {
  const [valuationContext, setValuationContext] = useState({
    options: [],
    modifiers: [],
    ready: !canRequestValuationContext(equipmentProduct),
  })

  useEffect(() => {
    if (!canRequestValuationContext(equipmentProduct)) {
      setValuationContext({ options: [], modifiers: [], ready: true })
      return undefined
    }

    let active = true
    setValuationContext({ options: [], modifiers: [], ready: false })

    async function loadValuationContext() {
      const { getProductConsoleOptionsCached, getValuationConsoleModifiers } = await import(
        '../../lib/valuationCatalogCache'
      )
      const [consoleResult, modifierResult] = await Promise.all([
        getProductConsoleOptionsCached(equipmentProduct.id).catch(() => ({ options: [] })),
        getValuationConsoleModifiers().catch(() => ({ modifiers: [] })),
      ])
      if (!active) return
      setValuationContext({
        options: consoleResult.options ?? [],
        modifiers: modifierResult.modifiers ?? [],
        ready: true,
      })
    }

    loadValuationContext()
    return () => {
      active = false
    }
  }, [equipmentProduct?.id])

  const summary = useMemo(() => {
    if (!valuationContext.ready) return null
    return buildListingIntelligenceSummary(listing, equipmentProduct, {
      productConsoleOptions: valuationContext.options,
      modifiers: valuationContext.modifiers,
    })
  }, [listing, equipmentProduct, valuationContext])

  if (!summary) return null

  return (
    <section
      className="listing-equipment-intelligence"
      aria-labelledby="listing-equipment-intelligence-title"
    >
      <header className="listing-equipment-intelligence__header">
        <h2 id="listing-equipment-intelligence-title" className="listing-equipment-intelligence__title">
          Equipd Intelligence
        </h2>
      </header>

      <dl className="listing-equipment-intelligence__fields">
        {summary.fields.map((field) => (
          <div key={field.key} className="listing-equipment-intelligence__row">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <p className="listing-equipment-intelligence__disclaimer">{summary.disclaimer}</p>

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
      </div>
    </section>
  )
}

export default ListingEquipmentIntelligence
