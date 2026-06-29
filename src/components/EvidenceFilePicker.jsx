import { MAX_ISSUE_EVIDENCE_FILES } from '../lib/orderEvidence'
import './OrderSupportRequest.css'

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function EvidenceFilePicker({
  files,
  onChange,
  disabled,
  inputId,
  label = 'Evidence files',
  hint = `Up to ${MAX_ISSUE_EVIDENCE_FILES} files. Images, videos, or PDFs. Max 25 MB each.`,
}) {
  function handleChange(event) {
    const selected = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!selected.length) return
    onChange([...files, ...selected].slice(0, MAX_ISSUE_EVIDENCE_FILES))
  }

  function removeFile(index) {
    onChange(files.filter((_, fileIndex) => fileIndex !== index))
  }

  return (
    <div className="order-support__evidence-picker">
      <label className="order-support__field" htmlFor={inputId}>
        <span className="order-support__label">{label}</span>
        <input
          id={inputId}
          type="file"
          multiple
          disabled={disabled || files.length >= MAX_ISSUE_EVIDENCE_FILES}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf"
          onChange={handleChange}
        />
        <span className="order-support__hint">{hint}</span>
      </label>

      {files.length > 0 ? (
        <ul className="order-support__file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className="order-support__file-item">
              <span className="order-support__file-name">
                {file.name} ({formatFileSize(file.size)})
              </span>
              <button
                type="button"
                className="order-support__file-remove"
                disabled={disabled}
                onClick={() => removeFile(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default EvidenceFilePicker
