import { useState } from 'react'
import {
  getAvailableFulfilmentMethodOptions,
  getAutoFulfilmentMethod,
  FULFILMENT_METHOD_LABELS,
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

          return (
            <label
              key={orderType}
              className={`fulfilment-method-selector__option${
                isDisabled ? ' fulfilment-method-selector__option--disabled' : ''
              }`}
            >
              <input
                type="radio"
                name={name}
                value={orderType}
                checked={selectedOrderType === orderType}
                disabled={isDisabled}
                onChange={() => onSelect(orderType)}
              />
              <span className="fulfilment-method-selector__copy">
                <span className="fulfilment-method-selector__label">
                  {label ?? FULFILMENT_METHOD_LABELS[orderType] ?? orderType}
                </span>
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
