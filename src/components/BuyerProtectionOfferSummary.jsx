import { formatPricePence, parsePriceToPence } from '../lib/listings'
import {
  BUYER_PROTECTION_FEE_NOTE,
  calculateBuyerCheckoutTotals,
  formatBuyerProtectionPricePence,
  resolveOrderCheckoutTotals,
  resolvePaymentCheckoutTotals,
} from '../lib/buyerProtection'
import BuyerProtectionPriceDisplay from './BuyerProtectionPriceDisplay'
import './BuyerProtectionOfferSummary.css'

function resolveBuyerProtectionTotals({
  itemPricePence,
  payment,
  order,
  amountInput,
}) {
  if (payment) {
    return resolvePaymentCheckoutTotals(payment)
  }

  if (order) {
    return resolveOrderCheckoutTotals(order)
  }

  if (itemPricePence != null && itemPricePence > 0) {
    return calculateBuyerCheckoutTotals(itemPricePence)
  }

  if (amountInput) {
    const parsedPence = parsePriceToPence(amountInput)
    if (!parsedPence) return null
    return calculateBuyerCheckoutTotals(parsedPence)
  }

  return null
}

function BuyerProtectionOfferSummary({
  itemPricePence = null,
  payment = null,
  order = null,
  amountInput = '',
  compact = false,
  showNote = true,
  showStackedPrice = true,
  showBreakdown = true,
  offerAmountLabel = 'Offer amount',
  totalLabel = 'Total payable if accepted',
  className = '',
}) {
  const totals = resolveBuyerProtectionTotals({
    itemPricePence,
    payment,
    order,
    amountInput,
  })

  if (!totals?.itemPricePence) {
    return null
  }

  return (
    <div
      className={`buyer-protection-offer-summary${
        compact ? ' buyer-protection-offer-summary--compact' : ''
      }${className ? ` ${className}` : ''}`}
    >
      {showStackedPrice ? (
        <BuyerProtectionPriceDisplay
          itemPricePence={itemPricePence}
          payment={payment}
          order={order}
          amountInput={amountInput}
          compact={compact}
          className="buyer-protection-offer-summary__stack"
        />
      ) : null}

      {showBreakdown ? (
        <dl className="buyer-protection-offer-summary__rows">
          {totals.quantity > 1 ? (
            <>
              <div className="buyer-protection-offer-summary__row">
                <dt>Unit price</dt>
                <dd>{formatPricePence(totals.agreedUnitPricePence)}</dd>
              </div>
              <div className="buyer-protection-offer-summary__row">
                <dt>Quantity</dt>
                <dd>{totals.quantity}</dd>
              </div>
            </>
          ) : null}
          <div className="buyer-protection-offer-summary__row">
            <dt>{offerAmountLabel}</dt>
            <dd>{formatPricePence(totals.itemPricePence)}</dd>
          </div>
          <div className="buyer-protection-offer-summary__row">
            <dt>Buyer Protection</dt>
            <dd>{formatBuyerProtectionPricePence(totals.buyerProtectionFeePence)}</dd>
          </div>
          <div className="buyer-protection-offer-summary__row buyer-protection-offer-summary__row--total">
            <dt>{totalLabel}</dt>
            <dd>{formatBuyerProtectionPricePence(totals.buyerTotalPence)}</dd>
          </div>
        </dl>
      ) : null}
      {showNote ? (
        <p className="buyer-protection-offer-summary__note">{BUYER_PROTECTION_FEE_NOTE}</p>
      ) : null}
    </div>
  )
}

export default BuyerProtectionOfferSummary
