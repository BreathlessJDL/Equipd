import { useState } from 'react'
import {
  appendOrderDisputeEvidence,
  getDisputeErrorMessage,
} from '../lib/orderDisputes'
import {
  appendSupportRequestEvidence,
  getSupportRequestErrorMessage,
} from '../lib/supportRequests'
import {
  getStorageUploadErrorMessage,
  uploadDisputeEvidenceFile,
  uploadSupportEvidenceFile,
  validateIssueEvidenceFile,
} from '../lib/orderEvidence'
import EvidenceFilePicker from './EvidenceFilePicker'
import './OrderSupportRequest.css'

async function uploadCaseEvidenceFiles({ orderId, caseType, caseId, files, uploaderRole }) {
  const evidencePaths = []

  for (const file of files) {
    const validationError = validateIssueEvidenceFile(file)
    if (validationError) {
      throw new Error(validationError)
    }

    const uploadResult =
      caseType === 'dispute'
        ? await uploadDisputeEvidenceFile(orderId, caseId, file, {
            uploader: uploaderRole === 'seller' ? 'seller' : 'buyer',
          })
        : await uploadSupportEvidenceFile(orderId, caseId, file)

    if (uploadResult.error) {
      throw uploadResult.error
    }

    evidencePaths.push(uploadResult.path)
  }

  return evidencePaths
}

function getAdditionalEvidenceCopy(uploaderRole) {
  if (uploaderRole === 'seller') {
    return {
      title: 'Add seller evidence',
      lead:
        'Upload any photos, videos, documents, courier proof, or messages that help explain your side of the case.',
    }
  }

  return {
    title: 'Add additional evidence',
    lead:
      'Upload any extra photos, videos, PDFs, receipts, courier proof, or screenshots that may help Equipd review this case.',
  }
}

function AddAdditionalEvidenceSection({ orderId, caseType, caseId, uploaderRole, onUploaded }) {
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    if (!orderId || !caseId || submitting || files.length === 0) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const evidencePaths = await uploadCaseEvidenceFiles({
        orderId,
        caseType,
        caseId,
        files,
        uploaderRole,
      })

      const result =
        caseType === 'dispute'
          ? await appendOrderDisputeEvidence(caseId, evidencePaths)
          : await appendSupportRequestEvidence(caseId, evidencePaths)

      if (result.error) {
        throw result.error
      }

      setFiles([])
      setSuccess('Evidence uploaded.')
      onUploaded?.(result.data)
    } catch (uploadError) {
      const message =
        caseType === 'dispute'
          ? getDisputeErrorMessage(uploadError) || getStorageUploadErrorMessage(uploadError)
          : getSupportRequestErrorMessage(uploadError) || getStorageUploadErrorMessage(uploadError)
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const copy = getAdditionalEvidenceCopy(uploaderRole)

  return (
    <form className="order-support__form order-support__form--additional-evidence" onSubmit={handleSubmit}>
      <h3 className="order-support__subtitle">{copy.title}</h3>
      <p className="order-support__lead">{copy.lead}</p>

      <EvidenceFilePicker
        inputId={`additional-evidence-${caseType}-${caseId}`}
        files={files}
        disabled={submitting}
        onChange={setFiles}
        label="Files"
        hint="Images, videos, or PDFs. Up to 8 files. Max 25 MB each."
      />

      <button
        type="submit"
        className="order-support__button"
        disabled={submitting || files.length === 0}
      >
        {submitting ? 'Uploading…' : 'Upload evidence'}
      </button>

      {error ? (
        <p className="order-support__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-support__success" role="status">
          {success}
        </p>
      ) : null}
    </form>
  )
}

export default AddAdditionalEvidenceSection
