import { Link } from 'react-router-dom'
import { ORDER_TYPES } from '../../lib/orders'
import './CollectionBuyerHandoverPanel.css'

function CollectionBuyerHandoverPanel({
  orderType = ORDER_TYPES.COLLECTION,
  conversationUrl = null,
  compact = false,
}) {
  const isSellerDelivery = orderType === ORDER_TYPES.SELLER_DELIVERY

  return (
    <div
      className={`collection-buyer-handover${
        compact ? ' collection-buyer-handover--compact' : ''
      }`}
    >
      <h3 className="collection-buyer-handover__title">
        {isSellerDelivery ? 'Confirm handover' : 'Confirm collection'}
      </h3>
      <p className="collection-buyer-handover__lead">
        {isSellerDelivery
          ? 'Inspect the equipment after the seller delivers it, then scan their handover QR code to confirm receipt.'
          : 'When you collect the item, ask the seller to show their collection QR code and scan it with your phone camera.'}
      </p>
      <ol className="collection-buyer-handover__steps">
        {isSellerDelivery ? (
          <>
            <li>Inspect and test the equipment once it has been delivered.</li>
            <li>Ask the seller to open this order and show their handover QR code.</li>
            <li>The buyer should scan the QR code and log in to confirm handover.</li>
            <li>Complete the inspection checks and confirm handover.</li>
          </>
        ) : (
          <>
            <li>Inspect and test the equipment at collection.</li>
            <li>Ask the seller to open this order and show their collection QR code.</li>
            <li>The buyer should scan the QR code and log in to confirm collection.</li>
            <li>Complete the inspection checks and confirm collection.</li>
          </>
        )}
      </ol>
      <p className="collection-buyer-handover__note" role="note">
        Buyer Protection starts only after you confirm handover. Do not scan the QR code until
        you are satisfied with the item.
      </p>
      {conversationUrl ? (
        <Link to={conversationUrl} className="collection-buyer-handover__action">
          Message seller to arrange {isSellerDelivery ? 'delivery' : 'collection'}
        </Link>
      ) : null}
    </div>
  )
}

export default CollectionBuyerHandoverPanel
