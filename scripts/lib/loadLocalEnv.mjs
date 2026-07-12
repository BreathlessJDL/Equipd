/**
 * Load .env.local into process.env without overwriting existing values.
 * Safe for local scripts and Vercel builds (where env is already set).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadLocalEnv({ cwd = process.cwd(), filename = '.env.local' } = {}) {
  const path = join(cwd, filename)
  if (!existsSync(path)) return { loaded: false, path }

  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    if (!key || process.env[key] != null) continue
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }

  return { loaded: true, path }
}

export function getSupabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || ''
  return { url, key }
}
