import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import './CanonicalEquipmentAutocomplete.css'

const CanonicalEquipmentAutocomplete = lazy(() => import('./CanonicalEquipmentAutocomplete'))

/** Warm the component chunk once the page is settled, not during first paint. */
const IDLE_WARM_DELAY_MS = 3000

let modulePromise = null

function loadAutocompleteModule() {
  if (!modulePromise) {
    modulePromise = import('./CanonicalEquipmentAutocomplete')
  }
  return modulePromise
}

/**
 * Renders a visually identical search input immediately, then swaps in the real
 * autocomplete on first interaction. Keeps the ~1MB product search index and its
 * ranking code off the homepage critical path without changing the UI.
 */
function DeferredEquipmentAutocomplete({ id, value, placeholder, inputClassName = '', disabled = false, ...props }) {
  const [active, setActive] = useState(false)

  // Resolve the chunk before swapping so the input is replaced exactly once and
  // the caret does not bounce through a Suspense fallback.
  const activate = useCallback(() => {
    if (active) return
    void loadAutocompleteModule().then(() => setActive(true))
  }, [active])

  useEffect(() => {
    if (active) return undefined

    const timeoutId = window.setTimeout(() => {
      void loadAutocompleteModule()
    }, IDLE_WARM_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [active])

  const placeholderInput = (
    <PlaceholderInput
      id={id}
      value={value}
      placeholder={placeholder}
      inputClassName={inputClassName}
      disabled={disabled}
      onChange={props.onChange}
      onActivate={active ? undefined : activate}
    />
  )

  if (!active) return placeholderInput

  return (
    <Suspense fallback={placeholderInput}>
      <CanonicalEquipmentAutocomplete
        id={id}
        value={value}
        placeholder={placeholder}
        inputClassName={inputClassName}
        disabled={disabled}
        openOnMount
        {...props}
      />
    </Suspense>
  )
}

function PlaceholderInput({ id, value, placeholder, inputClassName, disabled, onChange, onActivate }) {
  return (
    <div className="canonical-autocomplete">
      <input
        id={id}
        className={`canonical-autocomplete__input ${inputClassName}`.trim()}
        type="search"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => {
          onChange?.(event.target.value)
          onActivate?.()
        }}
        onFocus={onActivate}
        onPointerDown={onActivate}
      />
    </div>
  )
}

export default DeferredEquipmentAutocomplete
