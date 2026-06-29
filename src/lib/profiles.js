import { supabase } from './supabase'
import { isValidCoordinate } from './listingDistance'
import { profileLocationFromRecord } from './listingLocation'

const PROFILE_FIELDS_BASE =
  'id, display_name, location, latitude, longitude, avatar_url, stripe_onboarding_complete, is_admin'

const PROFILE_FIELDS_WITH_LOCATION_COLUMNS = `${PROFILE_FIELDS_BASE}, city, county, postcode`

const PROFILE_FIELDS_WITH_USERNAME = `${PROFILE_FIELDS_WITH_LOCATION_COLUMNS}, username, username_last_changed_at`

const PUBLIC_PROFILE_FIELDS_BASE = 'id, display_name, location, avatar_url, created_at'

const PUBLIC_PROFILE_FIELDS_WITH_USERNAME = `${PUBLIC_PROFILE_FIELDS_BASE}, username`

/** Cached after first probe — null until checked. */
let usernameColumnAvailable = null
let profileLocationColumnsAvailable = null

export const PROFILE_LOCATION_UPDATED_EVENT = 'equipd:profile-location-updated'
export const PROFILE_UPDATED_EVENT = 'equipd:profile-updated'

export function notifyProfileLocationUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_LOCATION_UPDATED_EVENT))
  }
}

export function notifyProfileUpdated(userId) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, {
        detail: { userId: userId ?? null },
      }),
    )
  }
}

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 24
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30

export function normalizeUsername(value) {
  return value?.trim() ?? ''
}

export function hasUsernameChanged(nextUsername, currentUsername) {
  return (
    normalizeUsername(nextUsername).toLowerCase()
    !== normalizeUsername(currentUsername).toLowerCase()
  )
}

export function getUsernameChangeEligibility(profile, nextUsername) {
  const currentUsername = profile?.username ?? ''
  if (!hasUsernameChanged(nextUsername, currentUsername)) {
    return { allowed: true, error: null, nextEligibleAt: null }
  }

  if (!currentUsername?.trim() || !profile?.username_last_changed_at) {
    return { allowed: true, error: null, nextEligibleAt: null }
  }

  const lastChanged = new Date(profile.username_last_changed_at)
  if (Number.isNaN(lastChanged.getTime())) {
    return { allowed: true, error: null, nextEligibleAt: null }
  }

  const nextEligibleAt = new Date(lastChanged)
  nextEligibleAt.setDate(nextEligibleAt.getDate() + USERNAME_CHANGE_COOLDOWN_DAYS)

  if (Date.now() < nextEligibleAt.getTime()) {
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
    }).format(nextEligibleAt)

    return {
      allowed: false,
      error: `You can only change your username once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. You can change it again after ${formattedDate}.`,
      nextEligibleAt,
    }
  }

  return { allowed: true, error: null, nextEligibleAt: null }
}

function isMissingUsernameColumnError(error) {
  if (!error) return false

  const message = error.message?.toLowerCase() ?? ''
  const details = error.details?.toLowerCase() ?? ''
  const hint = error.hint?.toLowerCase() ?? ''
  const combined = `${message} ${details} ${hint}`

  return (
    error.code === '42703'
    || combined.includes('column profiles.username does not exist')
    || (combined.includes('username') && combined.includes('does not exist'))
  )
}

function withUsernameField(profile, supported) {
  if (!profile) return profile
  if (supported || profile.username !== undefined) return profile
  return { ...profile, username: null }
}

export async function supportsUsername() {
  if (usernameColumnAvailable !== null) {
    return usernameColumnAvailable
  }

  if (!supabase) {
    usernameColumnAvailable = false
    return false
  }

  const { error } = await supabase.from('profiles_public').select('username').limit(0)

  if (!error) {
    usernameColumnAvailable = true
    return true
  }

  if (isMissingUsernameColumnError(error)) {
    usernameColumnAvailable = false
    return false
  }

  // Unknown error — assume unsupported so reads still work without username.
  usernameColumnAvailable = false
  return false
}

function isMissingProfileLocationColumnError(error) {
  if (!error) return false

  const combined = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    (error.code === '42703' || error.code === 'PGRST204')
    && (
      combined.includes('city')
      || combined.includes('county')
      || combined.includes('postcode')
    )
  )
}

