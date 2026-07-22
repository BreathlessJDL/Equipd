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
  quantity,
}) {
  if (payment) {
    return resolvePaymentSellerPayoutTotals(payment)
  }

  if (order) {
    return resolveOrderSellerPayoutTotals(order)
  }

  if (itemPricePence != null && itemPricePence > 0) {
    const totals = calculateSellerPayoutTotals(itemPricePence)
    return Number(quantity) > 1 && itemPricePence % Number(quantity) === 0
      ? { ...totals, quantity: Number(quantity), agreedUnitPricePence: itemPricePence / Number(quantity) }
      : { ...totals, quantity: 1, agreedUnitPricePence: itemPricePence }
  }

  if (amountInput) {
    const parsedPence = parsePriceToPence(amountInput)
    if (!parsedPence) return null
    const totals = calculateSellerPayoutTotals(parsedPence)
    return Number(quantity) > 1 && parsedPence % Number(quantity) === 0
      ? { ...totals, quantity: Number(quantity), agreedUnitPricePence: parsedPence / Number(quantity) }
      : { ...totals, quantity: 1, agreedUnitPricePence: parsedPence }
  }

  return null
}

function SellerPayoutSummary({
  itemPricePence = null,
  payment = null,
  order = null,
  amountInput = '',
  quantity = 1,
  compact = false,
  hubFinance = false,
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
    quantity,
  })

  if (!totals?.itemPricePence) {
    return null
  }

  const feeLabel = hubFinance ? 'Seller service fee' : `${SELLER_SERVICE_FEE_LABEL} (2%)`

  return (
    <div
      className={`seller-payout-summary${
        compact ? ' seller-payout-summary--compact' : ''
      }${hubFinance ? ' seller-payout-summary--hub-finance' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <dl className="seller-payout-summary__rows">
        {totals.quantity > 1 ? (
          <>
            <div className="seller-payout-summary__row">
              <dt>Unit price</dt>
              <dd>{formatPricePence(totals.agreedUnitPricePence)}</dd>
            </div>
            <div className="seller-payout-summary__row">
              <dt>Quantity</dt>
              <dd>{totals.quantity}</dd>
            </div>
          </>
        ) : null}
        <div className="seller-payout-summary__row">
          <dt>{totals.quantity > 1 ? 'Item subtotal' : offerAmountLabel}</dt>
          <dd>{formatPricePence(totals.itemPricePence)}</dd>
        </div>
        <div className="seller-payout-summary__row">
          <dt>{feeLabel}</dt>
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
