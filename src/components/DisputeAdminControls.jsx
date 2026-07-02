import { useState } from 'react'
import {
  ADMIN_DISPUTE_DECISIONS,
  adminApplyDisputeDecision,
  adminMarkDisputeUnderReview,
  canAdminManageDispute,
  formatDisputeStatus,
  getAdminInvestigationDecisionOptions,
  getAdminResolutionDecisionOptions,
  getDisputeErrorMessage,
} from '../lib/orderDisputes'
import { getDefaultAdminDecisionCustomerMessage } from '../lib/adminDecisionMessages'
import {
  adminAuthoriseCaseReturn,
  adminIssueRefundWithoutReturn,
  canAdminIssueRefundAfterCollection,
} from '../lib/caseReturn'
import {
  canCloseCase,
  canMarkRefundCompleted,
  isAdminCaseWorkflowComplete,
  isCaseClosed,
} from '../lib/caseClosure'
import {
  adminApplySupportDecision,
  canAdminManageSupportRequest,
  formatSupportRequestStatus,
  getSupportRequestErrorMessage,
  isSupportRequestActive,
} from '../lib/supportRequests'
import { CaseCloseAction, CaseClosedSummary, CaseRefundCompletedAction } from './CaseClosureControls'
import CaseReturnWorkflow, { CaseReturnAdminRefundAction } from './CaseReturnWorkflow'
import IssueEvidenceList from './IssueEvidenceList'
import './OrderDisputeSection.css'

function getInitialCustomerMessage(dispute, supportRequest) {
  const savedMessage = dispute?.customer_message ?? supportRequest?.resolution_notes ?? ''
  if (savedMessage.trim()) return savedMessage

  return getDefaultAdminDecisionCustomerMessage(ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE)
}

function getInitialDecision(options, preferredValue) {
  if (options.some((option) => option.value === preferredValue)) {
    return preferredValue
  }

  return options[0]?.value ?? preferredValue
}

function AdminWorkflowSummary({ showFinanceStep }) {
  return (
    <section className="order-dispute__admin-section" aria-labelledby="admin-workflow-summary-title">
      <h4 id="admin-workflow-summary-title" className="order-dispute__admin-section-title">
        Workflow progress
      </h4>
      <ul className="order-dispute__admin-summary">
        <li className="order-dispute__admin-summary-item order-dispute__admin-summary-item--complete">
          Investigation complete
        </li>
        <li className="order-dispute__admin-summary-item order-dispute__admin-summary-item--complete">
          Resolution complete
        </li>
        {showFinanceStep ? (
          <li className="order-dispute__admin-summary-item order-dispute__admin-summary-item--complete">
            Finance complete
          </li>
        ) : null}
      </ul>
    </section>
  )
}

function AdminNoteField({ adminNote, submitting, onChange }) {
  return (
    <label className="order-dispute__admin-field">
      <span className="order-dispute__label">Admin note (internal)</span>
      <textarea
        value={adminNote}
        disabled={submitting}
        rows={3}
        placeholder="Internal note for Equipd staff."
        onChange={onChange}
      />
    </label>
  )
}