function isNoProfileRowReturnedError(error) {
  if (!error) return false

  return (
    error.code === 'PGRST116'
    || /cannot coerce the result to a single json object/i.test(error.message ?? '')
  )
}

function withProfileLocationFields(profile, supported) {
  if (!profile) return profile
  if (supported || profile.city !== undefined) return profile
  return { ...profile, city: null, county: null, postcode: null }
}

export async function supportsProfileLocationColumns() {
  if (profileLocationColumnsAvailable !== null) {
    return profileLocationColumnsAvailable
  }

  if (!supabase) {
    profileLocationColumnsAvailable = false
    return false
  }

  const { error } = await supabase.from('profiles').select('city, county, postcode').limit(0)

  if (!error) {
    profileLocationColumnsAvailable = true
    return true
  }

  if (isMissingProfileLocationColumnError(error)) {
    profileLocationColumnsAvailable = false
    return false
  }

  profileLocationColumnsAvailable = false
  return false
}

async function profileSelectFields() {
  const hasUsername = await supportsUsername()
  const hasLocationColumns = await supportsProfileLocationColumns()
  const baseFields = hasLocationColumns ? PROFILE_FIELDS_WITH_LOCATION_COLUMNS : PROFILE_FIELDS_BASE
  return hasUsername ? `${baseFields}, username` : baseFields
}

async function publicProfileSelectFields() {
  const supported = await supportsUsername()
  return supported ? PUBLIC_PROFILE_FIELDS_WITH_USERNAME : PUBLIC_PROFILE_FIELDS_BASE
}

export function validateUsername(value, { required = true } = {}) {
  const username = normalizeUsername(value)

  if (!username) {
    if (!required) {
      return { valid: true, username: '', error: null }
    }

    return { valid: false, username, error: 'Username is required.' }
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      username,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    }
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      username,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
    }
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      username,
      error: 'Username can only contain letters, numbers, underscores, and hyphens.',
    }
  }

  return { valid: true, username, error: null }
}

function isMissingUsernameAvailabilityRpcError(error) {
  if (!error) return false

  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    error.code === '42883'
    || error.code === 'PGRST202'
    || (message.includes('is_username_available') && message.includes('does not exist'))
  )
}

async function isUsernameAvailableViaRpc(validation, excludeUserId) {
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: validation.username,
    p_exclude_user_id: excludeUserId ?? null,
  })

  if (error) {
    if (isMissingUsernameAvailabilityRpcError(error)) {
      return null
    }

    return { available: false, error }
  }

  if (data === true) {
    return { available: true, username: validation.username, error: null }
  }

  return { available: false, error: new Error('That username is already taken.') }
}

async function isUsernameAvailableViaView(validation, excludeUserId) {
  const { data, error } = await supabase
    .from('profiles_public')
    .select('id')
    .ilike('username', validation.username)
    .maybeSingle()

  if (error) {
    if (isMissingUsernameColumnError(error)) {
      usernameColumnAvailable = false
      return {
        available: false,
        error: new Error('Usernames are not enabled yet. Run supabase/profile-username.sql.'),
      }
    }

    return { available: false, error }
  }

  if (data && data.id !== excludeUserId) {
    return { available: false, error: new Error('That username is already taken.') }
  }

  return { available: true, username: validation.username, error: null }
}

export async function isUsernameAvailable(username, { excludeUserId } = {}) {
  if (!supabase) {
    return { available: false, error: new Error('Supabase is not configured.') }
  }

  if (!(await supportsUsername())) {
    return {
      available: false,
      error: new Error('Usernames are not enabled yet. Run supabase/profile-username.sql.'),
    }
  }

  const validation = validateUsername(username)
  if (!validation.valid) {
    return { available: false, error: new Error(validation.error) }
  }

  const rpcResult = await isUsernameAvailableViaRpc(validation, excludeUserId)
  if (rpcResult) {
    return rpcResult
  }

  return isUsernameAvailableViaView(validation, excludeUserId)
}

export function formatProfileJoinDate(createdAt) {
  if (!createdAt) return null

  try {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(createdAt))
  } catch {
    return null
  }
}

