import { useEffect, useRef, useState } from 'react'
import {
  getEvidenceFileTypeLabel,
  getEvidencePreviewRenderMode,
  MIN_EVIDENCE_THUMBNAIL_DIMENSION,
  loadOrderEvidencePreviewEntries,
  normalizeEvidenceStoragePath,
  revokeOrderEvidencePreviewUrls,
} from '../lib/orderEvidence'
import './OrderDisputeSection.css'

function EvidenceFileTile({ openUrl, label, kind, subtitle }) {
  return (
    <a
      href={openUrl}
      target="_blank"
      rel="noreferrer"
      className="order-dispute__evidence-file"
      title={label}
    >
      <span className="order-dispute__evidence-file-type">{getEvidenceFileTypeLabel(kind)}</span>
      <span className="order-dispute__evidence-file-name">{label}</span>
      {subtitle ? <span className="order-dispute__evidence-file-subtitle">{subtitle}</span> : null}
    </a>
  )
}

function EvidencePreviewItem({ entry, loading }) {
  const [signedImageFailed, setSignedImageFailed] = useState(false)
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false)

  useEffect(() => {
    setSignedImageFailed(false)
    setPreviewLoadFailed(false)
  }, [entry?.path, entry?.previewUrl, entry?.openUrl, entry?.thumbnailViable])

  if (loading) {
    return <span className="order-dispute__evidence-loading">Loading…</span>
  }

  const { path, kind, label, openUrl, previewUrl, thumbnailViable = true, imageAnalysis } = entry ?? {}
  const renderMode = getEvidencePreviewRenderMode(path, {
    hasPreviewUrl: Boolean(previewUrl),
    hasOpenUrl: Boolean(openUrl),
    signedImageFailed,
    thumbnailViable,
    previewLoadFailed,
  })

  const fallbackSubtitle =
    imageAnalysis?.reason === 'file_too_small' || imageAnalysis?.reason === 'image_too_small'
      ? 'Preview unavailable'
      : previewLoadFailed || signedImageFailed
        ? 'Preview failed'
        : null

  if (renderMode === 'unavailable') {
    return <span className="order-dispute__evidence-missing">{label || 'File'} unavailable</span>
  }

  if (renderMode === 'image-thumbnail') {
    return (
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="order-dispute__evidence-thumb-link"
        title={label}
      >
        <img
          src={previewUrl}
          alt=""
          className="order-dispute__evidence-thumb"
          decoding="async"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (
              !naturalWidth ||
              !naturalHeight ||
              naturalWidth < MIN_EVIDENCE_THUMBNAIL_DIMENSION ||
              naturalHeight < MIN_EVIDENCE_THUMBNAIL_DIMENSION
            ) {
              setPreviewLoadFailed(true)
            }
          }}
          onError={() => setPreviewLoadFailed(true)}
        />
      </a>
    )
  }

  if (renderMode === 'image-signed-url') {
    return (
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="order-dispute__evidence-thumb-link"
        title={label}
      >
        <img
          src={openUrl}
          alt=""
          className="order-dispute__evidence-thumb"
          decoding="async"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (
              !naturalWidth ||
              !naturalHeight ||
              naturalWidth < MIN_EVIDENCE_THUMBNAIL_DIMENSION ||
              naturalHeight < MIN_EVIDENCE_THUMBNAIL_DIMENSION
            ) {
              setSignedImageFailed(true)
            }
          }}
          onError={() => setSignedImageFailed(true)}
        />
      </a>
    )
  }

  return (
    <EvidenceFileTile
      openUrl={openUrl}
      label={label}
      kind={kind}
      subtitle={fallbackSubtitle}
    />
  )
}

function IssueEvidenceList({ paths, title = 'Evidence', emptyHint = null, alwaysShow = false }) {
  const [entriesByPath, setEntriesByPath] = useState({})
  const [loading, setLoading] = useState(true)
  const entriesRef = useRef(entriesByPath)
  entriesRef.current = entriesByPath

  const normalizedPaths = [
    ...new Set(
      (paths ?? [])
        .map((path) => normalizeEvidenceStoragePath(path))
        .filter(Boolean),
    ),
  ]

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const entries = await loadOrderEvidencePreviewEntries(normalizedPaths)

      if (!active) {
        revokeOrderEvidencePreviewUrls(entries)
        return
      }

      revokeOrderEvidencePreviewUrls(entriesRef.current)
      setEntriesByPath(entries)
      setLoading(false)
    }

    load()

    return () => {
      active = false
      revokeOrderEvidencePreviewUrls(entriesRef.current)
    }
  }, [normalizedPaths.join('|')])

  if (!normalizedPaths.length && !alwaysShow) return null

  return (
    <div className="order-dispute__evidence">
      <h4 className="order-dispute__evidence-title">{title}</h4>
      {!normalizedPaths.length && emptyHint ? (
        <p className="order-dispute__evidence-empty">{emptyHint}</p>
      ) : null}
      {normalizedPaths.length ? (
        <ul className="order-dispute__evidence-list">
          {normalizedPaths.map((path) => (
            <li key={path} className="order-dispute__evidence-item">
              <EvidencePreviewItem entry={entriesByPath[path]} loading={loading} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default IssueEvidenceList
