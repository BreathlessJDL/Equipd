import { validateOptionalMarketplaceMessage } from './marketplaceMessageValidation'
import { insertOfferMessage, startConversationForListing } from './messages'
import { createOfferFromForm } from './offers'
import { formatPricePence } from './listings'

export async function submitListingOffer({
  listingId,
  buyerId,
  sellerId,
  amountInput,
  message,
  listingPricePence,
  quantity = 1,
}) {
  const messageValidation = validateOptionalMarketplaceMessage(message)

  if (!messageValidation.allowed) {
    return { data: null, error: new Error(messageValidation.error) }
  }

  const { data: conversation, error: conversationError } = await startConversationForListing({
    listingId,
    buyerId,
    sellerId,
  })

  if (conversationError || !conversation) {
    return {
      data: null,
      error: conversationError ?? new Error('Could not open a conversation for this offer.'),
    }
  }

  const { data: offer, error: offerError } = await createOfferFromForm({
    listingId,
    buyerId,
    sellerId,
    amountInput,
    message: messageValidation.sanitizedBody,
    conversationId: conversation.id,
    listingPricePence,
    quantity,
  })

  if (offerError || !offer) {
    return { data: null, error: offerError ?? new Error('Could not create offer.') }
  }

  const { data: offerMessage, error: messageError } = await insertOfferMessage({
    conversationId: conversation.id,
    offerId: offer.id,
    senderId: buyerId,
    body: `Offer for ${offer.quantity} ${offer.quantity === 1 ? 'item' : 'items'}: ${formatPricePence(offer.amount_pence)} total (${formatPricePence(offer.amount_pence / offer.quantity)} per item)`,
  })

  if (messageError) {
    return {
      data: { offer, conversation },
      error: messageError,
    }
  }

  return {
    data: {
      offer,
      conversation,
      message: offerMessage,
    },
    error: null,
  }
}
