import { useState } from 'react'
import {
  getAvailableFulfilmentMethodOptions,
  getAutoFulfilmentMethod,
  FULFILMENT_METHOD_LABELS,
  FULFILMENT_METHOD_DESCRIPTIONS,
  listingRequiresFulfilmentSelection,
} from '../lib/fulfilmentMethods'
import './FulfilmentMethodSelector.css'

function FulfilmentMethodSelector({
  options,
  selectedOrderType,
  onSelect,
  name = 'fulfilment-method',
  disabled = false,
  compact = false,
}) {
  if (!options?.length) return null

  return (
    <fieldset
      className={`fulfilment-method-selector${
        compact ? ' fulfilment-method-selector--compact' : ''
      }`}
    >
      <legend className="fulfilment-method-selector__title">
        How will you receive this item?
      </legend>
      <div className="fulfilment-method-selector__options">
        {options.map(({ orderType, label, disabled: optionDisabled, disabledReason }) => {
          const isDisabled = disabled || optionDisabled
          const isSelected = selectedOrderType === orderType
          const title = label ?? FULFILMENT_METHOD_LABELS[orderType] ?? orderType
          const description = FULFILMENT_METHOD_DESCRIPTIONS[orderType] ?? ''

          return (
            <label
              key={orderType}
              className={`fulfilment-method-selector__option${
                isSelected ? ' fulfilment-method-selector__option--selected' : ''
              }${isDisabled ? ' fulfilment-method-selector__option--disabled' : ''}`}
            >
              <input
                type="radio"
                className="fulfilment-method-selector__input"
                name={name}
                value={orderType}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onSelect(orderType)}
              />
              <span className="fulfilment-method-selector__check" aria-hidden="true">
                ✓
              </span>
              <span className="fulfilment-method-selector__copy">
                <span className="fulfilment-method-selector__label">{title}</span>
                {description ? (
                  <span className="fulfilment-method-selector__desc">{description}</span>
                ) : null}
                {isDisabled && disabledReason ? (
                  <span className="fulfilment-method-selector__hint">{disabledReason}</span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function useFulfilmentMethodSelection(listing, order, context = {}) {
  const selectionContext = { ...context, forBuyerSelection: true }
  const options = getAvailableFulfilmentMethodOptions(listing, selectionContext)
  const autoMethod = getAutoFulfilmentMethod(listing, selectionContext)
  const [selectedOrderType, setSelectedOrderType] = useState(() => {
    const persisted = order?.order_type ?? null
    if (persisted) return persisted
    if (autoMethod) return autoMethod
    return null
  })

  function handleSelect(orderType) {
    const option = options.find((item) => item.orderType === orderType)
    if (option?.disabled) return
    setSelectedOrderType(orderType)
  }

  const selectableOrderTypes = options.filter((option) => !option.disabled).map((o) => o.orderType)
  const effectiveSelection =
    selectedOrderType && selectableOrderTypes.includes(selectedOrderType)
      ? selectedOrderType
      : null

  return {
    options,
    selectedOrderType: effectiveSelection,
    setSelectedOrderType: handleSelect,
    requiresSelection: listingRequiresFulfilmentSelection(listing, selectionContext),
    isReady: Boolean(order?.order_type || effectiveSelection),
  }
}

export default FulfilmentMethodSelector