export function getProfileDisplayName(profile, { email } = {}) {
  const username = profile?.username?.trim()
  if (username) return username

  const displayName = profile?.display_name?.trim()
  if (displayName) return displayName

  const emailPrefix = email?.split('@')[0]?.trim()
  if (emailPrefix) return emailPrefix

  return 'Equipd member'
}

function avatarLetter(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.charAt(0).toUpperCase()
}

export function getProfileInitials(profile, { user } = {}) {
  const fromUsername = avatarLetter(profile?.username)
  if (fromUsername) return fromUsername

  const fromDisplayName = avatarLetter(profile?.display_name)
  if (fromDisplayName) return fromDisplayName

  const fromEmail = avatarLetter(user?.email)
  if (fromEmail) return fromEmail

  const fromFirstName = avatarLetter(user?.user_metadata?.first_name)
  if (fromFirstName) return fromFirstName

  return '?'
}

export function buildAvatarProfile(profile, user = null) {
  if (!profile) {
    if (!user) return null

    return {
      initial: getProfileInitials(null, { user }),
    }
  }

  return {
    ...profile,
    initial: getProfileInitials(profile, { user }),
  }
}

/** @deprecated Use getProfileInitials */
export function getUserInitial(profile, user) {
  return getProfileInitials(profile, { user })
}

export function getProfileLocationPlace(profile) {
  return profileLocationFromRecord(profile)
}

export function getProfileCoordinates(profile) {
  const latitude = profile?.latitude
  const longitude = profile?.longitude

  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
    return { latitude: null, longitude: null }
  }

  return { latitude: Number(latitude), longitude: Number(longitude) }
}

export function hasProfileCoordinates(profile) {
  const { latitude, longitude } = getProfileCoordinates(profile)
  return latitude != null && longitude != null
}

export async function fetchProfile(userId, { email } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let fields = await profileSelectFields()
  let { data, error } = await supabase
    .from('profiles')
    .select(fields)
    .eq('id', userId)
    .maybeSingle()

  if (error && isMissingUsernameColumnError(error)) {
    usernameColumnAvailable = false
    fields = PROFILE_FIELDS_BASE
    ;({ data, error } = await supabase
      .from('profiles')
      .select(fields)
      .eq('id', userId)
      .maybeSingle())
  }

  if (error) {
    return { data: null, error }
  }

  if (data) {
    const hasLocationColumns = await supportsProfileLocationColumns()
    return {
      data: withProfileLocationFields(
        withUsernameField(data, usernameColumnAvailable),
        hasLocationColumns,
      ),
      error: null,
    }
  }

  const displayName = email?.split('@')[0] ?? null

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, display_name: displayName })
    .select(fields)
    .single()

  if (insertError) {
    return { data: null, error: insertError }
  }

  return {
    data: withProfileLocationFields(
      withUsernameField(created, usernameColumnAvailable),
      await supportsProfileLocationColumns(),
    ),
    error: null,
  }
}

export async function fetchPublicProfilesByIds(userIds) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))]

  if (!ids.length) {
    return new Map()
  }

  if (!supabase) {
    return new Map()
  }

  let fields = await publicProfileSelectFields()
  let { data, error } = await supabase.from('profiles_public').select(fields).in('id', ids)

  if (error && isMissingUsernameColumnError(error)) {
    usernameColumnAvailable = false
    fields = PUBLIC_PROFILE_FIELDS_BASE
    ;({ data, error } = await supabase.from('profiles_public').select(fields).in('id', ids))
  }

  if (error) {
    console.error('[profiles] fetchPublicProfilesByIds', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return new Map()
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      withUsernameField(profile, usernameColumnAvailable),
    ]),
  )
}

export async function fetchPublicProfile(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let fields = await publicProfileSelectFields()
  let { data, error } = await supabase
    .from('profiles_public')
    .select(fields)
    .eq('id', userId)
    .maybeSingle()

  if (error && isMissingUsernameColumnError(error)) {
    usernameColumnAvailable = false
    fields = PUBLIC_PROFILE_FIELDS_BASE
    ;({ data, error } = await supabase
      .from('profiles_public')
      .select(fields)
      .eq('id', userId)
      .maybeSingle())
  }

  if (error) {
    return { data: null, error }
  }

  return {
    data: withUsernameField(data, usernameColumnAvailable),
    error: null,
  }
}

