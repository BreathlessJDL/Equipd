import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ORDER_TYPES } from '../lib/orders'
import {
  buildCollectionCollectUrl,
  generateCollectionQrToken,
  getCollectionQrErrorMessage,
} from '../lib/collectionQr'
import { formatOrderTimestamp } from '../lib/orders'
import './CollectionQrPanel.css'

function CollectionQrPanel({ orderId, compact = false, orderType = ORDER_TYPES.COLLECTION }) {
  const isSellerDelivery = orderType === ORDER_TYPES.SELLER_DELIVERY
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tokenData, setTokenData] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const loadToken = useCallback(async () => {
    if (!orderId) return

    setLoading(true)
    setError('')

    const { data, error: rpcError } = await generateCollectionQrToken(orderId)

    if (rpcError) {
      setError(getCollectionQrErrorMessage(rpcError))
      setTokenData(null)
      setQrDataUrl('')
      setLoading(false)
      return
    }

    setTokenData(data)
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    loadToken()
  }, [loadToken])

  useEffect(() => {
    let active = true

    async function renderQr() {
      if (!tokenData?.token) {
        setQrDataUrl('')
        return
      }

      const collectUrl = buildCollectionCollectUrl(tokenData.token)

      try {
        const dataUrl = await QRCode.toDataURL(collectUrl, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
        })

        if (active) {
          setQrDataUrl(dataUrl)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not render QR code')
        }
      }
    }

    renderQr()

    return () => {
      active = false
    }
  }, [tokenData?.token])

  async function handleCopyLink() {
    if (!tokenData?.token) return

    const collectUrl = buildCollectionCollectUrl(tokenData.token)

    try {
      await navigator.clipboard.writeText(collectUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy link. Please copy it manually below.')
    }
  }

  if (loading) {
    return (
      <div className={`collection-qr-panel${compact ? ' collection-qr-panel--compact' : ''}`}>
        <p className="collection-qr-panel__meta">
          {isSellerDelivery ? 'Preparing handover QR code…' : 'Preparing collection QR code…'}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`collection-qr-panel${compact ? ' collection-qr-panel--compact' : ''}`}>
        <p className="collection-qr-panel__error" role="alert">
          {error}
        </p>
        <button type="button" className="collection-qr-panel__button" onClick={loadToken}>
          Refresh QR code
        </button>
      </div>
    )
  }

  const collectUrl = tokenData?.token ? buildCollectionCollectUrl(tokenData.token) : ''
  const expiresAt = tokenData?.expires_at ? new Date(tokenData.expires_at).getTime() : null
  const isExpired = expiresAt !== null && !Number.isNaN(expiresAt) && expiresAt <= Date.now()

  return (
    <div className={`collection-qr-panel${compact ? ' collection-qr-panel--compact' : ''}`}>
      <h3 className="collection-qr-panel__title">
        {isSellerDelivery ? 'Handover QR code' : 'Collection QR code'}
      </h3>
      <p className="collection-qr-panel__lead">
        {isSellerDelivery
          ? 'Show this QR code to the buyer after you have delivered and unloaded the equipment. The buyer should scan the QR code and log in to confirm handover.'
          : 'Show this QR code to the buyer at collection. The buyer should scan the QR code and log in to confirm collection.'}
      </p>

      {qrDataUrl ? (
        <div className="collection-qr-panel__qr-wrap">
          <img
            src={qrDataUrl}
            alt={isSellerDelivery ? 'Handover confirmation QR code' : 'Collection confirmation QR code'}
            className="collection-qr-panel__qr"
          />
        </div>
      ) : null}

      <div className="collection-qr-panel__actions">
        <button type="button" className="collection-qr-panel__button" onClick={handleCopyLink}>
          {isSellerDelivery ? 'Copy handover link' : 'Copy collection link'}
        </button>
        <button type="button" className="collection-qr-panel__button" onClick={loadToken}>
          Refresh QR code
        </button>
      </div>

      {copied ? <p className="collection-qr-panel__copied">Link copied</p> : null}

      {tokenData?.expires_at ? (
        <p className="collection-qr-panel__meta">
          {isExpired
            ? 'This code has expired. Refresh to generate a new one.'
            : `Code expires ${formatOrderTimestamp(tokenData.expires_at)}`}
        </p>
      ) : null}

      {collectUrl ? (
        <p className="collection-qr-panel__link" aria-label={isSellerDelivery ? 'Handover link' : 'Collection link'}>
          {collectUrl}
        </p>
      ) : null}
    </div>
  )
}

export default CollectionQrPanel
