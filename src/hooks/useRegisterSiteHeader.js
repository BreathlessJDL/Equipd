import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

export function useRegisterSiteHeader(config) {
  const { registerSiteHeader } = useOutletContext()

  useEffect(() => {
    registerSiteHeader(config)
    return () => registerSiteHeader(null)
  }, [registerSiteHeader, config])
}
