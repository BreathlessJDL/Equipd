import { useContext } from 'react'
import { WantedRequestContext } from './wantedRequestContextValue'

export function useWantedRequest() {
  const ctx = useContext(WantedRequestContext)
  if (!ctx) {
    throw new Error('useWantedRequest must be used within WantedRequestProvider')
  }
  return ctx
}

/** Safe hook for optional usage outside provider. */
export function useWantedRequestOptional() {
  return useContext(WantedRequestContext)
}
