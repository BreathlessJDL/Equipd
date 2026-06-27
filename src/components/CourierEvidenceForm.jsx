import { useState } from 'react'
import SignaturePad from './SignaturePad'
import {
  buildCourierEvidencePayload,
  getCourierEvidenceErrorMessage,
  submitCourierHandoverEvidence,
  uploadOrderEvidenceFile,
  validateEvidenceImageFile,
  validateEvidenceVideoFile,
} from '../lib/orderEvidence'
import './CourierEvidence.css'

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function CourierEvidenceForm({ orderId, onSubmitted }) {
  const [videoFile, setVideoFile] = useState(null)
  const [prePhotoFile, setPrePhotoFile] = useState(null)
  const [handoverPhotoFile, setHandoverPhotoFile] = useState(null)
  const [courierName, setCourierName] = useState('')
  const [courierCompany, setCourierCompany] = useState('')
  const [dispatchDate, setDispatchDate] = useState(todayDateInputValue)
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [signatureData, setSignatureData] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!orderId || submitting) return

    setError('')

    const videoValidation = videoFile ? validateEvidenceVideoFile(videoFile) : 'Condition video is required.'
    if (videoValidation) {
      setError(videoValidation)
      return
    }

    const preValidation = prePhotoFile
      ? validateEvidenceImageFile(prePhotoFile)
      : 'Pre-collection photo is required.'
    if (preValidation) {
      setError(preValidation)
      return
    }

    const handoverValidation = handoverPhotoFile
      ? validateEvidenceImageFile(handoverPhotoFile)
      : 'Handover/loading photo is required.'
    if (handoverValidation) {
      setError(handoverValidation)
      return
    }

    if (!courierName.trim() && !courierCompany.trim()) {
      setError('Enter a courier name or courier company.')
      return
    }

    if (!dispatchDate) {
      setError('Collection/dispatch date is required.')
      return
    }

    if (!signatureName.trim()) {
      setError('Courier signed name is required.')
      return
    }

    if (!signatureData) {
      setError('Courier signature is required.')
      return
    }

    setSubmitting(true)

    const uploads = [
      { file: videoFile, kind: 'video' },
      { file: prePhotoFile, kind: 'photos/pre-collection' },
      { file: handoverPhotoFile, kind: 'photos/handover' },
    ]

    const uploadedPaths = {}

    for (const upload of uploads) {
      const { path, error: uploadError } = await uploadOrderEvidenceFile(
        orderId,
        upload.kind,
        upload.file,
      )

      if (uploadError) {
        setSubmitting(false)
        setError(getCourierEvidenceErrorMessage(uploadError))
        return
      }

      uploadedPaths[upload.kind] = path
    }

    const payload = buildCourierEvidencePayload({
      videoPath: uploadedPaths.video,
      preCollectionPhotoPath: uploadedPaths['photos/pre-collection'],
      handoverPhotoPath: uploadedPaths['photos/handover'],
      courierName,
      courierCompany,
      dispatchDate,
      evidenceNotes,
      signatureName,
      signatureData,
    })

    const { data, error: submitError } = await submitCourierHandoverEvidence(orderId, payload)

    setSubmitting(false)

    if (submitError) {
      setError(getCourierEvidenceErrorMessage(submitError))
      return
    }

    setSuccess(true)
    onSubmitted?.(data)
  }

  if (success) {
    return (
      <div className="courier-evidence-form">
        <p className="courier-evidence-form__success" role="status">
          Courier handover evidence submitted. The order is now in transit.
        </p>
      </div>
    )
  }

  return (
    <form className="courier-evidence-form" onSubmit={handleSubmit}>
      <h3 className="courier-evidence-form__title">Courier handover evidence</h3>
      <p className="courier-evidence-form__lead">
        Submit evidence before the buyer&apos;s courier collects the item. The order will move to
        in transit once submitted.
      </p>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-video-${orderId}`}>
          Short condition video
        </label>
        <input
          id={`courier-video-${orderId}`}
          className="courier-evidence-form__file"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={submitting}
          onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
        />
        <p className="courier-evidence-form__hint">MP4, WebM, or MOV up to 50 MB.</p>
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-pre-${orderId}`}>
          Machine before collection photo
        </label>
        <input
          id={`courier-pre-${orderId}`}
          className="courier-evidence-form__file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={submitting}
          onChange={(event) => setPrePhotoFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-handover-${orderId}`}>
          Handover / loading photo
        </label>
        <input
          id={`courier-handover-${orderId}`}
          className="courier-evidence-form__file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={submitting}
          onChange={(event) => setHandoverPhotoFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-company-${orderId}`}>
          Courier company
        </label>
        <input
          id={`courier-company-${orderId}`}
          className="courier-evidence-form__input"
          type="text"
          value={courierCompany}
          disabled={submitting}
          onChange={(event) => setCourierCompany(event.target.value)}
        />
        <p className="courier-evidence-form__hint">Provide a courier company or courier name (or both).</p>
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-name-${orderId}`}>
          Courier name
        </label>
        <input
          id={`courier-name-${orderId}`}
          className="courier-evidence-form__input"
          type="text"
          value={courierName}
          disabled={submitting}
          onChange={(event) => setCourierName(event.target.value)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-dispatch-${orderId}`}>
          Collection / dispatch date
        </label>
        <input
          id={`courier-dispatch-${orderId}`}
          className="courier-evidence-form__input"
          type="date"
          value={dispatchDate}
          disabled={submitting}
          onChange={(event) => setDispatchDate(event.target.value)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-notes-${orderId}`}>
          Notes <span className="courier-evidence-form__optional">(optional)</span>
        </label>
        <textarea
          id={`courier-notes-${orderId}`}
          className="courier-evidence-form__textarea"
          rows={3}
          maxLength={500}
          value={evidenceNotes}
          disabled={submitting}
          onChange={(event) => setEvidenceNotes(event.target.value)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <label className="courier-evidence-form__label" htmlFor={`courier-signed-name-${orderId}`}>
          Courier signed name
        </label>
        <input
          id={`courier-signed-name-${orderId}`}
          className="courier-evidence-form__input"
          type="text"
          value={signatureName}
          disabled={submitting}
          onChange={(event) => setSignatureName(event.target.value)}
        />
      </div>

      <div className="courier-evidence-form__field">
        <span className="courier-evidence-form__label">Courier signature</span>
        <SignaturePad value={signatureData} disabled={submitting} onChange={setSignatureData} />
      </div>

      <button type="submit" className="courier-evidence-form__button" disabled={submitting}>
        {submitting ? 'Submitting evidence…' : 'Submit courier handover evidence'}
      </button>

      {error ? (
        <p className="courier-evidence-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export default CourierEvidenceForm
