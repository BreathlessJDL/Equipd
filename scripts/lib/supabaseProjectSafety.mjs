/**
 * Shared guards so seed / staging CLI work never target production.
 * Known production ref is the public Equipd hosted project (also in README).
 */

export const KNOWN_PRODUCTION_PROJECT_REFS = Object.freeze(['mhwvzovxlqimcuxvyyjf'])

export const BATCH1_PENDING_MIGRATIONS = Object.freeze([
  '20261030120000',
  '20261030130000',
])

const HOSTED_URL_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i
export const PROJECT_REF_PATTERN = /^[a-z0-9]{15,32}$/

export function extraProductionProjectRefs(env = process.env) {
  const extra = String(env.PRODUCTION_SUPABASE_PROJECT_REF ?? '')
    .trim()
    .toLowerCase()
  return extra && PROJECT_REF_PATTERN.test(extra) ? [extra] : []
}

export function allProductionProjectRefs(env = process.env) {
  return [...new Set([...KNOWN_PRODUCTION_PROJECT_REFS, ...extraProductionProjectRefs(env)])]
}

export function parseHostedSupabaseProjectRef(url) {
  const trimmed = String(url ?? '').trim()
  const match = trimmed.match(HOSTED_URL_PATTERN)
  if (!match) return null
  return match[1].toLowerCase()
}

export function canonicalHostedSupabaseUrl(projectRef) {
  return `https://${String(projectRef).toLowerCase()}.supabase.co`
}

export function isProductionProjectRef(projectRef, env = process.env) {
  const ref = String(projectRef ?? '').trim().toLowerCase()
  return allProductionProjectRefs(env).includes(ref)
}

export function assertNotProductionProjectRef(projectRef, env = process.env) {
  const ref = String(projectRef ?? '').trim().toLowerCase()
  if (!ref) {
    throw new Error('Missing Supabase project ref.')
  }
  if (isProductionProjectRef(ref, env)) {
    throw new Error(`Refusing: ${ref} is the Equipd production Supabase project.`)
  }
  return ref
}

export function resolveConfiguredSupabaseUrl(env = process.env) {
  return String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
}

