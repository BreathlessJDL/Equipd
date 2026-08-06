import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const CHUNK_RELOAD_KEY = 'equipd-chunk-reload'

function installChunkLoadRecovery() {
  if (typeof window === 'undefined') return

  const reloadOnce = () => {
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
    } catch {
      // sessionStorage unavailable — skip controlled reload
    }
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnce()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event?.reason?.message || event?.reason || '')
    if (/Failed to fetch dynamically imported module|Loading chunk [\d]+ failed|Importing a module script failed/i.test(message)) {
      reloadOnce()
    }
  })
}

installChunkLoadRecovery()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
