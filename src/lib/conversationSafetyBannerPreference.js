export const CONVERSATION_SAFETY_BANNER_STORAGE_KEY = 'equipd:conversationSafetyBanner:v1'

function readStore() {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(CONVERSATION_SAFETY_BANNER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(CONVERSATION_SAFETY_BANNER_STORAGE_KEY, JSON.stringify(store))
}

export function isConversationSafetyBannerDismissed(userId, conversationId) {
  if (!userId || !conversationId) return false

  const store = readStore()
  const userRecord = store[userId]
  if (!userRecord || typeof userRecord !== 'object') return false
  return userRecord[conversationId] === true
}

export function dismissConversationSafetyBanner(userId, conversationId) {
  if (!userId || !conversationId) return

  const store = readStore()
  const userRecord =
    store[userId] && typeof store[userId] === 'object' ? { ...store[userId] } : {}
  userRecord[conversationId] = true
  writeStore({ ...store, [userId]: userRecord })
}