function DisputeAdminControls({
  dispute,
  supportRequest,
  order = null,
  caseUpdates = [],
  returnLogistics = [],
  userId,
  showReturnWorkflow = false,
  onDisputeUpdated,
  onSupportUpdated,
  onReturnUpdated,
}) {
  const closureContext = { order, caseUpdates }
  const managingDispute = Boolean(
    dispute &&
      (canAdminManageDispute(dispute) ||
        canCloseCase(dispute, closureContext) ||
        canMarkRefundCompleted(dispute, closureContext) ||
        isCaseClosed(dispute, closureContext)),
  )
  const managingSupport = !managingDispute && Boolean(
    supportRequest &&
      (canAdminManageSupportRequest(supportRequest) ||
        canCloseCase(supportRequest, closureContext) ||
        canMarkRefundCompleted(supportRequest, closureContext) ||
        isCaseClosed(supportRequest, closureContext)),
  )
  const activeRecord = managingDispute ? dispute : supportRequest
  const recordClosed = isCaseClosed(activeRecord, closureContext)
  const canManage =
    (managingDispute && canAdminManageDispute(dispute) && !recordClosed) ||
    (managingSupport && canAdminManageSupportRequest(supportRequest) && !recordClosed)

  const investigationOptions = managingDispute
    ? getAdminInvestigationDecisionOptions(dispute)
    : getAdminInvestigationDecisionOptions(null, supportRequest)
  const resolutionOptions = managingDispute
    ? getAdminResolutionDecisionOptions(dispute)
    : getAdminResolutionDecisionOptions(null, supportRequest)

  const [investigationDecision, setInvestigationDecision] = useState(() =>
    getInitialDecision(investigationOptions, ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE),
  )
  const [resolutionDecision, setResolutionDecision] = useState(() =>
    getInitialDecision(
      resolutionOptions,
      managingDispute
        ? ADMIN_DISPUTE_DECISIONS.AUTHORISE_RETURN
        : ADMIN_DISPUTE_DECISIONS.APPROVE_FULL_REFUND,
    ),
  )
  const [evidenceParty, setEvidenceParty] = useState('buyer')
  const [adminNote, setAdminNote] = useState(dispute?.admin_note ?? supportRequest?.admin_notes ?? '')
  const [customerMessage, setCustomerMessage] = useState(() =>
    getInitialCustomerMessage(dispute, supportRequest),
  )
  const [refundAmountPounds, setRefundAmountPounds] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const showIssueRefundAction =
    managingDispute && !recordClosed && canAdminIssueRefundAfterCollection(dispute)
  const showMarkRefundCompleted = Boolean(
    activeRecord && !recordClosed && canMarkRefundCompleted(activeRecord, closureContext),
  )
  const showCloseCase = Boolean(
    activeRecord && !recordClosed && canCloseCase(activeRecord, closureContext),
  )
  const showDecisionForm =
    !recordClosed &&
    !showIssueRefundAction &&
    !showMarkRefundCompleted &&
    ((managingDispute && canAdminManageDispute(dispute)) ||
      (managingSupport && isSupportRequestActive(supportRequest)))
  const showWorkflowSummary = Boolean(
    activeRecord && isAdminCaseWorkflowComplete(activeRecord) && showCloseCase,
  )
  const showInvestigationSection =
    showDecisionForm && !showWorkflowSummary && investigationOptions.length > 0
  const showResolutionSection =
    showDecisionForm && !showWorkflowSummary && resolutionOptions.length > 0
  const showFinanceSection = !showWorkflowSummary && showIssueRefundAction
  const showRefundCompletionSection = showMarkRefundCompleted

  if (import.meta.env.DEV) {
    console.debug('[DisputeAdminControls] refund completion visibility', {
      disputeStatus: dispute?.status,
      supportStatus: supportRequest?.status,
      orderFulfilment: order?.fulfilment_status,
      orderProtection: order?.protection_status,
      orderPayout: order?.payout_status,
      caseOutcome: activeRecord?.case_outcome,
      recordClosed,
      showMarkRefundCompleted,
      canMarkRefund: activeRecord
        ? canMarkRefundCompleted(activeRecord, closureContext)
        : false,
    })
  }

  const statusLabel = managingDispute
    ? formatDisputeStatus(dispute.status)
    : supportRequest
      ? formatSupportRequestStatus(supportRequest.status)
      : '—'

  const evidencePaths = managingDispute
    ? dispute?.evidence_paths
    : supportRequest?.evidence_paths

  if (!activeRecord && !showCloseCase) return null
  if (!managingDispute && !managingSupport && !showCloseCase) return null

  if (recordClosed) {
    return (
      <div className="order-dispute__admin">
        <h3 className="order-dispute__admin-title">Case management</h3>
        <section
          className="order-dispute__admin-section order-dispute__admin-section--closed"
          aria-labelledby="admin-closed-summary-title"
        >
          <h4 id="admin-closed-summary-title" className="order-dispute__admin-section-title">
            Case closure
          </h4>
          <CaseClosedSummary
            record={activeRecord}
            isDispute={managingDispute}
            showAdminNote
          />
        </section>

        <IssueEvidenceList paths={evidencePaths} title="Buyer evidence" />

        {managingDispute && dispute?.seller_response_evidence_paths?.length ? (
          <IssueEvidenceList
            paths={dispute.seller_response_evidence_paths}
            title="Seller evidence"
          />
        ) : null}
      </div>
    )
  }

  if (!activeRecord && !showCloseCase) return null
  if (!managingDispute && !managingSupport && !showCloseCase) return null

  function handleInvestigationDecisionChange(nextDecision) {
    setInvestigationDecision(nextDecision)
    if (nextDecision !== ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW) {
      setCustomerMessage(getDefaultAdminDecisionCustomerMessage(nextDecision))
    }
  }

  function handleResolutionDecisionChange(nextDecision) {
    setResolutionDecision(nextDecision)
    setCustomerMessage(getDefaultAdminDecisionCustomerMessage(nextDecision))
  }

  async function applyDecision(decision) {
    setSubmitting(true)
    setError('')
    setSuccess('')

    const refundAmountPence =
      decision === ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND
        ? Math.round(Number.parseFloat(refundAmountPounds) * 100)
        : null

    if (
      decision === ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND &&
      (!refundAmountPence || Number.isNaN(refundAmountPence) || refundAmountPence <= 0)
    ) {
      setSubmitting(false)
      setError('Enter a valid agreed refund amount in pounds.')
      return
    }

    let result

    if (managingDispute) {
      if (decision === ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW) {
        result = await adminMarkDisputeUnderReview(dispute.id, adminNote)
      } else if (decision === ADMIN_DISPUTE_DECISIONS.AUTHORISE_RETURN) {
        result = await adminAuthoriseCaseReturn({
          disputeId: dispute.id,
          adminNote,
          customerMessage,
        })
      } else if (decision === ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_WITHOUT_RETURN) {
        result = await adminIssueRefundWithoutReturn({
          disputeId: dispute.id,
          adminNote,
          customerMessage,
        })
      } else {
        result = await adminApplyDisputeDecision({
          disputeId: dispute.id,
          decision,
          adminNote,
          customerMessage,
          refundAmountPence,
          evidenceParty,
        })
      }
    } else {
      result = await adminApplySupportDecision({
        requestId: supportRequest.id,
        decision,
        adminNote,
        customerMessage,
        refundAmountPence,
        evidenceParty,
      })
    }

    setSubmitting(false)

    if (result?.error) {
      setError(
        managingDispute
          ? getDisputeErrorMessage(result.error)
          : getSupportRequestErrorMessage(result.error),
      )
      return
    }

    setSuccess('Decision saved.')
    if (managingDispute) {
      onDisputeUpdated?.(result.data)
      onReturnUpdated?.()
    } else {
      onSupportUpdated?.(result.data)
    }
  }

  async function handleInvestigationSubmit(event) {
    event.preventDefault()
    if (!showInvestigationSection || submitting) return
    await applyDecision(investigationDecision)
  }

  async function handleResolutionSubmit(event) {
    event.preventDefault()
    if (!showResolutionSection || submitting) return
    await applyDecision(resolutionDecision)
  }

  function renderEvidencePartyField(decision) {
    if (decision !== ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE) return null

    return (
      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Request evidence from</span>
        <select
          value={evidenceParty}
          disabled={submitting}
          onChange={(event) => setEvidenceParty(event.target.value)}
        >
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
      </label>
    )
  }

  function renderPartialRefundField(decision) {
    if (decision !== ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND) return null

    return (
      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Agreed refund amount (£)</span>
        <span className="order-dispute__admin-hint">
          Enter the partial refund amount agreed between the buyer and seller through Equipd support.
        </span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={refundAmountPounds}
          disabled={submitting}
          onChange={(event) => setRefundAmountPounds(event.target.value)}
          required
        />
      </label>
    )
  }

  function renderCustomerMessageField(decision, required = true) {
    if (decision === ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW) return null

    return (
      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Message to buyer &amp; seller</span>
        <span className="order-dispute__admin-hint">
          This message will appear on the order page and may be included in notifications or emails
          sent to the buyer and seller.
        </span>
        <textarea
          value={customerMessage}
          disabled={submitting}
          rows={3}
          required={required}
          placeholder="Explain the decision or next steps for the buyer and seller."
          onChange={(event) => setCustomerMessage(event.target.value)}
        />
      </label>
    )
  }

  return (
    <div className="order-dispute__admin">
      <h3 className="order-dispute__admin-title">Case management</h3>
      <p className="order-dispute__admin-lead">
        Manual review only — refunds are processed outside the platform for now.
      </p>

      <section className="order-dispute__admin-panel-section" aria-labelledby="admin-case-info-title">
        <h4 id="admin-case-info-title" className="order-dispute__admin-section-title">
          Case information
        </h4>

        <dl className="order-dispute__meta">
          <div className="order-dispute__row">
            <dt className="order-dispute__label">Status</dt>
            <dd className="order-dispute__value">{statusLabel}</dd>
          </div>
          {managingDispute && dispute?.description ? (
            <div className="order-dispute__row order-dispute__row--description">
              <dt className="order-dispute__label">Description</dt>
              <dd className="order-dispute__value">{dispute.description}</dd>
            </div>
          ) : null}
          {managingSupport && supportRequest?.message ? (
            <div className="order-dispute__row order-dispute__row--description">
              <dt className="order-dispute__label">Message</dt>
              <dd className="order-dispute__value">{supportRequest.message}</dd>
            </div>
          ) : null}
        </dl>

        <IssueEvidenceList paths={evidencePaths} title="Buyer evidence" />

        {managingDispute && dispute?.seller_response_evidence_paths?.length ? (
          <IssueEvidenceList
            paths={dispute.seller_response_evidence_paths}
            title="Seller evidence"
          />
        ) : null}
      </section>

      {showReturnWorkflow && managingDispute && !recordClosed ? (
        <CaseReturnWorkflow
          dispute={dispute}
          returnLogistics={returnLogistics}
          userId={userId}
          isAdminViewer
          embedded
          onUpdated={onReturnUpdated}
        />
      ) : null}

      {recordClosed ? (
        <section
          className="order-dispute__admin-section order-dispute__admin-section--closed"
          aria-labelledby="admin-closed-summary-title"
        >
          <h4 id="admin-closed-summary-title" className="order-dispute__admin-section-title">
            Case closure
          </h4>
          <CaseClosedSummary
            record={activeRecord}
            isDispute={managingDispute}
            showAdminNote
          />
        </section>
      ) : null}

      {showWorkflowSummary ? (
        <AdminWorkflowSummary showFinanceStep={false} />
      ) : null}

      {showInvestigationSection ? (
        <section className="order-dispute__admin-section" aria-labelledby="admin-investigation-title">
          <h4 id="admin-investigation-title" className="order-dispute__admin-section-title">
            Investigation
          </h4>

          <form className="order-dispute__admin-form" onSubmit={handleInvestigationSubmit}>
            <AdminNoteField
              adminNote={adminNote}
              submitting={submitting}
              onChange={(event) => setAdminNote(event.target.value)}
            />

            <label className="order-dispute__admin-field">
              <span className="order-dispute__label">Investigation action</span>
              <select
                value={investigationDecision}
                disabled={submitting}
                onChange={(event) => handleInvestigationDecisionChange(event.target.value)}
              >
                {investigationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {renderEvidencePartyField(investigationDecision)}
            {renderCustomerMessageField(investigationDecision)}

            <div className="order-dispute__admin-actions">
              <button
                type="submit"
                className="listing-detail__button listing-detail__button--primary"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Apply investigation update'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {showResolutionSection ? (
        <section className="order-dispute__admin-section" aria-labelledby="admin-resolution-title">
          <h4 id="admin-resolution-title" className="order-dispute__admin-section-title">
            Resolution
          </h4>

          <form className="order-dispute__admin-form" onSubmit={handleResolutionSubmit}>
            {!showInvestigationSection ? (
              <AdminNoteField
                adminNote={adminNote}
                submitting={submitting}
                onChange={(event) => setAdminNote(event.target.value)}
              />
            ) : null}

            <label className="order-dispute__admin-field">
              <span className="order-dispute__label">Resolution action</span>
              <select
                value={resolutionDecision}
                disabled={submitting}
                onChange={(event) => handleResolutionDecisionChange(event.target.value)}
              >
                {resolutionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {renderPartialRefundField(resolutionDecision)}
            {renderCustomerMessageField(resolutionDecision)}

            <div className="order-dispute__admin-actions">
              <button
                type="submit"
                className="listing-detail__button listing-detail__button--primary"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Apply resolution'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {showRefundCompletionSection ? (
        <section
          className="order-dispute__admin-section order-dispute__admin-section--refund-complete"
          aria-labelledby="admin-refund-complete-title"
        >
          <h4 id="admin-refund-complete-title" className="order-dispute__admin-section-title">
            Complete refund
          </h4>
          <p className="order-case-return__lead" role="status">
            Refund is pending. Once the bank or payment processor confirms the refund, mark it
            completed here to close the case and notify the buyer and seller.
          </p>

          {!showInvestigationSection && !showResolutionSection ? (
            <AdminNoteField
              adminNote={adminNote}
              submitting={submitting}
              onChange={(event) => setAdminNote(event.target.value)}
            />
          ) : null}

          <CaseRefundCompletedAction
            record={activeRecord}
            isDispute={managingDispute}
            adminNote={adminNote}
            order={order}
            caseUpdates={caseUpdates}
            onUpdated={(updated) => {
              if (managingDispute) {
                onDisputeUpdated?.(updated)
                onReturnUpdated?.()
              } else {
                onSupportUpdated?.(updated)
              }
            }}
          />
        </section>
      ) : null}

      {showFinanceSection ? (
        <section className="order-dispute__admin-section" aria-labelledby="admin-finance-title">
          <h4 id="admin-finance-title" className="order-dispute__admin-section-title">
            Finance
          </h4>

          {!showInvestigationSection && !showResolutionSection ? (
            <AdminNoteField
              adminNote={adminNote}
              submitting={submitting}
              onChange={(event) => setAdminNote(event.target.value)}
            />
          ) : null}

          {showIssueRefundAction ? (
            <CaseReturnAdminRefundAction
              dispute={dispute}
              adminNote={adminNote}
              customerMessage={customerMessage}
              onUpdated={(updatedDispute) => {
                onDisputeUpdated?.(updatedDispute)
                onReturnUpdated?.()
              }}
            />
          ) : null}
        </section>
      ) : null}

      {showCloseCase ? (
        <section
          className="order-dispute__admin-section order-dispute__admin-section--close"
          aria-labelledby="admin-close-title"
        >
          <h4 id="admin-close-title" className="order-dispute__admin-section-title">
            Close case
          </h4>
          <CaseCloseAction
            record={activeRecord}
            isDispute={managingDispute}
            adminNote={adminNote}
            showAdminNoteField={showWorkflowSummary}
            onAdminNoteChange={setAdminNote}
            onUpdated={(updated) => {
              if (managingDispute) {
                onDisputeUpdated?.(updated)
                onReturnUpdated?.()
              } else {
                onSupportUpdated?.(updated)
              }
            }}
          />
        </section>
      ) : null}

      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-dispute__admin-success" role="status">
          {success}
        </p>
      ) : null}
    </div>
  )
}

export default DisputeAdminControls