export async function updateProfile(
  userId,
  {
    username,
    display_name,
    location,
    city,
    county,
    postcode,
    latitude,
    longitude,
    avatar_url,
  } = {},
) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const updates = {}
  const hasLocationColumns = await supportsProfileLocationColumns()

  if (username !== undefined) {
    const normalized = normalizeUsername(username)

    if (normalized) {
      if (!(await supportsUsername())) {
        return {
          data: null,
          error: new Error('Usernames are not enabled yet. Run supabase/profile-username.sql.'),
        }
      }
    }

    updates.username = normalized || null
  }

  if (display_name !== undefined) {
    updates.display_name = display_name?.trim() || null
  }

  if (location !== undefined) {
    updates.location = location?.trim() || null
  }

  if (hasLocationColumns) {
    if (city !== undefined) updates.city = city?.trim() || null
    if (county !== undefined) updates.county = county?.trim() || null
    if (postcode !== undefined) updates.postcode = postcode?.trim() || null
  }

  if (latitude !== undefined || longitude !== undefined) {
    const lat = latitude === undefined ? undefined : latitude
    const lng = longitude === undefined ? undefined : longitude

    if (lat == null && lng == null) {
      updates.latitude = null
      updates.longitude = null
    } else if (isValidCoordinate(lat) && isValidCoordinate(lng)) {
      updates.latitude = Number(lat)
      updates.longitude = Number(lng)
    } else {
      return {
        data: null,
        error: new Error('Location coordinates must be a valid latitude and longitude pair.'),
      }
    }
  }

  if (avatar_url !== undefined) {
    updates.avatar_url = avatar_url?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return fetchProfile(userId)
  }

  let fields = await profileSelectFields()
  let { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select(fields)
    .maybeSingle()

  if (!error && !data) {
    return fetchProfile(userId)
  }

  if (error && isNoProfileRowReturnedError(error)) {
    return fetchProfile(userId)
  }

  if (error && isMissingUsernameColumnError(error) && updates.username !== undefined) {
    usernameColumnAvailable = false
    const { username: _username, ...updatesWithoutUsername } = updates

    if (Object.keys(updatesWithoutUsername).length === 0) {
      return {
        data: null,
        error: new Error('Usernames are not enabled yet. Run supabase/profile-username.sql.'),
      }
    }

    fields = await profileSelectFields()
    ;({ data, error } = await supabase
      .from('profiles')
      .update(updatesWithoutUsername)
      .eq('id', userId)
      .select(fields)
      .maybeSingle())

    if (!error && !data) {
      return fetchProfile(userId)
    }

    if (error && isNoProfileRowReturnedError(error)) {
      return fetchProfile(userId)
    }
  }

  if (error && isMissingProfileLocationColumnError(error)) {
    profileLocationColumnsAvailable = false
    const {
      city: _city,
      county: _county,
      postcode: _postcode,
      ...updatesWithoutStructuredLocation
    } = updates

    fields = PROFILE_FIELDS_BASE
    if (await supportsUsername()) {
      fields = `${PROFILE_FIELDS_BASE}, username`
    }

    ;({ data, error } = await supabase
      .from('profiles')
      .update(updatesWithoutStructuredLocation)
      .eq('id', userId)
      .select(fields)
      .maybeSingle())

    if (!error && !data) {
      return fetchProfile(userId)
    }

    if (error && isNoProfileRowReturnedError(error)) {
      return fetchProfile(userId)
    }
  }

  if (error) {
    return { data: null, error }
  }

  return {
    data: withProfileLocationFields(
      withUsernameField(data, usernameColumnAvailable),
      await supportsProfileLocationColumns(),
    ),
    error: null,
  }
}

export function getProfileErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  if (error.code === '23505') {
    return 'That username is already taken.'
  }

  if (error.code === '23514') {
    return 'Username must be 3–24 characters and use only letters, numbers, underscores, and hyphens.'
  }

  if (/username is already taken/i.test(error.message ?? '')) {
    return 'That username is already taken.'
  }

  if (/once every 30 days/i.test(error.message ?? '')) {
    return error.message
  }

  return error.message || 'Something went wrong. Please try again.'
}
