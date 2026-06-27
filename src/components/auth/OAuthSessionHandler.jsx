import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OAUTH_PENDING_KEY, OAUTH_REDIRECT_KEY } from '../../lib/auth'
import { OAUTH_CALLBACK_PATH } from '../../lib/siteUrl'
import { fetchProfile, supportsUsername } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { useAuthModal } from '../../hooks/useAuthModal'

async function completeOAuthReturn(session, navigate, closeAuthModal) {
  if (!sessionStorage.getItem(OAUTH_PENDING_KEY)) return

  const postAuthRedirect = sessionStorage.getItem(OAUTH_REDIRECT_KEY) ?? '/'
  sessionStorage.removeItem(OAUTH_PENDING_KEY)
  sessionStorage.removeItem(OAUTH_REDIRECT_KEY)

  const user = session?.user
  if (!user?.id) return

  const { data: profile, error } = await fetchProfile(user.id, { email: user.email })

  if (error) {
    console.error('[oauth] Failed to ensure profile:', error.message)
  }

  closeAuthModal?.()

  const usernameSupported = await supportsUsername()
  const needsUsername = usernameSupported && !profile?.username?.trim()

  if (needsUsername) {
    navigate('/settings?username=required', {
      replace: true,
      state: { postAuthRedirect },
    })
    return
  }

  const currentPath = `${window.location.pathname}${window.location.search}`
  const onCallbackPage = window.location.pathname === OAUTH_CALLBACK_PATH

  if (postAuthRedirect && (onCallbackPage || postAuthRedirect !== currentPath)) {
    navigate(postAuthRedirect, { replace: true })
  }
}

function OAuthSessionHandler() {
  const navigate = useNavigate()
  const { closeAuthModal } = useAuthModal()

  useEffect(() => {
    if (!supabase) return undefined

    let processing = false

    async function handleSession(session) {
      if (!sessionStorage.getItem(OAUTH_PENDING_KEY)) return
      if (processing) return

      processing = true
      try {
        await completeOAuthReturn(session, navigate, closeAuthModal)
      } finally {
        processing = false
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate, closeAuthModal])

  return null
}

export default OAuthSessionHandler
