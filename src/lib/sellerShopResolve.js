import { fetchPublicProfile, fetchPublicProfileByUsername } from './profiles.js'
import { isProfileUuid } from './sellerShopUrls.js'

export async function fetchPublicProfileByShopParam(shopParam) {
  const param = String(shopParam ?? '').trim()

  if (!param) {
    return { data: null, error: new Error('Profile not found.') }
  }

  if (isProfileUuid(param)) {
    return fetchPublicProfile(param)
  }

  return fetchPublicProfileByUsername(param)
}
