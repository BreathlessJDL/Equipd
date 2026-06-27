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
  return (
    <BuyerProtectionOfferSummary
      payment={payment}
      order={order}
      compact={compact}
      showNote={showNote}
      offerAmountLabel={offerAmountLabel}
      totalLabel={totalLabel}
      className={className}
    />
  )
}

export default PaymentCheckoutSummary
