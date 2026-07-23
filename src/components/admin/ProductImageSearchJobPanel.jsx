import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildPendingImagesReviewPath,
  canClearCompletedImageSearchJobs,
  canDeleteImageSearchJob,
  computeImageSearchJobProgress,
  IMAGE_SEARCH_JOB_STATUS,
} from '../../lib/equipmentProductImageSearchJobs'

function formatWhen(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return String(value)
  }
}

function JobCard({
  job,
  activeJobId = null,
  working = false,
  variant = 'active',
  onCancel,
  onRetryFailed,
  onRetryNoResult,
  onDelete,
  onRunAgain,
}) {
  const progress = computeImageSearchJobProgress(job)
  const brand = job.filters?.brand || 'Catalogue'
  const isActive = job.id === activeJobId
  const reviewPath = buildPendingImagesReviewPath({
    jobId: job.id,
    brand: job.filters?.brand || '',
    imageFilter: 'pending_review',
  })
  const isHistory = variant === 'completed'
  const deletable = canDeleteImageSearchJob(job)

  return (
    <article
      className={`admin-products__image-search-job${isActive ? ' admin-products__image-search-job--active' : ''}`}
    >
      <header className="admin-products__image-search-job-header">
        <div>
          <strong>{brand} image search</strong>
          <span className="admin-products__image-search-job-status">{job.status}</span>
        </div>
        <span>{progress.percent}%</span>
      </header>

      <p className="admin-intelligence__count">
        {progress.total} products · {progress.completed} complete · {progress.candidatesFound} candidates found ·{' '}
        {progress.noResult} no result · {progress.failed} failed · {progress.remaining} remaining
      </p>

      <div
        className="admin-products__image-search-progress"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>

      <p className="admin-intelligence__count">
        Started {formatWhen(job.started_at || job.created_at)}
        {job.completed_at ? ` · Completed ${formatWhen(job.completed_at)}` : ''}
      </p>

      <div className="admin-intelligence__actions">
        <Link to={reviewPath} className="admin-intelligence__button admin-intelligence__button--primary">
          View pending images
        </Link>

        {isHistory ? (
          <>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={() => onRunAgain?.(job.id)}
              disabled={working}
            >
              Run again
            </button>
            <button
              type="button"
              className="admin-intelligence__button"
              onClick={() => onDelete?.(job)}
              disabled={working || !deletable}
            >
              Delete
            </button>
          </>
        ) : (
          <>
            {job.status === IMAGE_SEARCH_JOB_STATUS.FAILED ? (
              <>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={() => onRunAgain?.(job.id)}
                  disabled={working}
                >
                  Run again
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button"
                  onClick={() => onDelete?.(job)}
                  disabled={working || !deletable}
                >
                  Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={() => onRetryFailed?.(job.id)}
              disabled={working || progress.failed === 0}
            >
              Retry failed
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={() => onRetryNoResult?.(job.id)}
              disabled={working || progress.noResult === 0}
            >
              Retry no-result
            </button>
            {['queued', 'running', 'paused'].includes(job.status) ? (
              <button
                type="button"
                className="admin-intelligence__button"
                onClick={() => onCancel?.(job.id)}
                disabled={working}
              >
                Cancel remaining
              </button>
            ) : null}
          </>
        )}
      </div>
    </article>
  )
}

export default function ProductImageSearchJobPanel({
  activeJobs = [],
  completedJobs = [],
  activeJobId = null,
  working = false,
  onRefresh,
  onCancel,
  onRetryFailed,
  onRetryNoResult,
  onDelete,
  onRunAgain,
  onClearCompleted,
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null)

  const hasAny = activeJobs.length > 0 || completedJobs.length > 0
  if (!hasAny) return null

  const canClearCompleted = canClearCompletedImageSearchJobs(completedJobs)

  return (
    <section className="admin-intelligence__panel admin-products__image-search-jobs" aria-label="Image search jobs">
      <div className="admin-products__image-search-jobs-header">
        <h2 className="admin-intelligence__panel-title">Image search jobs</h2>
        <div className="admin-intelligence__actions" style={{ margin: 0 }}>
          {canClearCompleted ? (
            <button
              type="button"
              className="admin-intelligence__button"
              onClick={() => setConfirmClear(true)}
              disabled={working}
            >
              Clear completed jobs
            </button>
          ) : null}
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onRefresh}
            disabled={working}
          >
            Refresh jobs
          </button>
        </div>
      </div>

      {activeJobs.length > 0 ? (
        <div className="admin-products__image-search-section">
          <h3 className="admin-products__image-search-section-title">Active jobs</h3>
          {activeJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              activeJobId={activeJobId}
              working={working}
              variant="active"
              onCancel={onCancel}
              onRetryFailed={onRetryFailed}
              onRetryNoResult={onRetryNoResult}
              onDelete={setConfirmDeleteJob}
              onRunAgain={onRunAgain}
            />
          ))}
        </div>
      ) : (
        <p className="admin-intelligence__count">No active image search jobs.</p>
      )}

      {completedJobs.length > 0 ? (
        <div className="admin-products__image-search-section">
          <button
            type="button"
            className="admin-products__image-search-history-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? 'Hide job history' : `Recent completed (${completedJobs.length})`}
          </button>

          {historyOpen ? (
            <div className="admin-products__image-search-history">
              <h3 className="admin-products__image-search-section-title">Job history</h3>
              {completedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  activeJobId={activeJobId}
                  working={working}
                  variant="completed"
                  onDelete={setConfirmDeleteJob}
                  onRunAgain={onRunAgain}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {confirmClear ? (
        <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={() => setConfirmClear(false)}>
          <div
            className="admin-intelligence__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-completed-jobs-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-completed-jobs-title" className="admin-intelligence__panel-title">
              Delete all completed image search jobs?
            </h2>
            <p className="admin-intelligence__lead">
              This only removes job history. Images, products and approvals are unaffected.
            </p>
            <div className="admin-intelligence__actions">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={() => setConfirmClear(false)}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={async () => {
                  await onClearCompleted?.()
                  setConfirmClear(false)
                }}
                disabled={working}
              >
                {working ? 'Clearing…' : 'Clear completed jobs'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteJob ? (
        <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={() => setConfirmDeleteJob(null)}>
          <div
            className="admin-intelligence__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-job-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-job-title" className="admin-intelligence__panel-title">
              Delete this image search job?
            </h2>
            <p className="admin-intelligence__lead">
              Only the job history record is removed. Image candidates, products, and approved images stay.
            </p>
            <div className="admin-intelligence__actions">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={() => setConfirmDeleteJob(null)}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={async () => {
                  await onDelete?.(confirmDeleteJob.id)
                  setConfirmDeleteJob(null)
                }}
                disabled={working}
              >
                {working ? 'Deleting…' : 'Delete job'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
