import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import { fetchEquipmentIntelligenceFilterOptions } from '../lib/equipmentIntelligence'
import {
  fetchPrioritySyncRanking,
  fetchSearchGroupAnalysis,
  runIntelligenceEbaySoldBatchStep,
} from '../lib/intelligenceMarketSearch'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceBatchSyncPage.css'

const MAX_ROW_OPTIONS = [25, 50, 100, 256]

function formatStatusLabel(status) {
  if (!status) return '—'
  return String(status)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function AdminIntelligenceBatchSyncPage() {
  usePageTitle('Batch Market Sync')

  const [brands, setBrands] = useState(['Life Fitness'])
  const [brand, setBrand] = useState('Life Fitness')
  const [maxRows, setMaxRows] = useState(25)
  const [dryRun, setDryRun] = useState(true)
  const [dedupeSearchGroups, setDedupeSearchGroups] = useState(true)
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [searchGroupLoading, setSearchGroupLoading] = useState(true)
  const [searchGroupError, setSearchGroupError] = useState('')
  const [searchGroupReport, setSearchGroupReport] = useState(null)

  const [priorityLoading, setPriorityLoading] = useState(true)
  const [priorityError, setPriorityError] = useState('')
  const [priorityTop, setPriorityTop] = useState([])
  const [priorityEquipmentIds, setPriorityEquipmentIds] = useState([])
  const [prioritySearchGroupKeys, setPrioritySearchGroupKeys] = useState([])
  const [priorityGroupCount, setPriorityGroupCount] = useState(0)
  const [priorityRowCount, setPriorityRowCount] = useState(0)
  const [totalScored, setTotalScored] = useState(0)

  const [running, setRunning] = useState(false)
  const [batchMode, setBatchMode] = useState('brand')
  const [error, setError] = useState('')
  const [processedCount, setProcessedCount] = useState(0)
  const [cursorId, setCursorId] = useState(null)
  const [totalEligible, setTotalEligible] = useState(0)
  const [complete, setComplete] = useState(false)
  const [rowResults, setRowResults] = useState([])
  const [summary, setSummary] = useState(null)

  const cancelRef = useRef(false)

  const loadPriorityRanking = useCallback(async () => {
    setPriorityLoading(true)
    setPriorityError('')

    const result = await fetchPrioritySyncRanking(50)
    if (result.error) {
      setPriorityTop([])
      setPriorityEquipmentIds([])
      setPrioritySearchGroupKeys([])
      setPriorityGroupCount(0)
      setPriorityRowCount(0)
      setTotalScored(0)
      setPriorityError(getAdminErrorMessage(result.error))
      setPriorityLoading(false)
      return
    }

    setPriorityTop(result.data?.top ?? [])
    setPriorityEquipmentIds(result.data?.equipment_ids ?? [])
    setPrioritySearchGroupKeys(result.data?.search_group_keys ?? [])
    setPriorityGroupCount(result.data?.total_unique_search_groups ?? 0)
    setPriorityRowCount(result.data?.total_equipment_rows_selected ?? 0)
    setTotalScored(result.data?.total_scored ?? 0)
    setPriorityLoading(false)
  }, [])

  const loadSearchGroupReport = useCallback(async () => {
    setSearchGroupLoading(true)
    setSearchGroupError('')

    const result = await fetchSearchGroupAnalysis()
    if (result.error) {
      setSearchGroupReport(null)
      setSearchGroupError(getAdminErrorMessage(result.error))
      setSearchGroupLoading(false)
      return
    }

    setSearchGroupReport(result.data?.report ?? null)
    setSearchGroupLoading(false)
  }, [])

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true)
    const result = await fetchEquipmentIntelligenceFilterOptions()
    if (!result.error && result.brands?.length) {
      setBrands(result.brands)
      if (!result.brands.includes(brand)) {
        setBrand(result.brands.includes('Life Fitness') ? 'Life Fitness' : result.brands[0])
      }
    }
    setLoadingOptions(false)
  }, [brand])

  useEffect(() => {
    loadOptions()
    loadPriorityRanking()
    loadSearchGroupReport()
  }, [loadOptions, loadPriorityRanking, loadSearchGroupReport])

  const progressLabel = useMemo(() => {
    const unit = dedupeSearchGroups ? 'search groups' : 'models'

    if (batchMode === 'priority') {
      const total = totalEligible || priorityGroupCount || prioritySearchGroupKeys.length
      return `Processed ${processedCount} of ${total} priority search groups`
    }

    if (totalEligible > 0) {
      return `Processed ${processedCount} of ${Math.min(maxRows, totalEligible)} (batch limit ${maxRows}, ${totalEligible} ${brand} ${unit} total)`
    }

    return `Processed ${processedCount} of ${maxRows}`
  }, [processedCount, maxRows, totalEligible, brand, batchMode, priorityGroupCount, prioritySearchGroupKeys.length, dedupeSearchGroups])

  async function runBatch({
    mode = 'brand',
    equipmentIds = null,
    searchGroupKeys = null,
    rowLimit = maxRows,
    forceDedupeSearchGroups = false,
  } = {}) {
    setError('')
    setRunning(true)
    setBatchMode(mode)
    setComplete(false)
    setProcessedCount(0)
    setCursorId(null)
    setRowResults([])
    setSummary(null)
    cancelRef.current = false

    let nextProcessed = 0
    let nextCursor = null
    let priorRows = []
    let latestSummary = null
    const limit = searchGroupKeys?.length
      ? searchGroupKeys.length
      : equipmentIds?.length
        ? equipmentIds.length
        : rowLimit
    const useDedupeSearchGroups = forceDedupeSearchGroups || dedupeSearchGroups

    try {
      while (nextProcessed < limit) {
        if (cancelRef.current) break

        const result = await runIntelligenceEbaySoldBatchStep({
          brand,
          maxRows: limit,
          processedCount: nextProcessed,
          cursorId: nextCursor,
          equipmentIds,
          searchGroupKeys,
          dedupeSearchGroups: useDedupeSearchGroups,
          dryRun,
          priorRows,
        })

        if (result.error) {
          throw result.error
        }

        const data = result.data
        if (!data) {
          throw new Error('Batch sync returned no data')
        }

        setTotalEligible(data.total_eligible ?? limit)
        nextProcessed = data.processed_count ?? nextProcessed
        nextCursor = data.next_cursor_id ?? null
        latestSummary = data.summary ?? null

        if (data.rows?.length) {
          priorRows = [...priorRows, ...data.rows]
          setRowResults(priorRows)
        } else if (data.row) {
          priorRows = [...priorRows, data.row]
          setRowResults(priorRows)
        }

        setProcessedCount(nextProcessed)
        setCursorId(nextCursor)
        setSummary(latestSummary)

        if (data.complete) {
          setComplete(true)
          break
        }
      }
    } catch (err) {
      setError(getAdminErrorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  function handleCancel() {
    cancelRef.current = true
  }

  return (
    <section className="admin-intelligence admin-intelligence-batch-sync">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence/market-sync">← Back to Market Sync</Link>
        </p>
        <h1 className="admin-intelligence__title">Batch eBay Market Sync</h1>
        <p className="admin-intelligence__lead">
          Controlled admin batch process. Priority Sync ranks all equipment rows by eBay sold
          likelihood (no Apify calls). Batch sync processes one Apify search per step — either per
          equipment row, or per deduplicated search group when enabled.
        </p>
      </header>

      <section className="admin-intelligence__panel admin-intelligence-batch-sync__report-panel">
        <div className="admin-intelligence-batch-sync__priority-header">
          <div>
            <h2 className="admin-intelligence__panel-title">Duplicate search groups</h2>
            <p className="admin-intelligence-batch-sync__defaults">
              Rows sharing the same primary eBay keyword can reuse one Apify search, then classify
              results per equipment row.
            </p>
          </div>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={loadSearchGroupReport}
            disabled={searchGroupLoading || running}
          >
            Refresh report
          </button>
        </div>

        {searchGroupLoading ? <LoadingState compact>Analyzing search groups…</LoadingState> : null}
        {searchGroupError ? <ErrorState compact>{searchGroupError}</ErrorState> : null}

        {!searchGroupLoading && !searchGroupError && searchGroupReport ? (
          <>
            <div className="admin-intelligence__stats">
              <div className="admin-intelligence__stat">
                <span>Total equipment rows</span>
                <strong>{searchGroupReport.total_equipment_rows?.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Unique search groups</span>
                <strong>{searchGroupReport.unique_primary_keywords?.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Current Apify searches</span>
                <strong>{searchGroupReport.current_apify_searches_required?.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>After dedupe</span>
                <strong>{searchGroupReport.deduped_apify_searches_required?.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Estimated saving</span>
                <strong>
                  {searchGroupReport.apify_search_savings_percent}%
                </strong>
              </div>
            </div>

            <h3 className="admin-intelligence-batch-sync__subheading">Largest duplicate keyword groups</h3>
            <ul className="admin-intelligence-batch-sync__group-list">
              {(searchGroupReport.largest_keyword_groups ?? [])
                .filter((group) => group.member_count > 1)
                .slice(0, 12)
                .map((group) => (
                  <li key={group.primary_keyword}>
                    <strong>
                      {group.labels?.[0] || group.primary_keyword}
                    </strong>
                    {' '}
                    ({group.member_count} rows) — keyword: &ldquo;{group.primary_keyword}&rdquo;
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="admin-intelligence__panel admin-intelligence-batch-sync__priority-panel">
        <div className="admin-intelligence-batch-sync__priority-header">
          <div>
            <h2 className="admin-intelligence__panel-title">Priority Sync</h2>
            <p className="admin-intelligence-batch-sync__defaults">
              Heuristic ranking across {totalScored > 0 ? `${totalScored.toLocaleString('en-GB')} equipment rows` : 'all equipment rows'}.
              Top {priorityGroupCount || 50} unique search groups selected
              {priorityRowCount > 0 ? ` (${priorityRowCount.toLocaleString('en-GB')} equipment rows).` : '.'}
              {' '}No Apify calls until sync starts.
            </p>
          </div>
          <div className="admin-intelligence__actions">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={loadPriorityRanking}
              disabled={priorityLoading || running}
            >
              Refresh ranking
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              onClick={() => runBatch({
                mode: 'priority',
                equipmentIds: priorityEquipmentIds,
                searchGroupKeys: prioritySearchGroupKeys,
                forceDedupeSearchGroups: true,
              })}
              disabled={
                running ||
                priorityLoading ||
                prioritySearchGroupKeys.length === 0
              }
            >
              {running && batchMode === 'priority'
                ? 'Syncing top search groups…'
                : dryRun
                  ? `Dry run top ${priorityGroupCount || 50} search groups`
                  : `Sync Top ${priorityGroupCount || 50} Search Groups`}
            </button>
          </div>
        </div>

        {priorityLoading ? <LoadingState compact>Scoring equipment catalogue…</LoadingState> : null}
        {priorityError ? <ErrorState compact>{priorityError}</ErrorState> : null}

        {!priorityLoading && !priorityError && priorityTop.length > 0 ? (
          <div className="admin-intelligence__table-wrap">
            <table className="admin-intelligence__table admin-intelligence-batch-sync__priority-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Search group</th>
                  <th>Rows</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Series</th>
                  <th>Score</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {priorityTop.map((entry) => (
                  <tr key={entry.keyword_key || entry.equipment_id}>
                    <td>{entry.rank}</td>
                    <td className="admin-intelligence-batch-sync__reason-cell">
                      {entry.primary_keyword || entry.label || '—'}
                    </td>
                    <td>{entry.member_count ?? 1}</td>
                    <td>{entry.brand}</td>
                    <td>{entry.model}</td>
                    <td>{entry.series || '—'}</td>
                    <td>
                      <strong>{entry.popularity_score}</strong>
                    </td>
                    <td className="admin-intelligence-batch-sync__reason-cell">{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="admin-intelligence__panel">
        <h2 className="admin-intelligence__panel-title">Brand batch controls</h2>

        {loadingOptions ? <LoadingState compact>Loading brand options…</LoadingState> : null}

        <div className="admin-intelligence-batch-sync__controls">
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="batch-brand">
              Brand
            </label>
            <select
              id="batch-brand"
              className="admin-intelligence__select"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              disabled={running}
            >
              {brands.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="batch-max-rows">
              Max rows to process
            </label>
            <select
              id="batch-max-rows"
              className="admin-intelligence__select"
              value={maxRows}
              onChange={(event) => setMaxRows(Number(event.target.value))}
              disabled={running}
            >
              {MAX_ROW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 256 ? `All ${brand} (${option})` : option}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-intelligence__field admin-intelligence-batch-sync__checkbox-field">
            <label className="admin-intelligence-batch-sync__checkbox-label">
              <input
                type="checkbox"
                className="admin-intelligence__checkbox"
                checked={dedupeSearchGroups}
                onChange={(event) => setDedupeSearchGroups(event.target.checked)}
                disabled={running}
              />
              Deduplicate search groups (one Apify search per unique keyword)
            </label>
          </div>

          <div className="admin-intelligence__field admin-intelligence-batch-sync__checkbox-field">
            <label className="admin-intelligence-batch-sync__checkbox-label">
              <input
                type="checkbox"
                className="admin-intelligence__checkbox"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                disabled={running}
              />
              Dry run (search and classify only — do not save)
            </label>
          </div>
        </div>

        <p className="admin-intelligence-batch-sync__defaults">
          Apify: 90 days · 10 results/model · skip rows with 5+ observations · auto-save accepted ≥
          90 confidence · target 10 observations per row
          {dedupeSearchGroups ? ' · batch steps count unique search groups, not equipment rows' : ''}
        </p>

        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={() => runBatch({ mode: 'brand', rowLimit: maxRows })}
            disabled={running || loadingOptions}
          >
            {running && batchMode === 'brand'
              ? 'Running batch…'
              : dryRun
                ? 'Start brand dry run'
                : 'Start brand batch sync'}
          </button>
          {running ? (
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={handleCancel}
            >
              Cancel after current row
            </button>
          ) : null}
        </div>
      </section>

      {running ? (
        <section className="admin-intelligence__panel">
          <h2 className="admin-intelligence__panel-title">Progress</h2>
          <p className="admin-intelligence__count">{progressLabel}</p>
          <LoadingState compact>
            Processing next {dedupeSearchGroups ? 'search group' : 'equipment row'} (Apify may take up to 2 minutes per search)…
          </LoadingState>
        </section>
      ) : null}

      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {summary ? (
        <section className="admin-intelligence__panel">
          <h2 className="admin-intelligence__panel-title">
            {complete ? 'Batch complete' : 'Batch stopped'}
          </h2>
          <div className="admin-intelligence__stats">
            <div className="admin-intelligence__stat admin-intelligence__stat--ok">
              <span>Synced</span>
              <strong>{summary.synced}</strong>
            </div>
            <div className="admin-intelligence__stat">
              <span>Skipped</span>
              <strong>{summary.skipped}</strong>
            </div>
            <div className="admin-intelligence__stat admin-intelligence__stat--bad">
              <span>Failed</span>
              <strong>{summary.failed}</strong>
            </div>
            {dryRun ? (
              <div className="admin-intelligence__stat">
                <span>Dry run</span>
                <strong>{summary.dry_run}</strong>
              </div>
            ) : null}
            <div className="admin-intelligence__stat admin-intelligence__stat--ok">
              <span>Observations added</span>
              <strong>{summary.observations_added}</strong>
            </div>
            <div className="admin-intelligence__stat">
              <span>Review logged</span>
              <strong>{summary.review_logged}</strong>
            </div>
            <div className="admin-intelligence__stat">
              <span>Rejected</span>
              <strong>{summary.rejected}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {rowResults.length > 0 ? (
        <section className="admin-intelligence__panel">
          <h2 className="admin-intelligence__panel-title">Row results</h2>
          <div className="admin-intelligence__table-wrap">
            <table className="admin-intelligence__table admin-intelligence-batch-sync__table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Accepted</th>
                  <th>Review</th>
                  <th>Rejected</th>
                  <th>Dupes skipped</th>
                  <th>Keyword</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rowResults.map((row) => (
                  <tr key={`${row.equipment_id}-${row.synced_at}`}>
                    <td>
                      {[row.brand, row.series, row.model].filter(Boolean).join(' ')}
                    </td>
                    <td>
                      <span className={`admin-intelligence-batch-sync__status admin-intelligence-batch-sync__status--${row.status}`}>
                        {formatStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>{row.observations_added}</td>
                    <td>{row.accepted_count}</td>
                    <td>{row.review_count}</td>
                    <td>{row.rejected_count}</td>
                    <td>{row.skipped_duplicate_count}</td>
                    <td>{row.keyword_used || '—'}</td>
                    <td>{row.error_message || (row.review_candidates?.length ? `${row.review_candidates.length} review logged` : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}

export default AdminIntelligenceBatchSyncPage
