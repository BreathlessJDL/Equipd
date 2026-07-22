export type CheckoutCommerceSnapshot = {
  quantity: number
  listingUnitPricePence: number
  agreedUnitPricePence: number
  itemSubtotalPence: number
  buyerProtectionFeePence: number
  buyerTotalPence: number
}

type CommerceRecord = Record<string, unknown>

function integer(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function resolveCheckoutCommerceSnapshot(
  payment: CommerceRecord,
  order: CommerceRecord,
): CheckoutCommerceSnapshot {
  const quantity = integer(order.quantity)
  const listingUnitPricePence = integer(order.listing_unit_price_pence)
  const agreedUnitPricePence = integer(order.agreed_unit_price_pence)
  const itemSubtotalPence = integer(order.item_subtotal_pence)
  const buyerProtectionFeePence = integer(order.buyer_protection_fee_pence)
  const buyerTotalPence = integer(order.buyer_total_pence)

  if (quantity == null || quantity < 1 || quantity > 999) {
    throw new Error('Order quantity is invalid')
  }

  if (
    agreedUnitPricePence == null
    || agreedUnitPricePence <= 0
    || listingUnitPricePence == null
    || listingUnitPricePence <= 0
    || agreedUnitPricePence > listingUnitPricePence
    || itemSubtotalPence == null
    || itemSubtotalPence !== agreedUnitPricePence * quantity
    || order.amount_pence !== itemSubtotalPence
  ) {
    throw new Error('Order pricing snapshot is invalid')
  }

  if (
    buyerProtectionFeePence == null
    || buyerProtectionFeePence < 0
    || buyerTotalPence == null
    || buyerTotalPence !== itemSubtotalPence + buyerProtectionFeePence
    || payment.quantity !== quantity
    || payment.listing_unit_price_pence !== listingUnitPricePence
    || payment.agreed_unit_price_pence !== agreedUnitPricePence
    || payment.item_subtotal_pence !== itemSubtotalPence
    || payment.amount_pence !== itemSubtotalPence
    || payment.buyer_protection_fee_pence !== buyerProtectionFeePence
    || payment.buyer_total_pence !== buyerTotalPence
    || order.payment_id !== payment.id
    || order.buyer_id !== payment.buyer_id
    || order.seller_id !== payment.seller_id
    || order.listing_id !== payment.listing_id
  ) {
    throw new Error('Payment and order snapshots do not match')
  }

  return {
    quantity,
    listingUnitPricePence,
    agreedUnitPricePence,
    itemSubtotalPence,
    buyerProtectionFeePence,
    buyerTotalPence,
  }
}

export function buildCheckoutLineItems(
  snapshot: CheckoutCommerceSnapshot,
  listingTitle: string,
) {
  return [
    {
      quantity: snapshot.quantity,
      price_data: {
        currency: 'gbp',
        unit_amount: snapshot.agreedUnitPricePence,
        product_data: {
          name: listingTitle,
          description: `Accepted offer for ${snapshot.quantity} item${
            snapshot.quantity === 1 ? '' : 's'
          }`,
        },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: snapshot.buyerProtectionFeePence,
        product_data: {
          name: 'Buyer Protection',
          description: 'Equipd Buyer Protection for this purchase',
        },
      },
    },
  ]
}
