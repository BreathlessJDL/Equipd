import BuyerProtectionOfferSummary from './BuyerProtectionOfferSummary'

function PaymentCheckoutSummary({
  payment,
  order,
  compact = false,
  className = '',
  showNote = true,
}) {
  return (
    <BuyerProtectionOfferSummary
      payment={payment}
      order={order}
      compact={compact}
      showNote={showNote}
      offerAmountLabel="Item price"
      totalLabel="Total"
      className={className}
    />
  )
}

export default PaymentCheckoutSummary
