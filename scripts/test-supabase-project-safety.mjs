#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  assertDumpFlagsAreSchemaOnly,
  assertNotProductionProjectRef,
  assertReadOnlyProductionDumpAllowed,
  assertServiceRoleTestNotProduction,
  assertSafeguardsRejectProductionForStagingRef,
  assertSeedWriteAllowed,
  assertStagingProjectRefValue,
  assertStagingWriteTarget,
  classifySupabaseCliArgs,
  isUnsafeDumpContents,
  isUnsafeMigrationHistoryDump,
  parseHostedSupabaseProjectRef,
  stagingEnvFileContents,
} from './lib/supabaseProjectSafety.mjs'

const PROD = 'mhwvzovxlqimcuxvyyjf'
const STAGING = 'abcdefghijklmnopqrst'

assert.equal(parseHostedSupabaseProjectRef(`https://${PROD}.supabase.co`), PROD)
assert.equal(parseHostedSupabaseProjectRef(`https://${STAGING}.supabase.co/`), STAGING)
assert.equal(parseHostedSupabaseProjectRef('http://127.0.0.1:54321'), null)

assert.throws(() => assertNotProductionProjectRef(PROD), /production/)
assert.equal(assertNotProductionProjectRef(STAGING), STAGING)

assert.equal(
  assertServiceRoleTestNotProduction({
    SUPABASE_URL: `https://${STAGING}.supabase.co`,
  }).projectRef,
  STAGING,
)
assert.equal(
  assertServiceRoleTestNotProduction({
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  }).projectRef,
  'local',
)
assert.throws(
  () =>
    assertServiceRoleTestNotProduction({
      VITE_SUPABASE_URL: `https://${PROD}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-matter',
    }),
  /production/,
)
assert.throws(
  () => assertServiceRoleTestNotProduction({}),
  /SUPABASE_URL or VITE_SUPABASE_URL/,
)

const target = assertStagingWriteTarget({
  url: `https://${STAGING}.supabase.co`,
  declaredRef: STAGING,
})
assert.equal(target.projectRef, STAGING)

assert.throws(
  () =>
    assertStagingWriteTarget({
      url: `https://${PROD}.supabase.co`,
      declaredRef: STAGING,
    }),
  /does not match/,
)

assert.throws(
  () =>
    assertStagingWriteTarget({
      url: `https://${PROD}.supabase.co`,
      declaredRef: PROD,
    }),
  /production/,
)

assert.throws(
  () =>
    assertSeedWriteAllowed({
      SEED_DEV_ALLOW: 'true',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      SUPABASE_URL: `https://${STAGING}.supabase.co`,
    }),
  /STAGING_SUPABASE_PROJECT_REF/,
)

const seeded = assertSeedWriteAllowed({
  SEED_DEV_ALLOW: 'true',
  STAGING_SUPABASE_PROJECT_REF: STAGING,
  SUPABASE_URL: `https://${STAGING}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: 'staging-service-role',
})
assert.equal(seeded.projectRef, STAGING)

assert.throws(
  () =>
    assertSeedWriteAllowed({
      SEED_DEV_ALLOW: 'true',
      STAGING_SUPABASE_PROJECT_REF: STAGING,
      SUPABASE_URL: `https://${PROD}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: 'x',
      SEED_DEV_IGNORE_PROD_URL: 'true',
    }),
  /no longer supported/,
)

assert.equal(isUnsafeDumpContents('CREATE TABLE public.profiles ();'), false)
assert.equal(isUnsafeDumpContents('COPY public.profiles (id) FROM stdin;'), true)
assert.equal(isUnsafeDumpContents('INSERT INTO auth.users VALUES'), true)
assert.equal(isUnsafeDumpContents("sk_live_abc"), true)
assert.equal(
  isUnsafeMigrationHistoryDump("INSERT INTO supabase_migrations.schema_migrations VALUES ('20260625120000');"),
  false,
)
assert.equal(isUnsafeMigrationHistoryDump('COPY public.profiles FROM stdin;'), true)

assert.throws(
  () => assertReadOnlyProductionDumpAllowed(STAGING, { STAGING_READ_PROD_DUMP: 'true' }),
  /PRODUCTION_SUPABASE_PROJECT_REF/,
)

assert.equal(
  assertReadOnlyProductionDumpAllowed(PROD, {
    STAGING_READ_PROD_DUMP: 'true',
    PRODUCTION_SUPABASE_PROJECT_REF: PROD,
  }),
  PROD,
)

assert.equal(classifySupabaseCliArgs(['db', 'dump', '--linked']), 'dump')
assert.equal(classifySupabaseCliArgs(['db', 'push', '--linked']), 'db-write')
assert.equal(classifySupabaseCliArgs(['functions', 'deploy', '--project-ref', STAGING]), 'functions-deploy')
assert.doesNotThrow(() => assertDumpFlagsAreSchemaOnly(['db', 'dump', '--linked']))
assert.doesNotThrow(() =>
  assertDumpFlagsAreSchemaOnly(['db', 'dump', '--linked', '--data-only', '--schema', 'supabase_migrations']),
)
assert.throws(
  () => assertDumpFlagsAreSchemaOnly(['db', 'dump', '--data-only']),
  /supabase_migrations/,
)

assert.equal(assertStagingProjectRefValue(STAGING), STAGING)
assert.throws(() => assertStagingProjectRefValue(PROD), /production/)
assert.throws(() => assertStagingProjectRefValue('not-a-ref'), /15–32/)
assert.match(stagingEnvFileContents(STAGING), new RegExp(`STAGING_SUPABASE_PROJECT_REF=${STAGING}`))
assert.throws(() => stagingEnvFileContents(PROD), /production/)
assert.equal(assertSafeguardsRejectProductionForStagingRef(STAGING).projectRef, STAGING)

console.log('PASS: staging/production project safety guards')
