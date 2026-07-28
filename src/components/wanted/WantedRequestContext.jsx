import { useCallback, useMemo, useRef, useState } from 'react'
import WantedRequestModal from './WantedRequestModal'
import { WantedRequestContext } from './wantedRequestContextValue'
import { WANTED_REQUEST_SOURCES } from '../../lib/wantedRequestConstants'
import { trackWantedRequestCtaClicked, trackWantedRequestModalOpened } from '../../lib/wantedRequestAnalytics'

export function WantedRequestProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [sessionKey, setSessionKey] = useState(0)
  const triggerRef = useRef(/** @type {Element | null} */ (null))

  const closeWantedRequest = useCallback(() => {
    setOpen(false)
    setDraft(null)

    const trigger = triggerRef.current
    triggerRef.current = null
    if (trigger && typeof trigger.focus === 'function') {
      window.requestAnimationFrame(() => {
        try {
          trigger.focus()
        } catch {
          // Ignore focus restore failures (detached nodes).
        }
      })
    }
  }, [])

  const openWantedRequest = useCallback((options = {}) => {
    const source = options.source || WANTED_REQUEST_SOURCES.HOMEPAGE
    triggerRef.current = options.triggerElement ?? null

    const nextDraft = {
      source,
      product: options.product ?? null,
      brand: options.brand ?? options.product?.brand ?? null,
      searchTerm: options.searchTerm ?? '',
      location: options.location ?? '',
      equipmentType: options.equipmentType ?? options.product?.equipmentType ?? null,
      preferredEntryMode: options.preferredEntryMode ?? null,
      suggestManualFromSearch: Boolean(options.suggestManualFromSearch),
    }

    setDraft(nextDraft)
    setSessionKey((value) => value + 1)
    setOpen(true)

    trackWantedRequestCtaClicked({
      source,
      product_id: nextDraft.product?.productId ?? null,
      product_name: nextDraft.product?.productName ?? null,
      brand: nextDraft.brand ?? null,
      search_term: nextDraft.searchTerm || null,
    })
    trackWantedRequestModalOpened({
      source,
      product_id: nextDraft.product?.productId ?? null,
      brand: nextDraft.brand ?? null,
    })
  }, [])

  const value = useMemo(
    () => ({
      openWantedRequest,
      closeWantedRequest,
      isWantedRequestOpen: open,
    }),
    [openWantedRequest, closeWantedRequest, open],
  )

  return (
    <WantedRequestContext.Provider value={value}>
      {children}
      {open ? (
        <WantedRequestModal
          key={sessionKey}
          open={open}
          draft={draft}
          onClose={closeWantedRequest}
        />
      ) : null}
    </WantedRequestContext.Provider>
  )
}
