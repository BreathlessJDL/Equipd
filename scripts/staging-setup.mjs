#!/usr/bin/env node
/**
 * Staging CLI helper for Equipd Batch 1.
 *
 * Default: verify the installed CLI and print the plan. Database dump, push,
 * seed and function deploy are refused unless STAGING_EXECUTE=true after approval.
 *
 * Usage:
 *   node scripts/staging-setup.mjs verify-cli
 *   node scripts/staging-setup.mjs print-plan
 *   node scripts/staging-setup.mjs configure-staging-ref <ref>
 *   node scripts/staging-setup.mjs verify-staging-project <ref>
 *   node scripts/staging-setup.mjs print-step2
 *   node scripts/staging-setup.mjs assert-linked-staging
 *
 * CLI 2.105 notes:
 *   db dump / db push / migration list / db query use --linked (not --project-ref).
 *   functions deploy / secrets set / link use --project-ref.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BATCH1_PENDING_MIGRATIONS,
  KNOWN_PRODUCTION_PROJECT_REFS,
  allProductionProjectRefs,
  assertDumpFlagsAreSchemaOnly,
  assertNotProductionProjectRef,
  assertReadOnlyProductionDumpAllowed,
  assertSafeguardsRejectProductionForStagingRef,
  assertStagingCliTarget,
  assertStagingProjectRefValue,
  canonicalHostedSupabaseUrl,
  classifySupabaseCliArgs,
  stagingEnvFileContents,
} from './lib/supabaseProjectSafety.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LINKED_PROJECT_PATH = join(ROOT, 'supabase', '.temp', 'linked-project.json')
const STAGING_ENV_PATH = join(ROOT, '.env.staging')
const MIN_CLI = '2.105.0'

function readLinkedProjectRef() {
  if (!existsSync(LINKED_PROJECT_PATH)) return null
  const raw = JSON.parse(readFileSync(LINKED_PROJECT_PATH, 'utf8'))
  return String(raw.ref ?? '').trim().toLowerCase() || null
}

function requireExecute(action) {
  if (process.env.STAGING_EXECUTE !== 'true') {
    throw new Error(
      `Refusing ${action}: this helper does not run database or deploy commands unless STAGING_EXECUTE=true after explicit approval.`,
    )
  }
}

function printPlan() {
  const stagingRef = process.env.STAGING_SUPABASE_PROJECT_REF || '<STAGING_REF>'
  const prodRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REFS[0]

  console.log(`Installed CLI must be 2.105.x (checked via verify-cli).
Known production ref: ${KNOWN_PRODUCTION_PROJECT_REFS.join(', ')}
Pending Batch 1 versions: ${BATCH1_PENDING_MIGRATIONS.join(', ')}

# 1) Read-only production dumps (approval + STAGING_READ_PROD_DUMP=true + STAGING_EXECUTE=true)
npx supabase link --project-ref ${prodRef}
# Confirm supabase/.temp/linked-project.json "ref" equals ${prodRef}
npx supabase db dump --linked --dry-run
npx supabase db dump --linked -f .tmp-staging/prod-schema.sql
npx supabase db dump --linked --data-only --schema supabase_migrations -f .tmp-staging/prod-migration-history.sql
# Grep dumps with scripts/lib/supabaseProjectSafety.mjs isUnsafeDumpContents / isUnsafeMigrationHistoryDump
# Do not pass --data-only on the schema dump. Do not dump public, auth, or storage data.

# 2) Link staging before any write (CLI db/migration commands use --linked, not --project-ref)
npx supabase link --project-ref ${stagingRef}
# Confirm linked-project.json ref equals STAGING_SUPABASE_PROJECT_REF and is not production

# 3) Restore schema + history onto empty staging (staging DB URL only)
# psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f .tmp-staging/prod-schema.sql
# psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f .tmp-staging/prod-migration-history.sql
# Then on staging: DELETE FROM public.app_config;
# Unschedule cron.job if any. Confirm auth.users and public.profiles counts are 0.

# 4) Apply Batch 1 only
npx supabase migration list --linked
# STOP unless only ${BATCH1_PENDING_MIGRATIONS.join(' and ')} are pending locally
npx supabase db push --linked --dry-run
npx supabase db push --linked
# Never pass --include-seed

# 5) Seed
# $env:SEED_DEV_ALLOW="true"
# $env:STAGING_SUPABASE_PROJECT_REF="${stagingRef}"
# $env:SUPABASE_URL="https://${stagingRef}.supabase.co"
# $env:VITE_SUPABASE_URL="https://${stagingRef}.supabase.co"
# $env:SUPABASE_SERVICE_ROLE_KEY="<staging service role>"
npm run seed:dev

# 6) Functions (these flags take --project-ref)
npx supabase secrets set --project-ref ${stagingRef} STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... APP_BASE_URL=http://localhost:5174
npx supabase functions deploy request-account-deletion --project-ref ${stagingRef}
npx supabase functions deploy stripe-webhook --project-ref ${stagingRef}
npx supabase functions deploy stripe-create-checkout --project-ref ${stagingRef}
npx supabase functions deploy stripe-connect-onboard --project-ref ${stagingRef}
npx supabase functions deploy stripe-connect-sync --project-ref ${stagingRef}
npx supabase functions deploy validate-password --project-ref ${stagingRef}
# Do not deploy indexnow-submit. Do not schedule stripe-release-due-payouts.
# Do not set SENDGRID_API_KEY, INDEXNOW_KEY, or sk_live_.
`)
}

function verifyCli() {
  const result = spawnSync('npx', ['supabase', '--version'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  const version = String(result.stdout || result.stderr || '').trim()
  console.log(`Supabase CLI version: ${version}`)
  if (!version.includes('2.105')) {
    console.warn(`Expected CLI 2.105.x (plan verified against ${MIN_CLI}). Got: ${version}`)
  }

  const dumpHelp = spawnSync('npx', ['supabase', 'db', 'dump', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  const help = dumpHelp.stdout || ''
  for (const flag of ['--linked', '--data-only', '--dry-run', '--schema']) {
    if (!help.includes(flag)) {
      throw new Error(`CLI db dump is missing ${flag}`)
    }
  }
  if (help.includes('--project-ref')) {
    throw new Error('Unexpected: db dump now has --project-ref; update staging-setup.mjs')
  }

  const pushHelp = spawnSync('npx', ['supabase', 'db', 'push', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  if (!(pushHelp.stdout || '').includes('--dry-run') || !(pushHelp.stdout || '').includes('--linked')) {
    throw new Error('CLI db push missing --dry-run or --linked')
  }
  if ((pushHelp.stdout || '').includes('--include-seed')) {
    console.log('Note: db push supports --include-seed; never pass it.')
  }

  const deployHelp = spawnSync('npx', ['supabase', 'functions', 'deploy', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  if (!(deployHelp.stdout || '').includes('--project-ref')) {
    throw new Error('CLI functions deploy missing --project-ref')
  }

  const listHelp = spawnSync('npx', ['supabase', 'migration', 'list', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  if (!(listHelp.stdout || '').includes('--linked')) {
    throw new Error('CLI migration list missing --linked')
  }

  const repairHelp = spawnSync('npx', ['supabase', 'migration', 'repair', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  const repairOut = repairHelp.stdout || ''
  if (!repairOut.includes('--status') || !repairOut.includes('applied')) {
    throw new Error('CLI migration repair missing --status applied')
  }
  console.log(
    'Note: prefer restoring a supabase_migrations data dump over bulk `migration repair --status applied`.',
  )

  const queryHelp = spawnSync('npx', ['supabase', 'db', 'query', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  if (!(queryHelp.stdout || '').includes('--linked')) {
    throw new Error('CLI db query missing --linked')
  }

  console.log('PASS: CLI 2.105 dump/push/deploy/list/repair/query flags match the staging plan')
}

function verifyHistoryRestore() {
  const dir = join(ROOT, 'supabase', 'migrations')
  const files = readdirSync(dir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
  const versions = files.map((name) => name.slice(0, 14))
  const pending = new Set(BATCH1_PENDING_MIGRATIONS)
  const mustMarkApplied = versions.filter((version) => !pending.has(version))

  console.log(`Local migration files: ${files.length}`)
  console.log(`Must already be applied on staging after history restore: ${mustMarkApplied.length}`)
  console.log(`Must remain pending (Batch 1): ${BATCH1_PENDING_MIGRATIONS.join(', ')}`)
  console.log(`
Safe restore on a NEW empty project (after approval):
  1. Schema-only dump does NOT copy schema_migrations rows. Restoring it alone
     leaves an empty history, so \`db push --linked\` would try every local file
     and fail on existing objects.
  2. Dump history separately:
       npx supabase db dump --linked --data-only --schema supabase_migrations -f .tmp-staging/prod-migration-history.sql
  3. Inspect the file with isUnsafeMigrationHistoryDump (must mention schema_migrations,
     must not mention profiles/auth.users/payments/messages/app_config).
  4. Restore schema, then history, against the staging DB URL only.
  5. \`npx supabase migration list --linked\` must show only Batch 1 as Local/pending.
  6. Fallback if history dump is empty: \`npx supabase migration repair --status applied --linked <version>\`
     for each of the ${mustMarkApplied.length} already-applied versions — never for Batch 1.
  7. Then \`npx supabase db push --linked --dry-run\` (never --include-seed).
`)
}

function assertLinkedStaging() {
  const linked = readLinkedProjectRef()
  if (!linked) {
    throw new Error('No supabase/.temp/linked-project.json. Link staging first (after approval).')
  }
  if (allProductionProjectRefs().includes(linked)) {
    throw new Error(`Linked project ${linked} is production. Relink to staging before writes.`)
  }
  assertStagingCliTarget(linked)
  console.log(`PASS: linked project ${linked} is staging`)
  return linked
}

function blockedDumpSchema() {
  requireExecute('production schema dump')
  const linked = readLinkedProjectRef()
  assertReadOnlyProductionDumpAllowed(linked)
  assertDumpFlagsAreSchemaOnly(['db', 'dump', '--linked'])
  throw new Error(
    'Dump command is assembled but not auto-run from this helper. Run the printed `db dump --linked` commands manually after the file checks.',
  )
}

function blockedPush() {
  requireExecute('db push')
  const linked = assertLinkedStaging()
  if (classifySupabaseCliArgs(['db', 'push', '--linked']) !== 'db-write') {
    throw new Error('Internal: db push must classify as db-write')
  }
  assertNotProductionProjectRef(linked)
  throw new Error('db push is not auto-run. Use `npx supabase db push --linked --dry-run` then `--linked` after approval.')
}

function blockedDeploy() {
  requireExecute('functions deploy')
  const ref = assertStagingCliTarget(process.env.STAGING_SUPABASE_PROJECT_REF)
  assertNotProductionProjectRef(ref)
  throw new Error('Function deploy is not auto-run. Use functions deploy --project-ref <staging> after approval.')
}

function printWaitingForStagingRef() {
  const prod = KNOWN_PRODUCTION_PROJECT_REFS[0]
  console.log(`Waiting for the new staging Project ID from the Supabase Dashboard.

Create a NEW empty project (not ${prod}).
Copy Settings → General → Reference ID and send it here, or run:
  node scripts/staging-setup.mjs configure-staging-ref <staging-ref>

Do not send the database password, service role key, or production credentials.
Step 2 (read-only production dump) is blocked until you approve it separately.`)
}

function printStep2() {
  const stagingRef = process.env.STAGING_SUPABASE_PROJECT_REF || '<STAGING_REF>'
  const prodRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REFS[0]
  console.log(`Step 2 is NOT approved yet. After you approve it, the read-only dump is:

# A) Point the CLI at production for READ-ONLY dumps only (requires STAGING_READ_PROD_DUMP=true)
#    Confirm supabase/.temp/linked-project.json ref equals ${prodRef}
npx supabase link --project-ref ${prodRef}

# B) Schema-only (default). Do not pass --data-only here. Do not dump public/auth/storage data.
npx supabase db dump --linked --dry-run
npx supabase db dump --linked -f .tmp-staging/prod-schema.sql

# C) Migration history rows only (not customer data)
npx supabase db dump --linked --data-only --schema supabase_migrations -f .tmp-staging/prod-migration-history.sql

# D) Inspect files BEFORE any restore (restore is a later step, not Step 2)
node -e "import('./scripts/lib/supabaseProjectSafety.mjs').then((m) => { const fs = await import('node:fs'); const schema = fs.readFileSync('.tmp-staging/prod-schema.sql','utf8'); const history = fs.readFileSync('.tmp-staging/prod-migration-history.sql','utf8'); if (m.isUnsafeDumpContents(schema)) throw new Error('schema dump looks like data'); if (m.isUnsafeMigrationHistoryDump(history)) throw new Error('history dump is unsafe'); console.log('PASS: dump files look schema/history-only') })"

# E) Relink away from production before any write
npx supabase link --project-ref ${stagingRef}

Never copy Auth users, payments, messages, app_config values, sk_live_, SendGrid, or IndexNow.
Do not restore, db push, seed, or deploy until a later approved step.`)
}

function resolveIncomingStagingRef() {
  return String(process.argv[3] || process.env.STAGING_SUPABASE_PROJECT_REF || '').trim()
}

function warnIfCliLinkedToProduction() {
  const linked = readLinkedProjectRef()
  if (!linked) {
    console.log('CLI is not linked. Good for Step 1 (no production link).')
    return
  }
  if (allProductionProjectRefs().includes(linked)) {
    console.log(
      `WARNING: CLI linked-project.json is production (${linked}). Do not dump, push, or query. Relink only after Step 2 approval.`,
    )
    return
  }
  console.log(`CLI currently linked to non-production ref ${linked}.`)
}

async function probeStagingHost(projectRef) {
  const url = `${canonicalHostedSupabaseUrl(projectRef)}/auth/v1/health`
  const response = await fetch(url, { method: 'GET' })
  const body = await response.text()
  return { url, status: response.status, body: body.slice(0, 200) }
}

function runSafeguardChecks(projectRef) {
  const result = assertSafeguardsRejectProductionForStagingRef(projectRef)
  console.log(`PASS: ${result.projectRef} is not production (${result.productionRef})`)
  console.log(`PASS: seed/write guards reject ${result.productionRef} and a mismatched production URL`)
  return result
}

async function configureOrVerifyStaging({ writeEnv }) {
  const incoming = resolveIncomingStagingRef()
  if (!incoming) {
    printWaitingForStagingRef()
    process.exitCode = 2
    return
  }

  const projectRef = assertStagingProjectRefValue(incoming)
  const contents = stagingEnvFileContents(projectRef)

  if (writeEnv) {
    writeFileSync(STAGING_ENV_PATH, contents, 'utf8')
    console.log(`Wrote ${STAGING_ENV_PATH} (gitignored) with STAGING_SUPABASE_PROJECT_REF=${projectRef}`)
  } else {
    console.log(`Would configure STAGING_SUPABASE_PROJECT_REF=${projectRef} (not writing unless configure-staging-ref)`)
  }

  runSafeguardChecks(projectRef)
  warnIfCliLinkedToProduction()

  try {
    const health = await probeStagingHost(projectRef)
    console.log(`Staging host probe (no credentials): ${health.status} ${health.url}`)
    if (health.status >= 200 && health.status < 500) {
      console.log('PASS: staging hostname responds. This is not a row-count emptiness proof.')
    } else {
      console.log('Staging host did not return a normal HTTP status yet (project may still be provisioning).')
    }
  } catch (error) {
    console.log(`Staging host probe skipped/failed without credentials: ${error.message}`)
  }

  console.log(`Emptiness: a brand-new Dashboard project has no Equipd schema or customer data.
Prove it in Dashboard → Authentication → Users (0) and Table Editor (default Supabase tables only).
A SQL count needs a staging DB password or service role; do not send those in chat, and do not use production keys.`)
}

async function main() {
  const command = process.argv[2] || 'print-plan'

  switch (command) {
    case 'verify-cli':
      verifyCli()
      break
    case 'print-plan':
      printPlan()
      break
    case 'print-step2':
      printStep2()
      break
    case 'configure-staging-ref':
      await configureOrVerifyStaging({ writeEnv: true })
      break
    case 'verify-staging-project':
      await configureOrVerifyStaging({ writeEnv: false })
      break
    case 'verify-history-restore':
      verifyHistoryRestore()
      break
    case 'assert-linked-staging':
      assertLinkedStaging()
      break
    case 'dump-schema':
      blockedDumpSchema()
      break
    case 'db-push':
      blockedPush()
      break
    case 'functions-deploy':
      blockedDeploy()
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

await main()
