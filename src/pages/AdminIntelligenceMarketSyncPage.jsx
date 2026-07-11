import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  fetchMarketSyncRows,
  fetchMarketSyncStats,
  formatLastMarketSyncAt,
  formatMarketSyncStatus,
  formatTradeInValue,
  getEquipmentIntelligenceDisplayName,
  getObservationCount,
} from '../lib/equipmentIntelligence'
import {
  formatCandidatePrice,
  formatCandidateSoldAt,
  formatCandidateSource,
  getMarketSearchCandidateKey,
  runIntelligenceEbaySoldSearch,
  runIntelligenceMarketSearch,
  saveMarketSyncObservations,
} from '../lib/intelligenceMarketSearch'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceMarketSyncPage.css'

const EMPTY_FILTERS = {
  brand: '',
  category: '',
  equipment_type: '',
  market_sync_status: '',
  onlyMissingObservations: false,
}

function formatPageFetchStatus(candidate) {
  const status = candidate?.page_fetch_status
  if (status === 'fetched') return 'OK'
  if (status === 'failed') return candidate?.page_fetch_error || 'Failed'
  return 'Skipped'
}

function formatEbayPriceDebug(candidate) {
  const parts = []
  if (candidate?.structured_price_raw != null && candidate.structured_price_raw !== '') {
    parts.push(`raw: ${candidate.structured_price_raw}`)
  }
  if (candidate?.price_used != null) {
    parts.push(`used: ${candidate.price_used}`)
  }
  if (candidate?.price_source) {
    parts.push(candidate.price_source)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function formatEbayMatchDebug(candidate) {
  const breakdown = candidate?.score_breakdown
  if (breakdown) {
    const parts = []
    if (breakdown.expected_model) parts.push(`expected: ${breakdown.expected_model}`)
    if (breakdown.detected_model_tokens?.length) {
      parts.push(`detected: ${breakdown.detected_model_tokens.join(', ')}`)
    }
    if (breakdown.matched_alias) parts.push(`matched_alias: ${breakdown.matched_alias}`)
    if (breakdown.parts_terms_detected?.length) {
      parts.push(`parts_terms: ${breakdown.parts_terms_detected.join(', ')}`)
    }
    return parts.length > 0 ? parts.join(' | ') : '—'
  }

  const expectedCode = candidate?.expected_model_code ?? candidate?.strong_model_code
  const detectedTokens = candidate?.detected_model_tokens_in_title?.join(', ')
  const matchedAlias = candidate?.matched_alias
  const parts = []
  if (expectedCode) parts.push(`expected: ${expectedCode}`)
  if (detectedTokens) parts.push(`detected: ${detectedTokens}`)
  if (matchedAlias) parts.push(`matched_alias: ${matchedAlias}`)
  return parts.length > 0 ? parts.join(' | ') : '—'
}

function EbayCalibrationSummaryPanel({ summary }) {
  if (!summary) return null

  return (
    <section className="admin-intelligence-market-sync__calibration-panel">
      <h3 className="admin-intelligence-market-sync__results-heading">Matcher calibration</h3>
      <div className="admin-intelligence-market-sync__results-summary">
        <span>{summary.accepted_count} accepted</span>
        <span>{summary.review_count} review</span>
        <span>{summary.rejected_count} rejected</span>
        <span>Avg confidence: {summary.average_confidence}</span>
        <span>Parts/accessory rejects: {summary.rejected_by_parts_accessory_count}</span>
        <span>Wrong model rejects: {summary.rejected_by_wrong_model_count}</span>
        <span>Review (missing model): {summary.review_missing_exact_model_count}</span>
        <span>Low price penalised: {summary.low_price_penalised_count}</span>
      </div>
    </section>
  )
}

function formatCandidateStatusLabel(status) {
  if (status === 'accepted') return 'Accepted'
  if (status === 'review') return 'Review'
  return 'Rejected'
}

function CandidateStatusBadge({ status }) {
  return (
    <span
      className={`admin-intelligence-market-sync__candidate-status admin-intelligence-market-sync__candidate-status--${status || 'rejected'}`}
    >
      {formatCandidateStatusLabel(status)}
    </span>
  )
}

function EbayScoreBreakdownContent({ breakdown }) {
  if (!breakdown) return <p className="admin-intelligence-market-sync__candidate-empty">—</p>

  const rows = [
    ['Status', breakdown.status],
    ['Final confidence', breakdown.final_confidence],
    ['Before warnings', breakdown.confidence_before_warnings],
    ['Base score', breakdown.base_score],
    ['Brand score', breakdown.brand_score],
    ['Model score', breakdown.model_score],
    ['Equipment type score', breakdown.equipment_type_score],
    ['Series/range bonus', breakdown.series_range_bonus ?? 0],
    ['Sold/completed bonus', breakdown.sold_completed_bonus],
    ['Service/working bonus', breakdown.service_working_bonus],
    ['Low price penalty', breakdown.low_price_penalty > 0 ? `-${breakdown.low_price_penalty}` : 0],
    ['Score path', breakdown.score_path],
    ['Expected brand', breakdown.expected_brand || '—'],
    ['Detected brand', breakdown.detected_brand || '—'],
    ['Brand match', breakdown.brand_match === true ? 'true' : breakdown.brand_match === false ? 'false' : '—'],
    ['Expected model', breakdown.expected_model || '—'],
    ['Detected model tokens', breakdown.detected_model_tokens?.join(', ') || '—'],
    ['Matched alias', breakdown.matched_alias || '—'],
    ['Parts terms', breakdown.parts_terms_detected?.join(', ') || '—'],
    ['Faulty terms', breakdown.faulty_terms_detected?.join(', ') || '—'],
    ['Parts hard reject', breakdown.parts_accessory_hard_reject || '—'],
    ['Wrong model hard reject', breakdown.wrong_model_hard_reject || '—'],
    ['Missing model result', breakdown.missing_model_result || '—'],
    ['Reason', breakdown.reason],
  ]

  return (
    <div className="admin-intelligence-market-sync__score-breakdown-content">
      <dl className="admin-intelligence-market-sync__score-breakdown-list">
        {rows.map(([label, value]) => (
          <div key={label} className="admin-intelligence-market-sync__score-breakdown-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {breakdown.scoring_steps?.length ? (
        <ol className="admin-intelligence-market-sync__score-breakdown-steps">
          {breakdown.scoring_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function EbayScoreBreakdownDetails({ candidate, inline = false }) {
  const breakdown = candidate?.score_breakdown
  if (!breakdown) return inline ? null : '—'

  if (inline) {
    return (
      <div className="admin-intelligence-market-sync__candidate-debug-block">
        <h4 className="admin-intelligence-market-sync__candidate-debug-title">Score breakdown</h4>
        <EbayScoreBreakdownContent breakdown={breakdown} />
      </div>
    )
  }

  return (
    <details className="admin-intelligence-market-sync__score-breakdown">
      <summary>
        Score breakdown ({breakdown.final_confidence})
      </summary>
      <EbayScoreBreakdownContent breakdown={breakdown} />
    </details>
  )
}

function MarketSyncEbayCandidateCard({
  candidate,
  selectable = false,
  selected = false,
  onToggle,
}) {
  return (
    <article
      className={`admin-intelligence-market-sync__candidate-card admin-intelligence-market-sync__candidate-card--${candidate.status}`}
    >
      <div className="admin-intelligence-market-sync__candidate-card-header">
        {selectable ? (
          <label className="admin-intelligence-market-sync__candidate-checkbox">
            <input
              type="checkbox"
              className="admin-intelligence__checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Select ${candidate.title || 'candidate'}`}
            />
          </label>
        ) : null}
        <CandidateStatusBadge status={candidate.status} />
        <span className="admin-intelligence-market-sync__candidate-confidence">
          {candidate.confidence}
        </span>
        <span className="admin-intelligence-market-sync__candidate-price">
          {formatCandidatePrice(candidate)}
        </span>
        <span className="admin-intelligence-market-sync__candidate-sold">
          {formatCandidateSoldAt(candidate.sold_at)}
        </span>
        <h4 className="admin-intelligence-market-sync__candidate-title">
          {candidate.title || '—'}
        </h4>
      </div>

      <p className="admin-intelligence-market-sync__candidate-reason">
        {candidate.reason || '—'}
      </p>

      <details className="admin-intelligence-market-sync__candidate-details">
        <summary>Details &amp; debug</summary>
        <div className="admin-intelligence-market-sync__candidate-details-body">
          <div className="admin-intelligence-market-sync__candidate-details-grid">
            <div className="admin-intelligence-market-sync__candidate-media">
              {candidate.image_url ? (
                <a
                  href={candidate.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-intelligence-market-sync__result-link"
                >
                  <img
                    src={candidate.image_url}
                    alt=""
                    className="admin-intelligence-market-sync__ebay-thumb"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="admin-intelligence-market-sync__candidate-no-image">No image</div>
              )}
            </div>
            <dl className="admin-intelligence-market-sync__candidate-meta">
              <div>
                <dt>Source</dt>
                <dd>{formatCandidateSource(candidate)}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{candidate.condition || '—'}</dd>
              </div>
              <div>
                <dt>Price debug</dt>
                <dd>{formatEbayPriceDebug(candidate)}</dd>
              </div>
              <div>
                <dt>Match</dt>
                <dd>{formatEbayMatchDebug(candidate)}</dd>
              </div>
              <div>
                <dt>Listing</dt>
                <dd>
                  {candidate.url ? (
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-intelligence-market-sync__result-link"
                    >
                      View listing
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <EbayScoreBreakdownDetails candidate={candidate} inline />
        </div>
      </details>
    </article>
  )
}

function renderEbayCandidateCards(candidates, { selectable = false, selectedKeys, onToggle }) {
  return (
    <div className="admin-intelligence-market-sync__candidate-list">
      {candidates.map((candidate) => {
        const key = getMarketSearchCandidateKey(candidate)
        return (
          <MarketSyncEbayCandidateCard
            key={`${candidate.status}-${key}`}
            candidate={candidate}
            selectable={selectable}
            selected={selectedKeys.has(key)}
            onToggle={() => onToggle(candidate)}
          />
        )
      })}
    </div>
  )
}

function MarketSearchResultsModal({
  result,
  searchError,
  searching,
  searchingLabel,
  isEbayMode,
  ebayAwaitingRun,
  ebayCustomKeyword,
  onEbayCustomKeywordChange,
  onRunEbaySearch,
  onClose,
  onSaved,
}) {
  const isEbayResult = result?.search_type === 'ebay_sold'
  const equipmentName = getEquipmentIntelligenceDisplayName(result?.equipment)
  const acceptedCandidates = useMemo(
    () => (result?.candidates ?? []).filter((candidate) => candidate.status === 'accepted'),
    [result],
  )
  const reviewCandidates = useMemo(
    () => (result?.candidates ?? []).filter((candidate) => candidate.status === 'review'),
    [result],
  )
  const rejectedCandidates = useMemo(
    () => (result?.candidates ?? []).filter((candidate) => candidate.status === 'rejected'),
    [result],
  )
  const savableCandidates = useMemo(
    () => [...acceptedCandidates, ...reviewCandidates],
    [acceptedCandidates, reviewCandidates],
  )

  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)

  const existingObservationCount = Number(result?.existing_observation_count) || 0
  const selectedCandidates = useMemo(
    () =>
      savableCandidates.filter((candidate) =>
        selectedKeys.has(getMarketSearchCandidateKey(candidate)),
      ),
    [savableCandidates, selectedKeys],
  )
  const selectedCount = selectedCandidates.length
  const allSavableSelected =
    savableCandidates.length > 0 &&
    savableCandidates.every((candidate) =>
      selectedKeys.has(getMarketSearchCandidateKey(candidate)),
    )

  useEffect(() => {
    setSelectedKeys(
      new Set(acceptedCandidates.map((candidate) => getMarketSearchCandidateKey(candidate))),
    )
    setSaving(false)
    setSaveError('')
    setSaveSuccess('')
    setShowReplaceConfirm(false)
  }, [result])

  function toggleCandidate(candidate) {
    const key = getMarketSearchCandidateKey(candidate)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    setSaveError('')
    setSaveSuccess('')
    setShowReplaceConfirm(false)
  }

  function toggleSelectAllAccepted() {
    setSelectedKeys((current) => {
      if (allSavableSelected) {
        return new Set()
      }
      return new Set(
        savableCandidates.map((candidate) => getMarketSearchCandidateKey(candidate)),
      )
    })
    setSaveError('')
    setSaveSuccess('')
    setShowReplaceConfirm(false)
  }

  async function performSave() {
    const equipmentId = result?.equipment?.id
    if (!equipmentId || selectedCount === 0) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const saveResult = await saveMarketSyncObservations(equipmentId, selectedCandidates)

    if (saveResult.error) {
      setSaveError(getAdminErrorMessage(saveResult.error))
      setSaving(false)
      setShowReplaceConfirm(false)
      return
    }

    setSaveSuccess(
      `Saved ${saveResult.savedCount} market observation${saveResult.savedCount === 1 ? '' : 's'}.`,
    )
    setSaving(false)
    setShowReplaceConfirm(false)
    await onSaved?.()
  }

  function handleApproveClick() {
    if (selectedCount === 0 || saving || searching || searchError) return

    if (existingObservationCount > 0) {
      setShowReplaceConfirm(true)
      return
    }

    void performSave()
  }

  function renderSavableBulkSelect() {
    if (!isEbayResult || savableCandidates.length === 0) return null

    return (
      <label className="admin-intelligence-market-sync__bulk-select">
        <input
          type="checkbox"
          className="admin-intelligence__checkbox"
          checked={allSavableSelected}
          onChange={toggleSelectAllAccepted}
        />
        <span>
          Select all accepted and review candidates ({savableCandidates.length})
        </span>
      </label>
    )
  }

  function renderRejectedTable(candidates, emptyMessage) {
    if (candidates.length === 0) {
      return <p className="admin-intelligence-market-sync__empty-group">{emptyMessage}</p>
    }

    if (isEbayResult) {
      return renderEbayCandidateCards(candidates, {
        selectable: false,
        selectedKeys,
        onToggle: toggleCandidate,
      })
    }

    return (
      <div className="admin-intelligence-market-sync__results-table-wrap">
        <table className="admin-intelligence__table admin-intelligence-market-sync__results-table">
          <thead>
            <tr>
              <th>Fetch</th>
              <th>Price</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>Reason</th>
              <th>Title</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={`${candidate.status}-${getMarketSearchCandidateKey(candidate)}`}>
                <td>{formatPageFetchStatus(candidate)}</td>
                <td>{formatCandidatePrice(candidate)}</td>
                <td>{formatCandidateSource(candidate)}</td>
                <td>{candidate.confidence}</td>
                <td className="admin-intelligence-market-sync__wrap-cell">{candidate.reason}</td>
                <td className="admin-intelligence-market-sync__wrap-cell">{candidate.title || '—'}</td>
                <td>
                  {candidate.url ? (
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-intelligence-market-sync__result-link"
                    >
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderAcceptedTable() {
    if (acceptedCandidates.length === 0) {
      return (
        <p className="admin-intelligence-market-sync__empty-group">
          No accepted candidates. Check rejected results below.
        </p>
      )
    }

    if (isEbayResult) {
      return renderEbayCandidateCards(acceptedCandidates, {
        selectable: true,
        selectedKeys,
        onToggle: toggleCandidate,
      })
    }

    return (
      <div className="admin-intelligence-market-sync__results-table-wrap">
        <table className="admin-intelligence__table admin-intelligence-market-sync__results-table">
          <thead>
            <tr>
              <th className="admin-intelligence__checkbox-cell">
                <input
                  type="checkbox"
                  className="admin-intelligence__checkbox"
                  checked={allSavableSelected}
                  onChange={toggleSelectAllAccepted}
                  aria-label="Select all accepted and review candidates"
                />
              </th>
              <th>Fetch</th>
              <th>Price</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>Reason</th>
              <th>Title</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {acceptedCandidates.map((candidate) => {
              const key = getMarketSearchCandidateKey(candidate)
              const isSelected = selectedKeys.has(key)

              return (
                <tr key={key}>
                  <td className="admin-intelligence__checkbox-cell">
                    <input
                      type="checkbox"
                      className="admin-intelligence__checkbox"
                      checked={isSelected}
                      onChange={() => toggleCandidate(candidate)}
                      aria-label={`Select ${candidate.title || 'candidate'}`}
                    />
                  </td>
                  <td>{formatPageFetchStatus(candidate)}</td>
                  <td>{formatCandidatePrice(candidate)}</td>
                  <td>{formatCandidateSource(candidate)}</td>
                  <td>{candidate.confidence}</td>
                  <td className="admin-intelligence-market-sync__wrap-cell">{candidate.reason}</td>
                  <td className="admin-intelligence-market-sync__wrap-cell">{candidate.title || '—'}</td>
                  <td>
                    {candidate.url ? (
                      <a
                        href={candidate.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-intelligence-market-sync__result-link"
                      >
                        View
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function renderReviewTable() {
    if (reviewCandidates.length === 0) {
      return (
        <p className="admin-intelligence-market-sync__empty-group">
          No review candidates. Vague brand/equipment-type matches will appear here.
        </p>
      )
    }

    if (isEbayResult) {
      return renderEbayCandidateCards(reviewCandidates, {
        selectable: true,
        selectedKeys,
        onToggle: toggleCandidate,
      })
    }

    return null
  }

  const canSave = selectedCount > 0 && !searching && !searchError && !saving

  return (
    <div
      className="admin-intelligence__modal-backdrop"
      role="presentation"
      onClick={saving ? undefined : onClose}
    >
      <div
        className={`admin-intelligence__modal admin-intelligence-market-sync__modal${isEbayResult ? ' admin-intelligence-market-sync__modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-search-results-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-intelligence-market-sync__modal-header">
          <h2 id="market-search-results-title" className="admin-intelligence__modal-title">
            {isEbayResult ? 'eBay sold preview' : 'Market search preview'}
          </h2>

          {equipmentName ? (
            <p className="admin-intelligence-market-sync__modal-equipment">
              <strong>Equipment:</strong> {equipmentName}
            </p>
          ) : null}

          {isEbayMode ? (
            <div className="admin-intelligence-market-sync__ebay-keyword-field">
              <label
                className="admin-intelligence__label"
                htmlFor="ebay-custom-keyword"
              >
                Custom eBay search keyword
              </label>
              <input
                id="ebay-custom-keyword"
                type="text"
                className="admin-intelligence__input"
                value={ebayCustomKeyword}
                onChange={(event) => onEbayCustomKeywordChange(event.target.value)}
                placeholder="e.g. concept 2 rowing machine model d pm5"
                disabled={searching || saving}
              />
              <p className="admin-intelligence-market-sync__ebay-keyword-hint">
                Leave blank to use generated eBay-style keywords. If provided, this keyword is used
                instead of auto-generated variants.
              </p>
              {isEbayMode && !searching && !saving ? (
                <button
                  type="button"
                  className="admin-intelligence__edit-button admin-intelligence-market-sync__ebay-run-button"
                  onClick={onRunEbaySearch}
                >
                  {ebayAwaitingRun ? 'Run eBay search' : 'Search again'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="admin-intelligence-market-sync__modal-body">
        {searching ? <LoadingState message={searchingLabel} /> : null}

        {!searching && searchError ? (
          <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
            {searchError}
          </p>
        ) : null}

        {!searching && !searchError && result?.message ? (
          <p className="admin-intelligence__message admin-intelligence__message--error" role="status">
            {result.message}
          </p>
        ) : null}

        {!searching && !searchError && result ? (
          <>
            <section className="admin-intelligence-market-sync__debug-panel">
              <h3 className="admin-intelligence-market-sync__results-heading">Search debug</h3>
              <div className="admin-intelligence-market-sync__results-summary">
                {isEbayResult ? (
                  <>
                    <span>Final keyword: {result.final_keyword || result.query_run || '—'}</span>
                    <span>Provider: {result.provider || 'direct'}</span>
                    {result.provider === 'apify' ? (
                      <>
                        <span>Actor: {result.actor_id || '—'}</span>
                        <span>{result.dataset_item_count ?? result.raw_result_count ?? 0} dataset items</span>
                      </>
                    ) : (
                      <span>{result.raw_result_count ?? 0} result cards</span>
                    )}
                  </>
                ) : (
                  <>
                    <span>{result.queries_run?.length ?? 0} queries run</span>
                    <span>{result.raw_result_count ?? 0} raw results</span>
                    <span>{result.deduped_result_count ?? 0} deduped</span>
                    <span>{result.pages_fetched ?? 0} pages fetched</span>
                    <span>{result.pages_failed ?? 0} pages failed</span>
                    <span>{result.prices_found ?? 0} prices found</span>
                  </>
                )}
                <span>{result.accepted_count ?? 0} accepted</span>
                <span>{result.review_count ?? 0} review</span>
                <span>{result.rejected_count ?? 0} rejected</span>
                <span>{selectedCount} selected to save</span>
              </div>
              {isEbayResult && result.keyword_attempts?.length ? (
                <div className="admin-intelligence-market-sync__fetch-failures">
                  <h4 className="admin-intelligence-market-sync__fetch-failures-title">
                    Keyword attempts
                  </h4>
                  <ul className="admin-intelligence-market-sync__queries-list">
                    {result.keyword_attempts.map((attempt) => (
                      <li key={attempt.keyword}>
                        {attempt.keyword} — {attempt.dataset_count} dataset item
                        {attempt.dataset_count === 1 ? '' : 's'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {isEbayResult && result.provider === 'apify' && result.apify_input ? (
                <div className="admin-intelligence-market-sync__fetch-failures">
                  <h4 className="admin-intelligence-market-sync__fetch-failures-title">
                    Apify input
                  </h4>
                  <pre className="admin-intelligence-market-sync__apify-input">
                    {JSON.stringify(result.apify_input, null, 2)}
                  </pre>
                </div>
              ) : null}
              {isEbayResult && result.ebay_url ? (
                <p className="admin-intelligence-market-sync__ebay-url">
                  <strong>eBay URL:</strong>{' '}
                  <a
                    href={result.ebay_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-intelligence-market-sync__result-link"
                  >
                    {result.ebay_url}
                  </a>
                </p>
              ) : null}
              {!isEbayResult && result.page_fetch_failures?.length ? (
                <div className="admin-intelligence-market-sync__fetch-failures">
                  <h4 className="admin-intelligence-market-sync__fetch-failures-title">
                    Page fetch failures
                  </h4>
                  <ul className="admin-intelligence-market-sync__queries-list">
                    {result.page_fetch_failures.map((failure) => (
                      <li key={`${failure.url}-${failure.error}`}>
                        <a
                          href={failure.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-intelligence-market-sync__result-link"
                        >
                          {failure.url}
                        </a>
                        {' — '}
                        {failure.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!isEbayResult && result.queries_run?.length ? (
                <ul className="admin-intelligence-market-sync__queries-list">
                  {result.queries_run.map((query) => (
                    <li key={query}>{query}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            {isEbayResult ? (
              <EbayCalibrationSummaryPanel summary={result.calibration_summary} />
            ) : null}

            {renderSavableBulkSelect()}

            <section className="admin-intelligence-market-sync__results-section">
              <h3 className="admin-intelligence-market-sync__results-heading">Accepted candidates</h3>
              {renderAcceptedTable()}
            </section>

            {isEbayResult ? (
              <section className="admin-intelligence-market-sync__results-section">
                <h3 className="admin-intelligence-market-sync__results-heading">Review candidates</h3>
                {renderReviewTable()}
              </section>
            ) : null}

            <section className="admin-intelligence-market-sync__results-section">
              <h3 className="admin-intelligence-market-sync__results-heading">Rejected candidates</h3>
              {renderRejectedTable(rejectedCandidates, 'No rejected candidates returned.')}
            </section>
          </>
        ) : null}
        </div>

        <div className="admin-intelligence-market-sync__modal-footer">
        {saveError ? (
          <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
            {saveError}
          </p>
        ) : null}

        {saveSuccess ? (
          <p
            className="admin-intelligence__message admin-intelligence__message--success"
            role="status"
          >
            {saveSuccess}
          </p>
        ) : null}

        {showReplaceConfirm ? (
          <div className="admin-intelligence-market-sync__replace-confirm">
            <p className="admin-intelligence-market-sync__replace-confirm-text">
              This equipment already has {existingObservationCount} market observation
              {existingObservationCount === 1 ? '' : 's'}. Saving will replace them with{' '}
              {selectedCount} selected candidate{selectedCount === 1 ? '' : 's'}.
            </p>
            <div className="admin-intelligence__actions">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={() => setShowReplaceConfirm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--danger"
                onClick={() => void performSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Replace and save'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="admin-intelligence-market-sync__modal-actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            disabled={!canSave}
            onClick={handleApproveClick}
          >
            {saving ? 'Saving…' : 'Approve and save observations'}
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

function AdminIntelligenceMarketSyncPage() {
  usePageTitle('Admin Intelligence Market Sync')

  const [stats, setStats] = useState(null)
  const [filterOptions, setFilterOptions] = useState(null)
  const [rows, setRows] = useState([])
  const [rowsTotalCount, setRowsTotalCount] = useState(0)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [syncingRowId, setSyncingRowId] = useState(null)
  const [syncingMode, setSyncingMode] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [resultsOpen, setResultsOpen] = useState(false)
  const [pendingEbayRow, setPendingEbayRow] = useState(null)
  const [ebayAwaitingRun, setEbayAwaitingRun] = useState(false)
  const [ebayCustomKeyword, setEbayCustomKeyword] = useState('')

  const loadData = useCallback(async (activeFilters) => {
    setLoading(true)
    setError('')

    const [statsResult, rowsResult] = await Promise.all([
      fetchMarketSyncStats(),
      fetchMarketSyncRows(activeFilters),
    ])

    if (statsResult.error) {
      setError(getAdminErrorMessage(statsResult.error))
      setStats(null)
      setFilterOptions(null)
      setRows([])
      setRowsTotalCount(0)
      setLoading(false)
      return
    }

    if (rowsResult.error) {
      setError(getAdminErrorMessage(rowsResult.error))
      setStats(statsResult.stats)
      setFilterOptions(statsResult.filterOptions)
      setRows([])
      setRowsTotalCount(0)
      setLoading(false)
      return
    }

    setStats(statsResult.stats)
    setFilterOptions(statsResult.filterOptions)
    setRows(rowsResult.data ?? [])
    setRowsTotalCount(rowsResult.totalCount ?? rowsResult.data?.length ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData(filters)
  }, [filters, loadData])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function closeResultsModal() {
    if (syncingRowId) return
    setResultsOpen(false)
    setSearchResult(null)
    setSearchError('')
    setSyncingMode(null)
    setPendingEbayRow(null)
    setEbayAwaitingRun(false)
    setEbayCustomKeyword('')
  }

  const handleMarketSyncSaved = useCallback(async () => {
    closeResultsModal()
    await loadData(filters)
  }, [filters, loadData])

  function buildEmptySearchResult(row, searchType) {
    return {
      search_type: searchType,
      equipment: {
        id: row.id,
        brand: row.brand,
        series: row.series,
        model: row.model,
        slug: row.slug,
      },
      candidates: [],
      accepted_count: 0,
      review_count: 0,
      rejected_count: 0,
      queries_run: [],
      query_run: '',
      ebay_url: '',
      provider: 'direct',
      actor_id: null,
      dataset_item_count: null,
      apify_input: null,
      final_keyword: null,
      keyword_attempts: [],
      raw_result_count: 0,
      deduped_result_count: 0,
      pages_fetched: 0,
      pages_failed: 0,
      prices_found: 0,
      page_fetch_failures: [],
      message: null,
      existing_observation_count: getObservationCount(row),
    }
  }

  async function handleBraveSyncClick(row) {
    setSyncingRowId(row.id)
    setSyncingMode('brave')
    setSearchResult(null)
    setSearchError('')
    setResultsOpen(true)

    const result = await runIntelligenceMarketSearch(row.id)

    if (result.error) {
      setSearchError(getAdminErrorMessage(result.error))
      setSearchResult(buildEmptySearchResult(row, 'brave'))
      setSyncingRowId(null)
      setSyncingMode(null)
      return
    }

    setSearchResult({
      ...result.data,
      existing_observation_count: getObservationCount(row),
    })
    setSyncingRowId(null)
    setSyncingMode(null)
  }

  async function handleEbaySoldClick(row) {
    setPendingEbayRow(row)
    setSyncingMode('ebay')
    setSyncingRowId(null)
    setSearchResult(buildEmptySearchResult(row, 'ebay_sold'))
    setSearchError('')
    setEbayCustomKeyword('')
    setEbayAwaitingRun(true)
    setResultsOpen(true)
  }

  async function handleRunEbaySearch() {
    if (!pendingEbayRow) return

    setEbayAwaitingRun(false)
    setSyncingRowId(pendingEbayRow.id)
    setSearchError('')

    const result = await runIntelligenceEbaySoldSearch(
      pendingEbayRow.id,
      ebayCustomKeyword,
    )

    if (result.error) {
      setSearchError(getAdminErrorMessage(result.error))
      setSearchResult(buildEmptySearchResult(pendingEbayRow, 'ebay_sold'))
      setSyncingRowId(null)
      return
    }

    setSearchResult({
      ...result.data,
      existing_observation_count: getObservationCount(pendingEbayRow),
    })
    setSyncingRowId(null)
  }

  const brands = filterOptions?.brands ?? []
  const categories = filterOptions?.categories ?? []
  const equipmentTypes = filterOptions?.equipmentTypes ?? []
  const marketSyncStatuses = filterOptions?.marketSyncStatuses ?? []

  return (
    <section className="admin-intelligence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Market Sync</h1>
        <p className="admin-intelligence__lead">
          Run Brave web search or eBay sold lookups for one equipment row, approve candidates, and
          save them as market observations.
        </p>
        <div className="admin-intelligence__actions">
          <Link
            to="/admin/intelligence/batch-sync"
            className="admin-intelligence__button admin-intelligence__button--primary"
          >
            Batch eBay sync
          </Link>
        </div>
      </header>

      {loading ? <LoadingState message="Loading market sync data…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="Could not load market sync data"
          message={error}
          onRetry={() => loadData(filters)}
        />
      ) : null}

      {!loading && !error && stats ? (
        <>
          <section className="admin-intelligence__panel">
            <h2 className="admin-intelligence__panel-title">Coverage</h2>
            <div className="admin-intelligence__stats">
              <div className="admin-intelligence__stat">
                <span>Total rows</span>
                <strong>{stats.total}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>With observations</span>
                <strong>{stats.withObservations}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--bad">
                <span>Missing observations</span>
                <strong>{stats.missingObservations}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Never synced</span>
                <strong>{stats.neverSynced}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Synced last 30 days</span>
                <strong>{stats.syncedLast30Days}</strong>
              </div>
            </div>
          </section>

          <div className="admin-intelligence__controls">
            <div className="admin-intelligence-market-sync__filters">
              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="market-sync-brand">
                  Brand
                </label>
                <select
                  id="market-sync-brand"
                  className="admin-intelligence__select"
                  value={filters.brand}
                  onChange={(event) => updateFilter('brand', event.target.value)}
                >
                  <option value="">All brands</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="market-sync-category">
                  Category
                </label>
                <select
                  id="market-sync-category"
                  className="admin-intelligence__select"
                  value={filters.category}
                  onChange={(event) => updateFilter('category', event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="market-sync-equipment-type">
                  Equipment type
                </label>
                <select
                  id="market-sync-equipment-type"
                  className="admin-intelligence__select"
                  value={filters.equipment_type}
                  onChange={(event) => updateFilter('equipment_type', event.target.value)}
                >
                  <option value="">All types</option>
                  {equipmentTypes.map((equipmentType) => (
                    <option key={equipmentType} value={equipmentType}>
                      {equipmentType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="market-sync-status">
                  Sync status
                </label>
                <select
                  id="market-sync-status"
                  className="admin-intelligence__select"
                  value={filters.market_sync_status}
                  onChange={(event) => updateFilter('market_sync_status', event.target.value)}
                >
                  <option value="">All statuses</option>
                  {marketSyncStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatMarketSyncStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-intelligence__field admin-intelligence-market-sync__checkbox-field">
                <label className="admin-intelligence-market-sync__checkbox-label">
                  <input
                    type="checkbox"
                    className="admin-intelligence__checkbox"
                    checked={filters.onlyMissingObservations}
                    onChange={(event) =>
                      updateFilter('onlyMissingObservations', event.target.checked)
                    }
                  />
                  Only missing market observations
                </label>
              </div>
            </div>

            <p className="admin-intelligence__count">
              {rows.length === rowsTotalCount
                ? `Showing ${rows.length.toLocaleString('en-GB')} of ${rowsTotalCount.toLocaleString('en-GB')} rows`
                : `Showing ${rows.length.toLocaleString('en-GB')} matching rows (${rowsTotalCount.toLocaleString('en-GB')} before observation filter)`}
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No rows match these filters"
              message="Try clearing filters or import more equipment intelligence records."
            />
          ) : (
            <div className="admin-intelligence__table-wrap">
              <table className="admin-intelligence__table admin-intelligence-market-sync__table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Series</th>
                    <th>Model</th>
                    <th>Trade-in</th>
                    <th>Observations</th>
                    <th>Last sync</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isBraveSyncing = syncingRowId === row.id && syncingMode === 'brave'
                    const isEbaySyncing = syncingRowId === row.id && syncingMode === 'ebay'

                    return (
                      <tr key={row.id}>
                        <td>{row.brand || '—'}</td>
                        <td>{row.series || '—'}</td>
                        <td>{row.model || '—'}</td>
                        <td>{formatTradeInValue(row)}</td>
                        <td>{getObservationCount(row)}</td>
                        <td>{formatLastMarketSyncAt(row.last_market_sync_at)}</td>
                        <td>
                          <span
                            className={`admin-intelligence-market-sync__status admin-intelligence-market-sync__status--${row.market_sync_status || 'not_synced'}`}
                          >
                            {formatMarketSyncStatus(row.market_sync_status)}
                          </span>
                        </td>
                        <td>
                          <div className="admin-intelligence-market-sync__row-actions">
                            <button
                              type="button"
                              className="admin-intelligence__edit-button"
                              onClick={() => handleBraveSyncClick(row)}
                              disabled={Boolean(syncingRowId)}
                            >
                              {isBraveSyncing ? 'Searching…' : 'Sync market data'}
                            </button>
                            <button
                              type="button"
                              className="admin-intelligence__edit-button"
                              onClick={() => handleEbaySoldClick(row)}
                              disabled={Boolean(syncingRowId) || (resultsOpen && ebayAwaitingRun)}
                            >
                              {isEbaySyncing ? 'Searching…' : 'Find eBay sold prices'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {resultsOpen ? (
        <MarketSearchResultsModal
          result={searchResult}
          searchError={searchError}
          searching={Boolean(syncingRowId)}
          searchingLabel={
            syncingMode === 'ebay'
              ? 'Searching eBay UK sold listings…'
              : 'Searching listings and fetching candidate pages…'
          }
          isEbayMode={syncingMode === 'ebay' || searchResult?.search_type === 'ebay_sold'}
          ebayAwaitingRun={ebayAwaitingRun}
          ebayCustomKeyword={ebayCustomKeyword}
          onEbayCustomKeywordChange={setEbayCustomKeyword}
          onRunEbaySearch={() => void handleRunEbaySearch()}
          onClose={closeResultsModal}
          onSaved={handleMarketSyncSaved}
        />
      ) : null}
    </section>
  )
}

export default AdminIntelligenceMarketSyncPage
