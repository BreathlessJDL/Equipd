import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildCoreProductKeyFromFields,
  buildCoreProductName,
  buildCoreProductGroupApprovalPayload,
  markCoreProductMembersNotDuplicate,
  buildCoreProductReviewData,
  excludeCoreProductMember,
  fetchEquipmentIntelligenceForCoreProducts,
  persistAndApproveCoreProductGroup,
  updateCoreProductMember,
  bulkApproveCoreProductGroups,
  isApprovableCoreProductGroup,
} from '../lib/equipmentCoreProductGrouping.js'
import { CORE_PRODUCT_GROUP_STATUS } from '../lib/intelligenceCoreProductGrouping.js'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceCoreProductsPage.css'

const ALL_FILTER = ''

function formatPrice(member) {
  const price = member.best_original_price ?? member.original_rrp
  if (price == null || price === '') return '—'
  const currency = (member.best_original_price_currency || member.currency || 'GBP').toUpperCase()
  return `${currency} ${Number(price).toLocaleString('en-GB')}`
}

function CoreProductGroupModal({
  group,
  onClose,
  onSaved,
}) {
  const [representativeId, setRepresentativeId] = useState(
    group?.suggested_representative_equipment_id
      ?? group?.representative_equipment_id
      ?? '',
  )
  const [coreProductName, setCoreProductName] = useState(group?.core_product_name ?? '')
  const [productFamily, setProductFamily] = useState(group?.product_family ?? '')
  const [coreProductKey, setCoreProductKey] = useState(group?.core_product_key ?? '')
  const [editingMemberId, setEditingMemberId] = useState(null)
  const [variantType, setVariantType] = useState('console')
  const [variantName, setVariantName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editingMember = group?.members?.find((member) => member.id === editingMemberId) ?? null

  useEffect(() => {
    if (!editingMember) return
    setVariantType(editingMember.variant_type ?? editingMember.suggested?.variant_type ?? 'console')
    setVariantName(editingMember.variant_name ?? editingMember.suggested?.variant_name ?? '')
  }, [editingMember])

  function recomputeKey(nextFamily = productFamily) {
    const coreModel = group.core_model ?? group.members[0]?.suggested?.core_model
    return buildCoreProductKeyFromFields({
      brand: group.brand,
      equipmentType: group.equipment_type,
      productFamily: nextFamily || null,
      coreModel,
    })
  }

  function handleProductFamilyChange(value) {
    setProductFamily(value)
    const nextKey = recomputeKey(value)
    setCoreProductKey(nextKey)
    const coreModel = group.core_model ?? group.members[0]?.suggested?.core_model
    setCoreProductName(buildCoreProductName(group.brand, value || null, coreModel))
  }

  async function handleApprove() {
    setSaving(true)
    setError('')

    const result = await persistAndApproveCoreProductGroup(
      buildCoreProductGroupApprovalPayload(group, {
        representativeEquipmentId: representativeId,
        coreProductName,
        coreProductKey,
        productFamily,
        editingMemberId,
        variantType,
        variantName,
      }),
    )
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    onSaved()
    onClose()
  }

  async function handleNotDuplicate() {
    setSaving(true)
    setError('')
    const result = await markCoreProductMembersNotDuplicate(group.members.map((member) => member.id))
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    onSaved()
    onClose()
  }

  async function handleExcludeMember(memberId) {
    setSaving(true)
    setError('')
    const result = await excludeCoreProductMember(memberId)
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    onSaved()
    onClose()
  }

  async function handleSaveMember() {
    if (!editingMember) return
    setSaving(true)
    setError('')
    const result = await updateCoreProductMember({
      equipmentId: editingMember.id,
      coreProductName,
      coreProductKey,
      productFamily: productFamily || null,
      variantType,
      variantName,
      isBaseProduct: editingMember.id === representativeId,
      coreProductGroupConfidence: editingMember.core_product_group_confidence
        ?? editingMember.suggested?.core_product_group_confidence
        ?? null,
    })
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    setEditingMemberId(null)
    onSaved()
  }

  if (!group) return null

  const canApprove = group.member_count >= 1

  return (
    <div className="admin-core-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-core-products__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="core-product-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-core-products__modal-header">
          <h2 id="core-product-modal-title">{coreProductName || group.core_product_name}</h2>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>

        <div className="admin-core-products__modal-body">
          <p className="admin-core-products__explanation">{group.grouping_explanation}</p>
          <p className="admin-core-products__meta">
            Key: <code>{coreProductKey}</code>
            {' · '}
            {group.member_count} member{group.member_count === 1 ? '' : 's'}
            {' · '}
            Tier {group.grouping_tier}
            {' · '}
            Confidence {group.avg_confidence}%
            {group.research_dedupe_eligible ? ' · Research dedupe eligible' : ' · Review only'}
          </p>

          <div className="admin-core-products__form-grid">
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Core product name</span>
              <input
                className="admin-intelligence__input"
                value={coreProductName}
                onChange={(event) => setCoreProductName(event.target.value)}
                disabled={saving}
              />
            </label>

            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Product family</span>
              <input
                className="admin-intelligence__input"
                value={productFamily}
                onChange={(event) => handleProductFamilyChange(event.target.value)}
                disabled={saving}
                placeholder="e.g. Discover, Integrity Series"
              />
            </label>

            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Representative / base row</span>
              <select
                className="admin-intelligence__select"
                value={representativeId}
                onChange={(event) => setRepresentativeId(event.target.value)}
                disabled={saving}
              >
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {[member.series, member.model].filter(Boolean).join(' ')}
                    {member.variant_name || member.suggested?.variant_name
                      ? ` (${member.variant_name ?? member.suggested?.variant_name})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-intelligence__table-wrap admin-core-products__detail-table-wrap">
            <table className="admin-intelligence__table admin-core-products__detail-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Series</th>
                  <th>Model</th>
                  <th>Type</th>
                  <th>Family</th>
                  <th>Core product</th>
                  <th>Variant</th>
                  <th>Price</th>
                  <th>Baseline year</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.members.map((member) => (
                  <tr
                    key={member.id}
                    className={member.id === representativeId ? 'admin-core-products__row-representative' : undefined}
                  >
                    <td>{member.brand ?? '—'}</td>
                    <td>{member.series ?? '—'}</td>
                    <td>{member.model ?? '—'}</td>
                    <td>{member.equipment_type ?? '—'}</td>
                    <td>{member.product_family ?? member.suggested?.product_family ?? '—'}</td>
                    <td>{member.core_product_name ?? member.suggested?.core_product_name ?? '—'}</td>
                    <td>
                      {(member.variant_type ?? member.suggested?.variant_type ?? '—')}
                      {member.variant_name || member.suggested?.variant_name
                        ? `: ${member.variant_name ?? member.suggested?.variant_name}`
                        : ''}
                    </td>
                    <td>{formatPrice(member)}</td>
                    <td>
                      {member.baseline_manufacture_year ?? '—'}
                      {member.baseline_manufacture_year_source
                        ? ` (${member.baseline_manufacture_year_source})`
                        : ''}
                    </td>
                    <td>
                      {member.core_product_group_confidence
                        ?? member.suggested?.core_product_group_confidence
                        ?? '—'}
                      %
                    </td>
                    <td>{member.core_product_group_status}</td>
                    <td className="admin-core-products__member-actions">
                      <button
                        type="button"
                        className="admin-intelligence__button admin-intelligence__button--secondary"
                        disabled={saving}
                        onClick={() => setEditingMemberId(member.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-intelligence__button"
                        disabled={saving}
                        onClick={() => handleExcludeMember(member.id)}
                      >
                        Exclude
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingMember ? (
            <div className="admin-core-products__edit-panel">
              <h3>Edit member — {[editingMember.series, editingMember.model].filter(Boolean).join(' ')}</h3>
              <div className="admin-core-products__form-grid">
                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Variant type</span>
                  <select
                    className="admin-intelligence__select"
                    value={variantType}
                    onChange={(event) => setVariantType(event.target.value)}
                    disabled={saving}
                  >
                    <option value="console">console</option>
                    <option value="base">base</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Variant name</span>
                  <input
                    className="admin-intelligence__input"
                    value={variantName}
                    onChange={(event) => setVariantName(event.target.value)}
                    disabled={saving}
                    placeholder="e.g. SE3HD, Discover SE"
                  />
                </label>
              </div>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                disabled={saving}
                onClick={handleSaveMember}
              >
                Save member edits
              </button>
            </div>
          ) : null}

          {error ? <ErrorState compact>{error}</ErrorState> : null}
        </div>

        <footer className="admin-core-products__modal-footer">
          <button
            type="button"
            className="admin-intelligence__button"
            disabled={saving}
            onClick={handleNotDuplicate}
          >
            Mark as not duplicate
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            disabled={saving || !representativeId || !canApprove}
            title={canApprove ? undefined : 'High-confidence console groups can be approved directly; others need manual edits first.'}
            onClick={handleApprove}
          >
            Approve group
          </button>
        </footer>
      </div>
    </div>
  )
}

function PossibleRelatedClusterModal({
  cluster,
  rows,
  onClose,
  onSaved,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const members = useMemo(() => (
    cluster?.candidates?.map((candidate) => {
      const row = rows.find((entry) => entry.id === candidate.id) ?? candidate
      return {
        ...row,
        ...candidate,
      }
    }) ?? []
  ), [cluster, rows])

  async function handleNotDuplicate() {
    setSaving(true)
    setError('')
    const result = await markCoreProductMembersNotDuplicate(members.map((member) => member.id))
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    onSaved()
    onClose()
  }

  if (!cluster) return null

  return (
    <div className="admin-core-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-core-products__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="related-cluster-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-core-products__modal-header">
          <h2 id="related-cluster-modal-title">
            Possible related cluster — {cluster.brand} {cluster.core_model}
          </h2>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>

        <div className="admin-core-products__modal-body">
          <p className="admin-core-products__explanation">
            Same model word across different product families. Review only — does not affect research
            deduping unless you manually approve a high-confidence group.
          </p>
          <p className="admin-core-products__meta">
            {cluster.distinct_core_products} distinct core products · {cluster.candidate_count} candidates
            {' · '}
            Confidence {cluster.grouping_confidence}%
          </p>

          <div className="admin-intelligence__table-wrap">
            <table className="admin-intelligence__table admin-core-products__detail-table">
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Model</th>
                  <th>Core product</th>
                  <th>Family</th>
                  <th>Variant</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.series ?? '—'}</td>
                    <td>{member.model ?? '—'}</td>
                    <td>{member.core_product_name ?? '—'}</td>
                    <td>{member.product_family ?? '—'}</td>
                    <td>{member.variant_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? <ErrorState compact>{error}</ErrorState> : null}
        </div>

        <footer className="admin-core-products__modal-footer">
          <button
            type="button"
            className="admin-intelligence__button"
            disabled={saving}
            onClick={handleNotDuplicate}
          >
            Mark all as not duplicate
          </button>
        </footer>
      </div>
    </div>
  )
}

function BulkGroupApprovalSummary({ summary, onDismiss }) {
  if (!summary) return null

  return (
    <div className="admin-core-products__approval-summary" role="status">
      <div className="admin-core-products__approval-summary-header">
        <strong>{summary.title || 'Bulk approval complete'}</strong>
        <button type="button" className="admin-intelligence__button" onClick={onDismiss}>Dismiss</button>
      </div>
      <p>
        Approved <strong>{summary.approved}</strong> group{summary.approved === 1 ? '' : 's'}.
        {summary.skippedAlreadyApproved > 0 ? (
          <>
            {' '}
            <strong>{summary.skippedAlreadyApproved}</strong> were already approved.
          </>
        ) : null}
        {summary.skipped > summary.skippedAlreadyApproved ? (
          <>
            {' '}
            Skipped <strong>{summary.skipped - summary.skippedAlreadyApproved}</strong> ineligible.
          </>
        ) : null}
        {summary.failures?.length ? (
          <>
            {' '}
            Failed <strong>{summary.failures.length}</strong>.
          </>
        ) : null}
      </p>
    </div>
  )
}

export default function AdminIntelligenceCoreProductsPage() {
  usePageTitle('Core products — Equipd Intelligence')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groups, setGroups] = useState([])
  const [rows, setRows] = useState([])
  const [audit, setAudit] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState(ALL_FILTER)
  const [tierFilter, setTierFilter] = useState(ALL_FILTER)
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [variantTypeFilter, setVariantTypeFilter] = useState(ALL_FILTER)
  const [highConfidenceOnly, setHighConfidenceOnly] = useState(true)
  const [selectedGroupKey, setSelectedGroupKey] = useState(null)
  const [selectedClusterKey, setSelectedClusterKey] = useState(null)
  const [selectedGroupKeys, setSelectedGroupKeys] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [actionError, setActionError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    setActionError('')

    const result = await fetchEquipmentIntelligenceForCoreProducts()
    if (result.error) {
      setGroups([])
      setRows([])
      setAudit(null)
      setError(getAdminErrorMessage(result.error))
      setLoading(false)
      return
    }

    const review = buildCoreProductReviewData(result.rows)
    setGroups(review.groups)
    setRows(review.rows)
    setAudit(review.audit)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setSelectedGroupKeys(new Set())
  }, [
    searchInput,
    brandFilter,
    equipmentTypeFilter,
    tierFilter,
    statusFilter,
    variantTypeFilter,
    highConfidenceOnly,
  ])

  const groupsByKey = useMemo(
    () => new Map(groups.map((group) => [group.core_product_key, group])),
    [groups],
  )

  const selectedGroups = useMemo(
    () => [...selectedGroupKeys]
      .map((key) => groupsByKey.get(key))
      .filter(Boolean),
    [selectedGroupKeys, groupsByKey],
  )

  const selectedApprovableGroups = useMemo(
    () => selectedGroups.filter((group) => isApprovableCoreProductGroup(group)),
    [selectedGroups],
  )

  const selectedAlreadyApprovedCount = useMemo(
    () => selectedGroups.filter((group) => group.group_status === CORE_PRODUCT_GROUP_STATUS.APPROVED).length,
    [selectedGroups],
  )

  async function handleBulkApproveSelectedGroups() {
    if (!selectedGroups.length) {
      setActionError('Select core product groups to approve.')
      return
    }

    if (!selectedApprovableGroups.length) {
      setActionError('No pending groups selected. Already approved groups are skipped.')
      return
    }

    const confirmMessage = selectedAlreadyApprovedCount > 0
      ? `Approve ${selectedApprovableGroups.length} selected core product group(s)? ${selectedAlreadyApprovedCount} already approved group(s) will be skipped.`
      : `Approve ${selectedApprovableGroups.length} selected core product group(s)?`
    if (!window.confirm(confirmMessage)) return

    setBulkLoading(true)
    setActionError('')
    setApprovalSummary(null)
    const result = await bulkApproveCoreProductGroups(selectedGroups)
    setBulkLoading(false)

    if (result.error && result.approved === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }

    if (result.approved === 0 && !result.failures?.length) {
      setActionError('No pending groups were approved from the selection.')
      return
    }

    setApprovalSummary({
      title: 'Core product bulk approval complete',
      approved: result.approved,
      skipped: result.skipped,
      skippedAlreadyApproved: result.skippedAlreadyApproved,
      failures: result.failures,
    })
    setSelectedGroupKeys(new Set())
    await loadData()
  }

  const brandOptions = useMemo(() => (
    [...new Set(groups.map((group) => group.brand).filter(Boolean))].sort()
  ), [groups])

  const equipmentTypeOptions = useMemo(() => (
    [...new Set(groups.map((group) => group.equipment_type).filter(Boolean))].sort()
  ), [groups])

  const filteredGroups = useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    return groups.filter((group) => {
      if (highConfidenceOnly && group.member_count < 2) return false
      if (highConfidenceOnly && group.grouping_tier !== 'high') return false
      if (brandFilter && group.brand !== brandFilter) return false
      if (equipmentTypeFilter && group.equipment_type !== equipmentTypeFilter) return false
      if (tierFilter && group.grouping_tier !== tierFilter) return false
      if (statusFilter && group.group_status !== statusFilter) return false
      if (variantTypeFilter) {
        const hasVariantType = group.members.some((member) => (
          (member.variant_type ?? member.suggested?.variant_type) === variantTypeFilter
        ))
        if (!hasVariantType) return false
      }
      if (!query) return true
      const haystack = [
        group.brand,
        group.core_product_name,
        group.core_product_key,
        group.core_model,
        group.product_family,
        ...group.members.flatMap((member) => [
          member.model,
          member.series,
          member.core_product_name,
          member.suggested?.core_product_name,
        ]),
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [
    groups,
    highConfidenceOnly,
    searchInput,
    brandFilter,
    equipmentTypeFilter,
    tierFilter,
    statusFilter,
    variantTypeFilter,
  ])

  const allFilteredSelected = filteredGroups.length > 0
    && filteredGroups.every((group) => selectedGroupKeys.has(group.core_product_key))

  function toggleSelectGroup(coreProductKey) {
    setSelectedGroupKeys((current) => {
      const next = new Set(current)
      if (next.has(coreProductKey)) {
        next.delete(coreProductKey)
      } else {
        next.add(coreProductKey)
      }
      return next
    })
  }

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedGroupKeys((current) => {
        const next = new Set(current)
        for (const group of filteredGroups) {
          next.delete(group.core_product_key)
        }
        return next
      })
      return
    }

    setSelectedGroupKeys((current) => {
      const next = new Set(current)
      for (const group of filteredGroups) {
        next.add(group.core_product_key)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedGroupKeys(new Set())
  }

  const selectedGroup = useMemo(
    () => groups.find((group) => group.core_product_key === selectedGroupKey) ?? null,
    [groups, selectedGroupKey],
  )

  const selectedCluster = useMemo(
    () => audit?.possible_related_clusters?.find(
      (cluster) => cluster.related_model_key === selectedClusterKey,
    ) ?? null,
    [audit, selectedClusterKey],
  )

  return (
    <div className="admin-intelligence admin-core-products">
      <header className="admin-intelligence__header">
        <div className="admin-intelligence__breadcrumb">
          <Link to="/admin/intelligence">Intelligence</Link>
          <span aria-hidden="true">/</span>
          <span>Core products</span>
        </div>
        <h1 className="admin-intelligence__title">Core products &amp; variants</h1>
        <p className="admin-intelligence__lead">
          Review console-variant groups before approving. Rows are never deleted or merged — approvals
          persist core product fields for research deduping.
        </p>
        <div className="admin-intelligence__actions">
          <Link
            to="/admin/intelligence/original-prices-lifecycle"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            Original Prices &amp; Lifecycle
          </Link>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? <LoadingState compact>Loading core product groups…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}
      {actionError ? <ErrorState compact>{actionError}</ErrorState> : null}
      <BulkGroupApprovalSummary summary={approvalSummary} onDismiss={() => setApprovalSummary(null)} />

      {!loading && !error && audit ? (
        <>
          <section className="admin-intelligence__panel">
            <h2 className="admin-intelligence__panel-title">Audit summary</h2>
            <div className="admin-intelligence__stats">
              <div className="admin-intelligence__stat">
                <span>Total rows</span>
                <strong>{audit.total_rows.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Unique core products</span>
                <strong>{audit.unique_core_products.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>High-confidence dupes</span>
                <strong>{(audit.high_confidence_duplicate_group_count ?? 0).toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Possible related sets</span>
                <strong>{(audit.possible_related_cluster_count ?? 0).toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Variant rows</span>
                <strong>{audit.variant_row_count.toLocaleString('en-GB')}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Research call reduction</span>
                <strong>
                  {audit.estimated_research_calls.reduction}
                  {' '}
                  ({audit.estimated_research_calls.reduction_percent}%)
                </strong>
              </div>
            </div>
            <p className="admin-core-products__audit-note">
              High-confidence groups auto-dedupe research. Possible related clusters are review-only until
              manually approved.
            </p>
          </section>

          {audit.possible_related_clusters?.length > 0 ? (
            <section className="admin-intelligence__panel">
              <h2 className="admin-intelligence__panel-title">Possible related clusters</h2>
              <p className="admin-core-products__audit-note">
                Same model word across different product families — review only, does not affect research.
              </p>
              <div className="admin-intelligence__table-wrap">
                <table className="admin-intelligence__table admin-core-products__groups-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Candidates</th>
                      <th>Families</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.possible_related_clusters.slice(0, 20).map((cluster) => (
                      <tr
                        key={cluster.related_model_key}
                        className="admin-core-products__row-clickable"
                        onClick={() => setSelectedClusterKey(cluster.related_model_key)}
                      >
                        <td>
                          <strong>{cluster.brand} {cluster.core_model}</strong>
                          <div className="admin-core-products__subtle">{cluster.equipment_type || '—'}</div>
                        </td>
                        <td>{cluster.candidate_count}</td>
                        <td>
                          {cluster.candidates.map((candidate) => candidate.core_product_name).join(' · ')}
                        </td>
                        <td>{cluster.grouping_confidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="admin-intelligence__panel">
            <div className="admin-intelligence__controls">
              <div className="admin-intelligence__filters admin-core-products__filters">
                <div className="admin-intelligence__field">
                  <label className="admin-intelligence__label" htmlFor="core-product-search">
                    Search
                  </label>
                  <input
                    id="core-product-search"
                    type="search"
                    className="admin-intelligence__input"
                    placeholder="Brand, model, core product…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>

                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Brand</span>
                  <select
                    className="admin-intelligence__select"
                    value={brandFilter}
                    onChange={(event) => setBrandFilter(event.target.value)}
                  >
                    <option value={ALL_FILTER}>All brands</option>
                    {brandOptions.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Equipment type</span>
                  <select
                    className="admin-intelligence__select"
                    value={equipmentTypeFilter}
                    onChange={(event) => setEquipmentTypeFilter(event.target.value)}
                  >
                    <option value={ALL_FILTER}>All types</option>
                    {equipmentTypeOptions.map((equipmentType) => (
                      <option key={equipmentType} value={equipmentType}>{equipmentType}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Confidence tier</span>
                  <select
                    className="admin-intelligence__select"
                    value={tierFilter}
                    onChange={(event) => setTierFilter(event.target.value)}
                  >
                    <option value={ALL_FILTER}>All tiers</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="single">Single</option>
                  </select>
                </label>

                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Review status</span>
                  <select
                    className="admin-intelligence__select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value={ALL_FILTER}>All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="not_duplicate">Not duplicate</option>
                    <option value="excluded">Excluded</option>
                  </select>
                </label>

                <label className="admin-intelligence__field">
                  <span className="admin-intelligence__label">Variant type</span>
                  <select
                    className="admin-intelligence__select"
                    value={variantTypeFilter}
                    onChange={(event) => setVariantTypeFilter(event.target.value)}
                  >
                    <option value={ALL_FILTER}>All variant types</option>
                    <option value="console">Console</option>
                    <option value="base">Base</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="admin-core-products__checkbox">
                  <input
                    type="checkbox"
                    checked={highConfidenceOnly}
                    onChange={(event) => setHighConfidenceOnly(event.target.checked)}
                  />
                  High-confidence duplicate groups only
                </label>
              </div>

              <div className="admin-core-products__bulk-actions">
                <span className="admin-core-products__selection-count">
                  {selectedGroupKeys.size} selected
                </span>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--primary"
                  disabled={bulkLoading || selectedApprovableGroups.length === 0}
                  onClick={handleBulkApproveSelectedGroups}
                >
                  Approve selected groups ({selectedApprovableGroups.length})
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  disabled={bulkLoading || selectedGroupKeys.size === 0}
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <EmptyState compact>No core product groups match the current filters.</EmptyState>
            ) : (
              <div className="admin-intelligence__table-wrap">
                <table className="admin-intelligence__table admin-core-products__groups-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all filtered groups"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                        />
                      </th>
                      <th>Core product</th>
                      <th>Family</th>
                      <th>Variants</th>
                      <th>Tier</th>
                      <th>Why grouped?</th>
                      <th>Representative</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th>Dedupe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => {
                      const representative = group.members.find(
                        (member) => member.id === (
                          group.suggested_representative_equipment_id
                          ?? group.representative_equipment_id
                        ),
                      ) ?? group.members[0]

                      return (
                        <tr
                          key={group.core_product_key}
                          className="admin-core-products__row-clickable"
                          onClick={() => setSelectedGroupKey(group.core_product_key)}
                        >
                          <td onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${group.core_product_name}`}
                              checked={selectedGroupKeys.has(group.core_product_key)}
                              onChange={() => toggleSelectGroup(group.core_product_key)}
                            />
                          </td>
                          <td>
                            <strong>{group.core_product_name}</strong>
                            <div className="admin-core-products__subtle">{group.core_product_key}</div>
                          </td>
                          <td>{group.product_family ?? '—'}</td>
                          <td>
                            {group.member_count}
                            <div className="admin-core-products__subtle">
                              {group.members
                                .map((member) => member.variant_name ?? member.suggested?.variant_name)
                                .filter(Boolean)
                                .join(', ') || 'Base only'}
                            </div>
                          </td>
                          <td>{group.grouping_tier ?? 'single'}</td>
                          <td className="admin-core-products__explanation-cell">
                            {group.grouping_explanation}
                          </td>
                          <td>{representative?.model ?? '—'}</td>
                          <td>{group.avg_confidence}%</td>
                          <td>{group.group_status}</td>
                          <td>{group.research_dedupe_eligible ? 'Yes' : 'No'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {selectedGroup ? (
        <CoreProductGroupModal
          group={selectedGroup}
          onClose={() => setSelectedGroupKey(null)}
          onSaved={loadData}
        />
      ) : null}

      {selectedCluster ? (
        <PossibleRelatedClusterModal
          cluster={selectedCluster}
          rows={rows}
          onClose={() => setSelectedClusterKey(null)}
          onSaved={loadData}
        />
      ) : null}
    </div>
  )
}
