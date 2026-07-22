import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_equipd'
const DATABASE = process.env.INVENTORY_TEST_DATABASE || 'equipd_inventory_stage1_test'

async function runSqlFile(path) {
  const sql = await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ],
    {
      input: sql,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    },
  )

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `psql exited ${result.status}`)
  }

  process.stdout.write(result.stdout)
}

const requestedFiles = process.argv.slice(2)
const files = requestedFiles.length
  ? requestedFiles
  : [
      'supabase/migrations/20260721223000_buyer_multi_quantity_transactions.sql',
      'supabase/tests/buyer_multi_quantity_transactions_test.sql',
    ]

for (const file of files) {
  await runSqlFile(file)
}
