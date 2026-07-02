import { useState } from 'react'
import { formatPricePence, parsePriceToPence } from '../lib/listings'
import {
  calculateBuyerCheckoutTotals,
  formatBuyerProtectionPricePence,
  normalizeListingPricePence,
  resolveOrderCheckoutTotals,
  resolvePaymentCheckoutTotals,
} from '../lib/buyerProtection'
import BuyerProtectionModal from './BuyerProtectionModal'
import './BuyerProtectionPriceDisplay.css'

function resolveBuyerProtectionDisplayTotals({
  itemPricePence = null,
  payment = null,
  order = null,
  amountInput = '',
} = {}) {
  if (payment) {
    const totals = resolvePaymentCheckoutTotals(payment)
    if (!totals.itemPricePence) return null
    return totals
  }

  if (order) {
    const totals = resolveOrderCheckoutTotals(order)
    if (!totals.itemPricePence) return null
    return totals
  }

  const normalizedPrice = normalizeListingPricePence(itemPricePence)
  if (normalizedPrice != null) {
    return calculateBuyerCheckoutTotals(normalizedPrice)
  }

  if (amountInput) {
    const parsedPence = parsePriceToPence(amountInput)
    if (!parsedPence) return null
    return calculateBuyerCheckoutTotals(parsedPence)
  }

  return null
}

function ShieldMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 3.25 3.5v4.25c0 3.45 2.05 6.65 4.75 7.75 2.7-1.1 4.75-4.3 4.75-7.75V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 8 7.25 9.5 10.25 6.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BuyerProtectionIncludesLink({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`buyer-protection-price__link${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      Includes Buyer Protection
      <ShieldMark className="buyer-protection-price__link-icon" />
    </button>
  )
}

function BuyerProtectionPriceDisplay({
  itemPricePence = null,
  payment = null,
  order = null,
  amountInput = '',
  compact = false,
  hubFinance = false,
  className = '',
}) {
  const [modalOpen, setModalOpen] = useState(false)

  function openProtectionModal(event) {
    event.preventDefault()
    event.stopPropagation()
    setModalOpen(true)
  }

  const totals = resolveBuyerProtectionDisplayTotals({
    itemPricePence,
    payment,
    order,
    amountInput,
  })

  if (!totals?.itemPricePence) {
    return (
      <div
        className={`buyer-protection-price${
          compact ? ' buyer-protection-price--compact' : ''
        }${hubFinance ? ' buyer-protection-price--hub-finance' : ''}${
          className ? ` ${className}` : ''
        }`}
      >
        <p className="buyer-protection-price__item buyer-protection-price__item--primary">
          {formatPricePence(normalizeListingPricePence(itemPricePence))}
        </p>
      </div>
    )
  }

  if (hubFinance) {
    return (
      <>
        <div
          className={`buyer-protection-price buyer-protection-price--hub-finance${
            className ? ` ${className}` : ''
          }`}
        >
          <dl className="buyer-protection-price__finance-rows hub-item-finance">
            <div className="hub-item-finance__row">
              <dt>Offer price</dt>
              <dd>{formatPricePence(totals.itemPricePence)}</dd>
            </div>
            <div className="hub-item-finance__row hub-item-finance__row--total">
              <dt>Total</dt>
              <dd>{formatBuyerProtectionPricePence(totals.buyerTotalPence)}</dd>
            </div>
          </dl>
        </div>
        <BuyerProtectionModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div
        className={`buyer-protection-price${
          compact ? ' buyer-protection-price--compact' : ''
        }${className ? ` ${className}` : ''}`}
      >
        <p className="buyer-protection-price__item buyer-protection-price__item--primary">
          {formatPricePence(totals.itemPricePence)}
        </p>
        {compact ? (
          <p className="buyer-protection-price__total buyer-protection-price__total--compact">
            <span className="buyer-protection-price__total-amount">
              {formatBuyerProtectionPricePence(totals.buyerTotalPence)}
            </span>
            <span className="buyer-protection-price__total-suffix">
              <span className="buyer-protection-price__total-incl">incl.</span>
              <button
                type="button"
                className="buyer-protection-price__shield-button"
                onClick={openProtectionModal}
                aria-label="Includes Buyer Protection"
              >
                <ShieldMark className="buyer-protection-price__shield-button-icon" />
              </button>
            </span>
          </p>
        ) : (
          <p className="buyer-protection-price__total">
            {formatBuyerProtectionPricePence(totals.buyerTotalPence)}
          </p>
        )}
        {!compact ? (
          <BuyerProtectionIncludesLink onClick={openProtectionModal} />
        ) : null}
      </div>

      <BuyerProtectionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}

export default BuyerProtectionPriceDisplay
