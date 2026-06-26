import { useId, useRef } from 'react'
import UserAvatar from '../UserAvatar'
import { ALLOWED_PROFILE_IMAGE_TYPES, validateProfileImageFile } from '../../lib/profileImages'
import './ProfileImageUpload.css'

function ProfileImageUpload({
  profile,
  user,
  previewUrl,
  onFileSelected,
  onRemovePhoto,
  hasPhoto,
  disabled = false,
  error = '',
}) {
  const inputId = useId()
  const inputRef = useRef(null)

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    const validationError = validateProfileImageFile(file)
    if (validationError) {
      onFileSelected(null, validationError)
      return
    }

    onFileSelected(file, '')
  }

  const previewProfile = {
    ...profile,
    avatar_url: previewUrl || '',
  }

  return (
    <div className="profile-image-upload">
      <div className="profile-image-upload__preview">
        <UserAvatar profile={previewProfile} user={user} size="xl" />
      </div>

      <div className="profile-image-upload__actions">
        <input
          ref={inputRef}
          id={inputId}
          className="profile-image-upload__input"
          type="file"
          accept={ALLOWED_PROFILE_IMAGE_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={disabled}
        />
        <button
          type="button"
          className="profile-image-upload__button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Upload new photo
        </button>
        {hasPhoto ? (
          <button
            type="button"
            className="profile-image-upload__button profile-image-upload__button--secondary"
            disabled={disabled}
            onClick={onRemovePhoto}
          >
            Remove photo
          </button>
        ) : null}
      </div>

      <p className="profile-image-upload__hint">JPG or PNG, max size 5MB</p>

      {error ? (
        <p className="profile-image-upload__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default ProfileImageUpload
