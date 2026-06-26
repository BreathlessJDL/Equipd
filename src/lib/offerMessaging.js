import { validateOptionalMarketplaceMessage } from './marketplaceMessageValidation'
import { insertOfferMessage, startConversationForListing } from './messages'
import { createOfferFromForm } from './offers'

export async function submitListingOffer({
  listingId,
  buyerId,
  sellerId,
  amountInput,
  message,
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
  })

  if (offerError || !offer) {
    return { data: null, error: offerError ?? new Error('Could not create offer.') }
  }

  const { data: offerMessage, error: messageError } = await insertOfferMessage({
    conversationId: conversation.id,
    offerId: offer.id,
    senderId: buyerId,
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
