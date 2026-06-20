import { useRef } from 'react'
import { MAX_LISTING_IMAGES } from '../lib/constants'
import { getRemainingImageSlots, validateImageSelection } from '../lib/listingImages'
import './ListingImageUpload.css'

function ListingImageUpload({
  label = 'Photos',
  existingImages = [],
  pendingFiles = [],
  uploading = false,
  uploadError = '',
  onAddPendingFiles,
  onRemovePendingFile,
  onRemoveExistingImage,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const totalCount = existingImages.length + pendingFiles.length
  const remainingSlots = getRemainingImageSlots(existingImages.length, pendingFiles.length)

  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) return

    const validationError = validateImageSelection(files, existingImages.length, pendingFiles.length)
    if (validationError) {
      onAddPendingFiles([], validationError)
      return
    }

    onAddPendingFiles(files, '')
  }

  return (
    <div className="listing-image-upload">
      <label className="listing-image-upload__label" htmlFor="listing-image-input">
        {label}
      </label>
      <p className="listing-image-upload__hint">
        Up to {MAX_LISTING_IMAGES} images. JPEG, PNG, or WebP only. Max 5 MB each. The first image
        is the main photo.
      </p>

      <input
        ref={inputRef}
        id="listing-image-input"
        className="listing-image-upload__input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled || uploading || remainingSlots === 0}
        onChange={handleFileChange}
      />

      {totalCount > 0 ? (
        <div className="listing-image-upload__grid">
          {existingImages.map((image, index) => (
            <div
              key={image.id}
              className={`listing-image-upload__item${index === 0 ? ' listing-image-upload__item--primary' : ''}`}
            >
              <img src={image.url} alt="" className="listing-image-upload__image" />
              {index === 0 ? <span className="listing-image-upload__badge">Main</span> : null}
              {onRemoveExistingImage ? (
                <button
                  type="button"
                  className="listing-image-upload__remove"
                  aria-label="Remove image"
                  disabled={disabled || uploading}
                  onClick={() => onRemoveExistingImage(image)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}

          {pendingFiles.map((pending, index) => (
            <div
              key={pending.id}
              className={`listing-image-upload__item${
                existingImages.length === 0 && index === 0 ? ' listing-image-upload__item--primary' : ''
              }`}
            >
              <img src={pending.previewUrl} alt="" className="listing-image-upload__image" />
              {existingImages.length === 0 && index === 0 ? (
                <span className="listing-image-upload__badge">Main</span>
              ) : null}
              <button
                type="button"
                className="listing-image-upload__remove"
                aria-label="Remove image"
                disabled={disabled || uploading}
                onClick={() => onRemovePendingFile(pending.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {uploading ? <p className="listing-image-upload__status">Uploading images…</p> : null}

      {uploadError ? (
        <p className="listing-image-upload__status listing-image-upload__status--error" role="alert">
          {uploadError}
        </p>
      ) : null}

      <p className="listing-image-upload__status">
        {totalCount} of {MAX_LISTING_IMAGES} images selected
      </p>
    </div>
  )
}

export default ListingImageUpload
