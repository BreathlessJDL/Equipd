import { Link } from 'react-router-dom'
import { getCompatibleConsoleOptions } from '../../lib/consoleCompatibility'
import {
  buildManufactureYearDropdownOptions,
  formatValuationMoney,
  formatValuationRange,
  INSUFFICIENT_VALUATION_MESSAGE,
  parseSelectedManufactureYear,
  resolveManufactureYearSelectValue,
} from '../../lib/equipmentValuation'
import './EquipmentProductValuationCard.css'

export default function EquipmentProductValuationCard({
  product,
  valuation,
  currency = 'GBP',
  manufactureYear,
  onManufactureYearChange,
  consoleName,
  onConsoleNameChange,
  productConsoleOptions = [],
  currentYear = new Date().getFullYear(),
  valuationUrl = '/valuation',
  canValue = true,
  showConsoleField = false,
}) {
  const manufactureYearOptions = buildManufactureYearDropdownOptions({
    baseline_manufacture_year: product?.baseline_manufacture_year,
    production_start_year: product?.production_start_year,
    production_end_year: product?.production_end_year,
    console_compatibility: productConsoleOptions,
    current_year: currentYear,
  })
  const selectValue = resolveManufactureYearSelectValue(product, manufactureYear, {
    current_year: currentYear,
    console_compatibility: productConsoleOptions,
  })

  const selectedYear = parseSelectedManufactureYear(selectValue)
  const consoleState = getCompatibleConsoleOptions({
    productId: product?.id ?? null,
    manufactureYear: selectedYear,
    options: productConsoleOptions,
    audience: 'public',
  })
  const showConsoleSelect = showConsoleField && consoleState.showSelector
  const appliedConsoleName = consoleState.appliedOption?.console_name
    || consoleState.defaultConsoleName
    || consoleName
    || ''
  const showConsoleReadonly = showConsoleField
    && !showConsoleSelect
    && Boolean(appliedConsoleName)
  const isIntegratedConsole = Boolean(consoleState.fixedOnly)

  return (
    <section className="equipment-valuation-card" aria-labelledby="equipment-valuation-card-title">
      <h2 id="equipment-valuation-card-title" className="equipment-valuation-card__title">
        Estimated market value
      </h2>

      {valuation?.ok ? (
        <>
          <div className="equipment-valuation-card__range">
            <div className="equipment-valuation-card__range-item">
              <span className="equipment-valuation-card__range-label">Low</span>
              <strong>{formatValuationMoney(valuation.estimated_low, currency)}</strong>
            </div>
            <div className="equipment-valuation-card__range-item equipment-valuation-card__range-item--mid">
              <span className="equipment-valuation-card__range-label">Mid</span>
              <strong>{formatValuationMoney(valuation.estimated_mid, currency)}</strong>
            </div>
            <div className="equipment-valuation-card__range-item">
              <span className="equipment-valuation-card__range-label">High</span>
              <strong>{formatValuationMoney(valuation.estimated_high, currency)}</strong>
            </div>
          </div>

          <div className="equipment-valuation-card__controls">
            <div className="equipment-valuation-card__field">
              <label className="equipment-valuation-card__label" htmlFor="equipment-product-manufacture-year">
                Manufacture year
              </label>
              <select
                id="equipment-product-manufacture-year"
                className="equipment-valuation-card__select"
                value={selectValue}
                onChange={(event) => onManufactureYearChange(event.target.value)}
                disabled={!canValue || manufactureYearOptions.length === 0}
              >
                {manufactureYearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {showConsoleSelect ? (
              <div className="equipment-valuation-card__field">
                <label className="equipment-valuation-card__label" htmlFor="equipment-product-console">
                  Console variant
                </label>
                <select
                  id="equipment-product-console"
                  className="equipment-valuation-card__select"
                  value={consoleName}
                  onChange={(event) => onConsoleNameChange(event.target.value)}
                  disabled={!canValue || selectedYear == null}
                >
                  {consoleState.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {showConsoleReadonly ? (
              <div className="equipment-valuation-card__field">
                <span className="equipment-valuation-card__label" id="equipment-product-console-readonly-label">
                  Console
                </span>
                <p
                  className="equipment-valuation-card__readonly-value"
                  aria-labelledby="equipment-product-console-readonly-label"
                >
                  {appliedConsoleName}
                </p>
                {isIntegratedConsole ? (
                  <p className="equipment-valuation-card__hint">
                    Integrated console — applied automatically
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="equipment-valuation-card__summary">
            <div className="equipment-valuation-card__summary-item">
              <span>Typical range</span>
              <strong>
                {formatValuationRange(valuation.estimated_low, valuation.estimated_high, currency)}
              </strong>
            </div>
            <div className="equipment-valuation-card__summary-item">
              <span>Age</span>
              <strong>{valuation.age_years} years</strong>
            </div>
          </div>

          <Link
            to={valuationUrl}
            className="equipment-valuation-card__cta"
          >
            Value your equipment
          </Link>
        </>
      ) : (
        <div className="equipment-valuation-card__insufficient">
          <p>{INSUFFICIENT_VALUATION_MESSAGE}</p>
          <Link
            to={valuationUrl}
            className="equipment-valuation-card__cta equipment-valuation-card__cta--secondary"
          >
            Open valuation tool
          </Link>
        </div>
      )}
    </section>
  )
}
