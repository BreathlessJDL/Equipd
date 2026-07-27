import './ValuationStepper.css'

const DEFAULT_STEPS = [
  { id: 'product', label: 'Product' },
  { id: 'details', label: 'Details' },
  { id: 'results', label: 'Estimate' },
]

/**
 * Shared horizontal valuation progress stepper.
 * Used across product, details and estimate stages.
 *
 * Layout: circles on one row with connectors between them;
 * labels sit on a second row so connectors never cross text.
 */
export default function ValuationStepper({
  steps = DEFAULT_STEPS,
  currentStepId,
  className = '',
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId)

  return (
    <ol
      className={['valuation-stepper', className].filter(Boolean).join(' ')}
      aria-label="Valuation progress"
    >
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStepId
        const isComplete = currentIndex > index
        const stateClass = isCurrent
          ? 'valuation-stepper__step--current'
          : isComplete
            ? 'valuation-stepper__step--complete'
            : 'valuation-stepper__step--upcoming'
        const connectorActive = currentIndex >= index

        return (
          <li
            key={step.id}
            className={['valuation-stepper__step', stateClass].join(' ')}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="valuation-stepper__track">
              {index > 0 ? (
                <span
                  className={[
                    'valuation-stepper__connector',
                    connectorActive ? 'valuation-stepper__connector--active' : '',
                  ].filter(Boolean).join(' ')}
                  aria-hidden="true"
                />
              ) : (
                <span className="valuation-stepper__connector-spacer" aria-hidden="true" />
              )}
              <span className="valuation-stepper__marker" aria-hidden="true">
                {isComplete ? (
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                    <path
                      d="M3.5 8.2 6.4 11l6.1-6.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="valuation-stepper__number">{index + 1}</span>
                )}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={[
                    'valuation-stepper__connector',
                    currentIndex > index ? 'valuation-stepper__connector--active' : '',
                  ].filter(Boolean).join(' ')}
                  aria-hidden="true"
                />
              ) : (
                <span className="valuation-stepper__connector-spacer" aria-hidden="true" />
              )}
            </div>
            <span className="valuation-stepper__label">{step.label}</span>
            <span className="visually-hidden">
              {isComplete ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'}
              {`: ${step.label}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export { DEFAULT_STEPS as VALUATION_STEPPER_STEPS }
