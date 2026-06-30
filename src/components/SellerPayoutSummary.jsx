import { formatPricePence, parsePriceToPence } from '../lib/listings'
import { formatBuyerProtectionPricePence } from '../lib/buyerProtection'
import {
  calculateSellerPayoutTotals,
  resolveOrderSellerPayoutTotals,
  resolvePaymentSellerPayoutTotals,
  SELLER_SERVICE_FEE_LABEL,
  SELLER_SERVICE_FEE_NOTE,
} from '../lib/sellerServiceFee'
import './SellerPayoutSummary.css'

function resolveSellerPayoutTotals({
  itemPricePence,
  payment,
  order,
  amountInput,
}) {
  if (payment) {
    return resolvePaymentSellerPayoutTotals(payment)
  }

  if (order) {
    return resolveOrderSellerPayoutTotals(order)
  }

  if (itemPricePence != null && itemPricePence > 0) {
    return calculateSellerPayoutTotals(itemPricePence)
  }

  if (amountInput) {
    const parsedPence = parsePriceToPence(amountInput)
    if (!parsedPence) return null
    return calculateSellerPayoutTotals(parsedPence)
  }

  return null
}

function SellerPayoutSummary({
  itemPricePence = null,
  payment = null,
  order = null,
  amountInput = '',
  compact = false,
  showNote = false,
  offerAmountLabel = 'Offer price',
  receiveLabel = "You'll receive",
  className = '',
}) {
  const totals = resolveSellerPayoutTotals({
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
      className={`seller-payout-summary${
        compact ? ' seller-payout-summary--compact' : ''
      }${className ? ` ${className}` : ''}`}
    >
      <dl className="seller-payout-summary__rows">
        <div className="seller-payout-summary__row">
          <dt>{offerAmountLabel}</dt>
          <dd>{formatPricePence(totals.itemPricePence)}</dd>
        </div>
        <div className="seller-payout-summary__row">
          <dt>{SELLER_SERVICE_FEE_LABEL} (2%)</dt>
          <dd>{formatBuyerProtectionPricePence(totals.sellerServiceFeePence)}</dd>
        </div>
        <div className="seller-payout-summary__row seller-payout-summary__row--total">
          <dt>{receiveLabel}</dt>
          <dd>{formatBuyerProtectionPricePence(totals.sellerNetPence)}</dd>
        </div>
      </dl>
      {showNote ? <p className="seller-payout-summary__note">{SELLER_SERVICE_FEE_NOTE}</p> : null}
    </div>
  )
}

export default SellerPayoutSummary
