import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { isValidCoordinate } from '../lib/listingDistance'
import {
  fetchProfile,
  getProfileCoordinates,
  PROFILE_LOCATION_UPDATED_EVENT,
  PROFILE_UPDATED_EVENT,
} from '../lib/profiles'

export { PROFILE_LOCATION_UPDATED_EVENT, PROFILE_UPDATED_EVENT, notifyProfileLocationUpdated, notifyProfileUpdated } from '../lib/profiles'

export function useProfileBrowseLocation() {
  const { user } = useAuth()
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [profileLocation, setProfileLocation] = useState({
    latitude: null,
    longitude: null,
    locationLabel: null,
  })

  useEffect(() => {
    function handleProfileRefresh() {
      setRefreshNonce((current) => current + 1)
    }

    window.addEventListener(PROFILE_LOCATION_UPDATED_EVENT, handleProfileRefresh)
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileRefresh)
    return () => {
      window.removeEventListener(PROFILE_LOCATION_UPDATED_EVENT, handleProfileRefresh)
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileRefresh)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfileLocation({ latitude: null, longitude: null, locationLabel: null })
      return undefined
    }

    let active = true

    async function load() {
      const { data } = await fetchProfile(user.id, { email: user.email })

      if (!active) return

      const { latitude, longitude } = getProfileCoordinates(data)

      setProfileLocation({
        latitude,
        longitude,
        locationLabel: data?.location?.trim() || null,
      })
    }

    load()

    return () => {
      active = false
    }
  }, [user?.email, user?.id, refreshNonce])

  const hasCoordinates =
    isValidCoordinate(profileLocation.latitude) && isValidCoordinate(profileLocation.longitude)

  return {
    ...profileLocation,
    hasCoordinates,
  }
}
