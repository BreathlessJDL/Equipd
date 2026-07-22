import BuyerProtectionOfferSummary from './BuyerProtectionOfferSummary'

function PaymentCheckoutSummary({
  payment,
  order,
  compact = false,
  className = '',
  showNote = true,
  offerAmountLabel = 'Item price',
  totalLabel = 'Total',
}) {
  const quantity = order?.quantity ?? payment?.quantity ?? 1
  const resolvedOfferAmountLabel =
    quantity > 1 && offerAmountLabel === 'Item price' ? 'Item subtotal' : offerAmountLabel

  return (
    <BuyerProtectionOfferSummary
      payment={payment}
      order={order}
      compact={compact}
      showNote={showNote}
      offerAmountLabel={resolvedOfferAmountLabel}
      totalLabel={totalLabel}
      className={className}
    />
  )
}

export default PaymentCheckoutSummary
