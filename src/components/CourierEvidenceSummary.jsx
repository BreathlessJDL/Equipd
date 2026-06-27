import { useEffect, useState } from 'react'
import { getOrderEvidenceSignedUrl } from '../lib/orderEvidence'
import { formatOrderTimestamp } from '../lib/orders'
import './CourierEvidence.css'

function EvidenceMedia({ label, storagePath }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const isVideo = storagePath?.includes('/video/')

  useEffect(() => {
    let active = true

    async function loadUrl() {
      if (!storagePath) return

      const { url: signedUrl, error: urlError } = await getOrderEvidenceSignedUrl(storagePath)

      if (!active) return

      if (urlError) {
        setError('Could not load file preview.')
        return
      }

      setUrl(signedUrl)
    }

    loadUrl()

    return () => {
      active = false
    }
  }, [storagePath])

  if (!storagePath) return null

  return (
    <div className="courier-evidence-summary__media">
      <p className="courier-evidence-summary__meta">{label}</p>
      {error ? <p className="courier-evidence-summary__error">{error}</p> : null}
      {url && isVideo ? (
        <video src={url} controls playsInline preload="metadata" />
      ) : null}
      {url && !isVideo ? <img src={url} alt={label} /> : null}
    </div>
  )
}

function CourierEvidenceSummary({ order, role = 'buyer' }) {
  if (!order) return null

  const courierLabel = [order.courier_company, order.courier_name].filter(Boolean).join(' · ')
  const buyerTracking = order.courier_buyer_tracking_reference?.trim()
  const isDelivered = Boolean(order.courier_delivered_at || order.delivered_at)

  return (
    <section className="courier-evidence-summary">
      <h3 className="courier-evidence-summary__title">Courier handover</h3>

      {role === 'buyer' ? (
        <p className="courier-evidence-summary__status">Collected by courier</p>
      ) : (
        <p className="courier-evidence-summary__status">In transit — evidence submitted</p>
      )}

      {courierLabel ? (
        <p className="courier-evidence-summary__meta">
          Courier: {courierLabel}
        </p>
      ) : null}

      {order.courier_collected_at ? (
        <p className="courier-evidence-summary__meta">
          Dispatched {formatOrderTimestamp(order.courier_collected_at)}
        </p>
      ) : null}

      {order.courier_evidence_notes ? (
        <p className="courier-evidence-summary__meta">Seller notes: {order.courier_evidence_notes}</p>
      ) : null}

      {isDelivered ? (
        <p className="courier-evidence-summary__meta">
          {buyerTracking
            ? `Tracking number: ${buyerTracking}`
            : 'No tracking number provided'}
        </p>
      ) : null}

      {order.courier_signature_name ? (
        <p className="courier-evidence-summary__meta">
          Signed by {order.courier_signature_name}
          {order.courier_signed_at ? ` · ${formatOrderTimestamp(order.courier_signed_at)}` : ''}
        </p>
      ) : null}

      <div className="courier-evidence-summary__grid">
        <EvidenceMedia label="Condition video" storagePath={order.courier_evidence_video_url} />
        <EvidenceMedia
          label="Before collection photo"
          storagePath={order.courier_pre_collection_photo_url}
        />
        <EvidenceMedia
          label="Handover / loading photo"
          storagePath={order.courier_handover_photo_url}
        />
      </div>

      {order.courier_signature_data ? (
        <div className="courier-evidence-summary__media">
          <p className="courier-evidence-summary__meta">Courier signature</p>
          <img
            src={order.courier_signature_data}
            alt="Courier signature"
            className="courier-evidence-summary__signature"
          />
        </div>
      ) : null}

      {role === 'buyer' ? (
        <p className="courier-evidence-summary__meta">
          Payout remains on hold until the buyer protection workflow completes.
        </p>
      ) : null}
    </section>
  )
}

export default CourierEvidenceSummary
