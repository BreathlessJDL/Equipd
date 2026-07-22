import { formatBuyerProtectionPricePence } from '../lib/buyerProtection'
import {
  resolveOrderSellerPayoutTotals,
  resolvePaymentSellerPayoutTotals,
  SELLER_SERVICE_FEE_LABEL,
} from '../lib/sellerServiceFee'
import { formatPricePence } from '../lib/listings'

function OrderFinancialBreakdown({ order, payment, viewerRole = 'admin' }) {
  const itemPricePence =
    order?.item_subtotal_pence ??
    order?.item_price_pence ??
    order?.amount_pence ??
    payment?.item_subtotal_pence ??
    payment?.amount_pence ??
    0
  const quantity = order?.quantity ?? payment?.quantity ?? 1
  const unitPricePence =
    order?.agreed_unit_price_pence ??
    payment?.agreed_unit_price_pence ??
    (itemPricePence && quantity ? itemPricePence / quantity : 0)
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

  const buyerRows = [
    ...(quantity > 1
      ? [
          { label: 'Unit price', value: formatPricePence(unitPricePence) },
          { label: 'Quantity', value: String(quantity) },
        ]
      : []),
    { label: quantity > 1 ? 'Item subtotal' : 'Sale price', value: formatPricePence(itemPricePence) },
    { label: 'Buyer Protection fee', value: formatBuyerProtectionPricePence(buyerProtectionFeePence) },
    { label: 'Buyer total (Stripe charge)', value: formatBuyerProtectionPricePence(stripeChargePence) },
  ]
  const adminRows = [
    ...buyerRows,
    { label: `${SELLER_SERVICE_FEE_LABEL} (2%)`, value: formatBuyerProtectionPricePence(sellerTotals.sellerServiceFeePence) },
    { label: 'Seller net payout (Stripe transfer)', value: formatBuyerProtectionPricePence(stripeTransferPence) },
  ]

  if (viewerRole === 'seller') {
    return (
      <dl className="order-detail__info-list">
        {quantity > 1 ? (
          <>
            <div className="order-detail__info-row">
              <dt className="order-detail__info-label">Unit price</dt>
              <dd className="order-detail__info-value">{formatPricePence(unitPricePence)}</dd>
            </div>
            <div className="order-detail__info-row">
              <dt className="order-detail__info-label">Quantity</dt>
              <dd className="order-detail__info-value">{quantity}</dd>
            </div>
          </>
        ) : null}
        <div className="order-detail__info-row">
          <dt className="order-detail__info-label">
            {quantity > 1 ? 'Item subtotal' : 'Sale price'}
          </dt>
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
      {(viewerRole === 'buyer' ? buyerRows : adminRows).map((row) => (
        <div key={row.label} className="order-detail__info-row">
          <dt className="order-detail__info-label">{row.label}</dt>
          <dd className="order-detail__info-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default OrderFinancialBreakdown
