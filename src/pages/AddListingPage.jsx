import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ListingForm, { emptyListingForm } from '../components/ListingForm'
import '../components/PageStub.css'
import {
  getImageErrorMessage,
  uploadListingImages,
} from '../lib/listingImages'
import {
  createListing,
  fetchCategories,
  getListingErrorMessage,
  prepareListingPayload,
  validateListingForPublish,
} from '../lib/listings'
import { useAuth } from '../hooks/useAuth'

function AddListingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyListingForm)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    return () => {
      pendingFiles.forEach((pending) => URL.revokeObjectURL(pending.previewUrl))
    }
  }, [pendingFiles])

  useEffect(() => {
    let active = true

    async function loadCategories() {
      setLoadingCategories(true)
      setCategoriesError('')

      const { data, error } = await fetchCategories()

      if (!active) return

      if (error) {
        setCategoriesError(getListingErrorMessage(error))
        setLoadingCategories(false)
        return
      }

      setCategories(data ?? [])
      setLoadingCategories(false)
    }

    loadCategories()

    return () => {
      active = false
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
    setFormSuccess('')
  }

  function handleAddPendingFiles(files, validationError) {
    if (validationError) {
      setImageError(validationError)
      return
    }

    setImageError('')
    setPendingFiles((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  function handleRemovePendingFile(pendingId) {
    setPendingFiles((current) => {
      const next = current.filter((pending) => pending.id !== pendingId)
      const removed = current.find((pending) => pending.id === pendingId)
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return next
    })
    setImageError('')
  }

  async function handleSave(status) {
    if (!user?.id) return

    setSubmitting(true)
    setFormError('')
    setFormSuccess('')

    if (!form.categoryId) {
      setSubmitting(false)
      setFormError('Select a category to save your listing.')
      return
    }

    const payload = prepareListingPayload(form, status)

    if (status === 'active') {
      const validationErrors = validateListingForPublish({
        title: form.title,
        categoryId: form.categoryId,
        pricePence: payload.price_pence,
        condition: payload.condition,
        location: form.location,
      })

      if (validationErrors.length > 0) {
        setSubmitting(false)
        setFormError(validationErrors.join(' '))
        return
      }
    }

    if (!payload.price_pence || !payload.condition) {
      setSubmitting(false)
      setFormError('Enter a valid price and condition, or save as draft with defaults applied.')
      return
    }

    const { data, error } = await createListing(user.id, payload)

    if (error) {
      setSubmitting(false)
      setFormError(getListingErrorMessage(error))
      return
    }

    if (pendingFiles.length > 0) {
      setUploadingImages(true)

      const { error: uploadError } = await uploadListingImages({
        userId: user.id,
        listingId: data.id,
        files: pendingFiles.map((pending) => pending.file),
      })

      setUploadingImages(false)
      setSubmitting(false)

      if (uploadError) {
        setFormError(
          `Listing saved, but image upload failed: ${getImageErrorMessage(uploadError)}`,
        )
        navigate(`/listings/${data.slug}`, { replace: true })
        return
      }
    } else {
      setSubmitting(false)
    }

    const statusLabel = status === 'active' ? 'published' : 'saved as draft'
    setFormSuccess(`Listing ${statusLabel}. Redirecting…`)
    navigate(`/listings/${data.slug}`, { replace: true })
  }

  if (loadingCategories) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Sell equipment</h2>
        <p className="page-stub__lead">Loading categories…</p>
      </section>
    )
  }

  if (categoriesError) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Sell equipment</h2>
        <p className="listing-form__message listing-form__message--error" role="alert">
          {categoriesError}
        </p>
      </section>
    )
  }

  return (
    <section className="page-stub">
      <h2 className="page-stub__title">Sell equipment</h2>
      <p className="page-stub__lead">Add your equipment details and photos.</p>

      <ListingForm
        form={form}
        categories={categories}
        showDraftHints
        pendingFiles={pendingFiles}
        uploadingImages={uploadingImages}
        imageError={imageError}
        imageUploadDisabled={submitting}
        onFieldChange={updateField}
        onAddPendingFiles={handleAddPendingFiles}
        onRemovePendingFile={handleRemovePendingFile}
        formError={formError}
        formSuccess={formSuccess}
        onSubmit={(event) => {
          event.preventDefault()
          handleSave('active')
        }}
      >
        <div className="listing-form__actions">
          <button
            type="button"
            className="listing-form__button listing-form__button--secondary"
            disabled={submitting || uploadingImages}
            onClick={() => handleSave('draft')}
          >
            {submitting || uploadingImages ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="submit"
            className="listing-form__button listing-form__button--primary"
            disabled={submitting || uploadingImages}
          >
            {submitting || uploadingImages ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </ListingForm>
    </section>
  )
}

export default AddListingPage