export function isLocalSupabaseUrl(url) {
  try {
    const parsed = new URL(String(url ?? '').trim())
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Hard-block service-role / mutating tests against Equipd production.
 * Local Supabase and a dedicated staging/test project are allowed.
 * There is no override for the known production ref.
 */
export function assertServiceRoleTestNotProduction(env = process.env) {
  const url = resolveConfiguredSupabaseUrl(env)
  if (!url) {
    throw new Error(
      'Refusing test: set SUPABASE_URL or VITE_SUPABASE_URL to a local or staging project, never production.',
    )
  }

  if (isLocalSupabaseUrl(url)) {
    return { projectRef: 'local', url }
  }

  const ref = parseHostedSupabaseProjectRef(url)
  if (!ref) {
    throw new Error(
      `Refusing test: unrecognized Supabase URL (${url}). Use local Supabase or https://<staging-ref>.supabase.co.`,
    )
  }

  assertNotProductionProjectRef(ref, env)
  return { projectRef: ref, url: canonicalHostedSupabaseUrl(ref) }
}

export function assertStagingProjectRefValue(projectRef, env = process.env) {
  const ref = String(projectRef ?? '').trim().toLowerCase()
  if (!PROJECT_REF_PATTERN.test(ref)) {
    throw new Error(
      'Staging project ref must be the dashboard Project ID (15–32 alphanumeric characters).',
    )
  }
  return assertNotProductionProjectRef(ref, env)
}

export function stagingEnvFileContents(projectRef, env = process.env) {
  const ref = assertStagingProjectRefValue(projectRef, env)
  return [
    '# Equipd staging pointer. Gitignored. Do not put production keys or sk_live_ here.',
    `STAGING_SUPABASE_PROJECT_REF=${ref}`,
    `SUPABASE_URL=${canonicalHostedSupabaseUrl(ref)}`,
    '# Optional staging dashboard keys (Step 1 does not need them):',
    '# SUPABASE_ANON_KEY=',
    '# SUPABASE_SERVICE_ROLE_KEY=',
    '',
  ].join('\n')
}

export function assertSafeguardsRejectProductionForStagingRef(stagingRef, env = process.env) {
  const ref = assertStagingProjectRefValue(stagingRef, env)
  const prod = allProductionProjectRefs(env)[0]
  const stagingUrl = canonicalHostedSupabaseUrl(ref)
  const prodUrl = canonicalHostedSupabaseUrl(prod)

  assertStagingWriteTarget({ url: stagingUrl, declaredRef: ref, env })

  try {
    assertStagingWriteTarget({ url: prodUrl, declaredRef: ref, env })
    throw new Error('Expected production URL to be rejected against the staging ref.')
  } catch (error) {
    if (!/does not match|production/i.test(error.message)) throw error
  }

  try {
    assertSeedWriteAllowed({
      ...env,
      SEED_DEV_ALLOW: 'true',
      STAGING_SUPABASE_PROJECT_REF: ref,
      SUPABASE_URL: prodUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-use-production',
    })
    throw new Error('Expected seed against the production URL to be refused.')
  } catch (error) {
    if (!/does not match|production|no longer supported/i.test(error.message)) throw error
  }

  try {
    assertSeedWriteAllowed({
      ...env,
      SEED_DEV_ALLOW: 'true',
      STAGING_SUPABASE_PROJECT_REF: prod,
      SUPABASE_URL: prodUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-use-production',
    })
    throw new Error('Expected seed with the production ref to be refused.')
  } catch (error) {
    if (!/production/i.test(error.message)) throw error
  }

  return { projectRef: ref, url: stagingUrl, productionRef: prod }
}

export function assertStagingWriteTarget({
  url,
  declaredRef = process.env.STAGING_SUPABASE_PROJECT_REF,
  env = process.env,
} = {}) {
  const expected = String(declaredRef ?? '').trim().toLowerCase()
  if (!PROJECT_REF_PATTERN.test(expected)) {
    throw new Error(
      'Set STAGING_SUPABASE_PROJECT_REF to the staging project ref (15–32 alphanumeric characters).',
    )
  }

  assertNotProductionProjectRef(expected, env)

  const parsed = parseHostedSupabaseProjectRef(url)
  if (!parsed) {
    throw new Error(
      `Supabase URL must be exactly https://<project-ref>.supabase.co (got ${String(url ?? '').trim() || 'empty'}).`,
    )
  }

  if (parsed !== expected) {
    throw new Error(
      `Supabase URL project ref (${parsed}) does not match STAGING_SUPABASE_PROJECT_REF (${expected}).`,
    )
  }

  assertNotProductionProjectRef(parsed, env)

  return {
    projectRef: parsed,
    url: canonicalHostedSupabaseUrl(parsed),
  }
}

export function assertSeedWriteAllowed(env = process.env) {
  if (env.SEED_DEV_ALLOW !== 'true') {
    throw new Error(
      'Refusing to seed: set SEED_DEV_ALLOW=true.\n' +
        'Also set STAGING_SUPABASE_PROJECT_REF and a matching SUPABASE_URL.',
    )
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (staging service role only).')
  }

  if (env.SEED_DEV_IGNORE_PROD_URL === 'true') {
    throw new Error('SEED_DEV_IGNORE_PROD_URL is no longer supported.')
  }

  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  return assertStagingWriteTarget({
    url,
    declaredRef: env.STAGING_SUPABASE_PROJECT_REF,
    env,
  })
}

export function assertStagingCliTarget(projectRef, env = process.env) {
  const declared = String(env.STAGING_SUPABASE_PROJECT_REF ?? '').trim().toLowerCase()
  const ref = String(projectRef ?? '').trim().toLowerCase()

  if (!PROJECT_REF_PATTERN.test(declared)) {
    throw new Error('Set STAGING_SUPABASE_PROJECT_REF before running staging CLI commands.')
  }
  if (!ref) {
    throw new Error('Missing CLI project ref.')
  }
  if (ref !== declared) {
    throw new Error(`CLI project ref (${ref}) does not match STAGING_SUPABASE_PROJECT_REF (${declared}).`)
  }
  return assertNotProductionProjectRef(ref, env)
}

export function assertReadOnlyProductionDumpAllowed(linkedRef, env = process.env) {
  if (env.STAGING_READ_PROD_DUMP !== 'true') {
    throw new Error(
      'Refusing production dump: set STAGING_READ_PROD_DUMP=true only after approval for a read-only schema dump.',
    )
  }

  const expectedProd = String(env.PRODUCTION_SUPABASE_PROJECT_REF ?? '').trim().toLowerCase()
  if (!PROJECT_REF_PATTERN.test(expectedProd)) {
    throw new Error('Set PRODUCTION_SUPABASE_PROJECT_REF to the production project ref for the dump.')
  }
  if (!isProductionProjectRef(expectedProd, env)) {
    throw new Error(
      'PRODUCTION_SUPABASE_PROJECT_REF must match a known production ref (or be added to that allow-list).',
    )
  }

  const linked = String(linkedRef ?? '').trim().toLowerCase()
  if (linked !== expectedProd) {
    throw new Error(
      `Linked project (${linked || 'none'}) is not PRODUCTION_SUPABASE_PROJECT_REF (${expectedProd}).`,
    )
  }

  return linked
}

export function isUnsafeDumpContents(text) {
  const source = String(text ?? '')
  const forbidden = [
    /COPY\s+(public|auth)\./i,
    /INSERT\s+INTO\s+(public\.)?profiles\b/i,
    /INSERT\s+INTO\s+auth\.users\b/i,
    /INSERT\s+INTO\s+(public\.)?payments\b/i,
    /INSERT\s+INTO\s+(public\.)?messages\b/i,
    /INSERT\s+INTO\s+(public\.)?app_config\b/i,
    /sk_live_/,
    /SENDGRID_API_KEY/i,
    /INDEXNOW_KEY/i,
  ]
  return forbidden.some((pattern) => pattern.test(source))
}

export function isUnsafeMigrationHistoryDump(text) {
  const source = String(text ?? '')
  if (!/schema_migrations/i.test(source) && !/supabase_migrations/i.test(source)) {
    return true
  }
  return /profiles|auth\.users|messages|payments|identities|sk_live_|app_config/i.test(source)
}

export function classifySupabaseCliArgs(argv) {
  const args = argv.map(String)
  const joined = args.join(' ')
  if (/\bdb\s+dump\b/.test(joined) || args.includes('dump')) return 'dump'
  if (/\bfunctions\s+deploy\b/.test(joined) || (args.includes('functions') && args.includes('deploy'))) {
    return 'functions-deploy'
  }
  if (/\bsecrets\s+set\b/.test(joined) || (args.includes('secrets') && args.includes('set'))) {
    return 'secrets'
  }
  if (/\blink\b/.test(joined) && args.includes('link')) return 'link'
  if (
    /\bdb\s+push\b/.test(joined) ||
    args.includes('push') ||
    args.includes('migration') ||
    (args.includes('db') && args.includes('query'))
  ) {
    return 'db-write'
  }
  return 'other'
}

export function assertDumpFlagsAreSchemaOnly(argv) {
  const args = argv.map(String)
  const dataOnly = args.includes('--data-only')
  const schemaIdx = args.indexOf('--schema')
  const schemaName = schemaIdx >= 0 ? String(args[schemaIdx + 1] ?? '') : ''
  if (dataOnly && schemaName !== 'supabase_migrations') {
    throw new Error(
      'Refusing dump: --data-only is only allowed with --schema supabase_migrations (migration history).',
    )
  }
  if (args.includes('--include-seed')) {
    throw new Error('Refusing: never pass --include-seed.')
  }
}

export function assertWriteCliNotProduction(linkedRef, env = process.env) {
  return assertStagingCliTarget(linkedRef, env)
}
