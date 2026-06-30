import { formatBuyerProtectionPricePence } from '../lib/buyerProtection'
import {
  resolveOrderSellerPayoutTotals,
  resolvePaymentSellerPayoutTotals,
  SELLER_SERVICE_FEE_LABEL,
} from '../lib/sellerServiceFee'
import { formatPricePence } from '../lib/listings'

function OrderFinancialBreakdown({ order, payment, viewerRole = 'admin' }) {
  const itemPricePence = order?.item_price_pence ?? order?.amount_pence ?? payment?.amount_pence ?? 0
  const buyerProtectionFeePence =
    order?.buyer_protection_fee_pence ??
    payment?.buyer_protection_fee_pence ??
    0
  const buyerTotalPence =
    order?.buyer_total_pence ?? payment?.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence
  const sellerTotals = order
    ? resolveOrderSellerPayoutTotals(order)
    : resolvePaymentSellerPayoutTotals(payment)
  const stripeChargePence = buyerTotalPence
  const stripeTransferPence = sellerTotals.sellerNetPence

  if (!itemPricePence) return null

  const rows = [
    { label: 'Sale price', value: formatPricePence(itemPricePence) },
    { label: 'Buyer Protection fee', value: formatBuyerProtectionPricePence(buyerProtectionFeePence) },
    { label: 'Buyer total (Stripe charge)', value: formatBuyerProtectionPricePence(stripeChargePence) },
    { label: `${SELLER_SERVICE_FEE_LABEL} (2%)`, value: formatBuyerProtectionPricePence(sellerTotals.sellerServiceFeePence) },
    { label: 'Seller net payout (Stripe transfer)', value: formatBuyerProtectionPricePence(stripeTransferPence) },
  ]

  if (viewerRole === 'seller') {
    return (
      <dl className="order-detail__info-list">
        <div className="order-detail__info-row">
          <dt className="order-detail__info-label">Sale price</dt>
          <dd className="order-detail__info-value">{formatPricePence(itemPricePence)}</dd>
        </div>
        <div className="order-detail__info-row">
          <dt className="order-detail__info-label">{SELLER_SERVICE_FEE_LABEL} (2%)</dt>
          <dd className="order-detail__info-value">
            {formatBuyerProtectionPricePence(sellerTotals.sellerServiceFeePence)}
          </dd>
        </div>
        <div className="order-detail__info-row">
          <dt className="order-detail__info-label">Payout amount</dt>
          <dd className="order-detail__info-value">
            {formatBuyerProtectionPricePence(stripeTransferPence)}
          </dd>
        </div>
      </dl>
    )
  }

  return (
    <dl className="order-detail__info-list">
      {rows.map((row) => (
        <div key={row.label} className="order-detail__info-row">
          <dt className="order-detail__info-label">{row.label}</dt>
          <dd className="order-detail__info-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default OrderFinancialBreakdown
