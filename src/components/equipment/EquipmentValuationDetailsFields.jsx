import {
  getCompatibleConsoleOptions,
  isCompatibleConsoleValidForYear,
  shouldShowConsoleEvidence,
} from '../../lib/consoleCompatibility'
import { supportsProductConsoleOptions } from '../../lib/equipmentCardio'
import {
  buildManufactureYearDropdownOptions,
  parseSelectedManufactureYear,
  resolveManufactureYearSelectValue,
} from '../../lib/equipmentValuation'

export default function EquipmentValuationDetailsFields({
  product,
  productConsoleOptions = [],
  manufactureYear,
  onManufactureYearChange,
  consoleName,
  onConsoleNameChange,
  currentYear = new Date().getFullYear(),
  disabled = false,
  manufactureYearId = 'equipment-manufacture-year',
  consoleId = 'equipment-console',
  showConsoleField: showConsoleFieldProp = null,
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

  const supportsConsoles = supportsProductConsoleOptions(product)
  const showConsoleEvidence = showConsoleFieldProp != null
    ? showConsoleFieldProp
    : supportsConsoles && shouldShowConsoleEvidence(consoleState)
  const showConsoleSelect = showConsoleEvidence && consoleState.showSelector
  const appliedConsoleName = consoleState.appliedOption?.console_name
    || consoleState.defaultConsoleName
    || consoleName
    || ''
  const showConsoleReadonly = showConsoleEvidence
    && !showConsoleSelect
    && Boolean(appliedConsoleName)
  const isIntegratedConsole = Boolean(consoleState.fixedOnly)

  return (
    <>
      <div className="valuation-page__field">
        <label className="valuation-page__label" htmlFor={manufactureYearId}>
          Manufacture year
        </label>
        <select
          id={manufactureYearId}
          className="valuation-page__select"
          value={selectValue}
          onChange={(event) => onManufactureYearChange(event.target.value)}
          disabled={disabled || manufactureYearOptions.length === 0}
        >
          {manufactureYearOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!supportsConsoles ? (
          <p className="valuation-page__hint">
            Select the year this item was manufactured.
          </p>
        ) : null}
      </div>

      {showConsoleSelect ? (
        <div className="valuation-page__field valuation-page__field--console">
          <label className="valuation-page__label" htmlFor={consoleId}>
            Console / monitor
          </label>
          <p className="valuation-page__hint valuation-page__hint--console">
            Available console variants and images update when you change the manufacture year.
          </p>
          <select
            id={consoleId}
            className="valuation-page__select"
            value={consoleName}
            onChange={(event) => onConsoleNameChange(event.target.value)}
            disabled={disabled || selectedYear == null}
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
        <div className="valuation-page__field valuation-page__field--console">
          <span className="valuation-page__label" id={`${consoleId}-readonly-label`}>
            Console / monitor
          </span>
          <p
            className="valuation-page__readonly-value"
            aria-labelledby={`${consoleId}-readonly-label`}
          >
            {appliedConsoleName}
          </p>
          <p className="valuation-page__hint">
            {isIntegratedConsole
              ? 'Integrated console — applied automatically. There is no alternative to choose.'
              : 'Only one console option is available for the selected manufacture year.'}
          </p>
        </div>
      ) : null}
    </>
  )
}

export function shouldResetConsoleForYearChange({
  manufactureYear,
  consoleName,
  productConsoleOptions = [],
}) {
  if (!consoleName) return false
  const selectedYear = parseSelectedManufactureYear(manufactureYear)
  if (selectedYear == null) return true

  return !isCompatibleConsoleValidForYear({
    productConsoleOptions,
    manufactureYear: selectedYear,
    consoleName,
  })
}
