import { ADMIN_DISPUTE_DECISIONS } from './orderDisputes'

export const ADMIN_DECISION_CUSTOMER_MESSAGE_DEFAULTS = {
  [ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW]:
    'Thank you for your patience. Equipd is now reviewing this case. We will contact you if we need anything else, or when we have an update.',
  [ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE]:
    'To help us review your case, we need a little more information. Please upload any relevant photos, videos, receipts, or delivery proof on this order page.',
  [ADMIN_DISPUTE_DECISIONS.AUTHORISE_RETURN]:
    'We have authorised a return for this order. The seller must arrange and pay for collection within 7 days. Please make the item available for collection. Delivery or courier costs from the original purchase are usually not refundable.',
  [ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_WITHOUT_RETURN]:
    'We have approved a full refund for this order. We will process the refund manually and let you know when it is complete. Delivery or courier costs are usually not refundable unless the law requires it.',
  [ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_AFTER_COLLECTION]:
    'The return is complete and we are now processing your full refund. We will update this order when the refund has been sent. Delivery or courier costs are usually not refundable unless the law requires it.',
  [ADMIN_DISPUTE_DECISIONS.REJECT_CLAIM]:
    'We have reviewed your case carefully. We are unable to uphold this claim under Buyer Protection. The order will continue as normal.',
  [ADMIN_DISPUTE_DECISIONS.APPROVE_FULL_REFUND]:
    'We have approved a full refund for this order. We will process the refund manually and let you know when it is complete.',
  [ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND]:
    'We have recorded the partial refund amount agreed between you and the other party. We will process that refund manually and update this order when it is complete.',
  [ADMIN_DISPUTE_DECISIONS.MARK_RESOLVED_MANUALLY]:
    'This case has been marked as resolved. If you need anything else, please contact Equipd support.',
}

export function getDefaultAdminDecisionCustomerMessage(decision) {
  return ADMIN_DECISION_CUSTOMER_MESSAGE_DEFAULTS[decision] ?? ''
}
