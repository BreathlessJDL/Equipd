import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LeaveListingDraftModal from '../components/listing/LeaveListingDraftModal'
import ListingForm, { emptyListingForm } from '../components/ListingForm'
import '../components/ListingForm.css'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import {
  createListingFormSnapshot,
  isCreateListingFormChangedSinceSave,
  isCreateListingFormDirty,
} from '../lib/createListingForm'
import {
  getImageErrorMessage,
  uploadListingImages,
} from '../lib/listingImages'
import {
  getListingFulfilmentPrivateErrorMessage,
  mergeFulfilmentPrivateIntoForm,
  persistListingFulfilmentPrivate,
} from '../lib/listingFulfilmentPrivate'
import {
  createListing,
  fetchCategories,
  getListingErrorMessage,
  prepareListingPayload,
  updateListing,
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
  const [draftListingId, setDraftListingId] = useState(null)
  const [uploadedImageCount, setUploadedImageCount] = useState(0)
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [leaveModalError, setLeaveModalError] = useState('')
  const [leaveModalSaving, setLeaveModalSaving] = useState(false)
  const [bypassGuard, setBypassGuard] = useState(false)

  const hasMeaningfulInput = useMemo(
    () => isCreateListingFormDirty(form, pendingFiles),
    [form, pendingFiles],
  )

  const hasUnsavedChanges = useMemo(() => {
    if (!hasMeaningfulInput) return false
    if (!savedSnapshot) return true
    return isCreateListingFormChangedSinceSave(
      form,
      pendingFiles,
      uploadedImageCount,
      savedSnapshot,
    )
  }, [form, pendingFiles, uploadedImageCount, savedSnapshot, hasMeaningfulInput])

  const guardEnabled = hasUnsavedChanges && !bypassGuard

  const handleNavigationBlocked = useCallback(() => {
    setLeaveModalError('')
    setLeaveModalOpen(true)
  }, [])

  const { proceedPendingNavigation, cancelPendingNavigation } = useUnsavedChangesGuard({
    enabled: guardEnabled,
    onBlock: handleNavigationBlocked,
  })

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

  function handleReorderPendingFiles(next) {
    setPendingFiles(next)
    setImageError('')
  }

  function clearPendingFiles(files) {
    files.forEach((pending) => URL.revokeObjectURL(pending.previewUrl))
    setPendingFiles([])
  }

  async function persistListing(status) {
    if (!user?.id) {
      return { ok: false, error: 'You must be signed in to save a listing.' }
    }

    if (!form.categoryId) {
      return { ok: false, error: 'Select a category to save your listing.' }
    }

    const payload = prepareListingPayload(form, status)
    const hasPhotos = pendingFiles.length > 0 || uploadedImageCount > 0

    if (status === 'active') {
      const validationErrors = validateListingForPublish({
        title: form.title,
        categoryId: form.categoryId,
        pricePence: payload.price_pence,
        condition: payload.condition,
        form,
        description: form.description,
        hasPhotos,
        deliveryOptions: form.deliveryOptions,
      })

      if (validationErrors.length > 0) {
        return { ok: false, error: validationErrors.join(' ') }
      }
    }

    if (!payload.price_pence || !payload.condition) {
      return {
        ok: false,
        error: 'Enter a valid price and condition, or save as draft with defaults applied.',
      }
    }

    const listingFields = {
      category_id: payload.category_id,
      title: payload.title,
      brand: payload.brand,
      model: payload.model,
      rating: payload.rating,
      description: payload.description,
      price_pence: payload.price_pence,
      condition: payload.condition,
      location: payload.location,
      location_name: payload.location_name,
      city: payload.city,
      county: payload.county,
      postcode: payload.postcode,
      latitude: payload.latitude,
      longitude: payload.longitude,
      collection_available: payload.collection_available,
      courier_available: payload.courier_available,
      delivery_notes: payload.delivery_notes,
      seller_delivery_radius_miles: payload.seller_delivery_radius_miles,
      status,
    }

    let listing
    let nextUploadedImageCount = uploadedImageCount

    if (status === 'draft' && draftListingId) {
      const { data, error } = await updateListing(draftListingId, listingFields)

      if (error) {
        return { ok: false, error: getListingErrorMessage(error) }
      }

      listing = data
    } else {
      const { data, error } = await createListing(user.id, listingFields)

      if (error) {
        return { ok: false, error: getListingErrorMessage(error) }
      }

      listing = data

      if (status === 'draft') {
        setDraftListingId(data.id)
      }
    }

    const { error: fulfilmentError } = await persistListingFulfilmentPrivate(listing.id, form)

    if (fulfilmentError) {
      if (status === 'draft') {
        setDraftListingId(listing.id)
      }

      return {
        ok: false,
        error: `Listing saved, but private fulfilment details could not be saved: ${getListingFulfilmentPrivateErrorMessage(fulfilmentError)}`,
        listing,
      }
    }

    if (pendingFiles.length > 0) {
      setUploadingImages(true)

      const { error: uploadError } = await uploadListingImages({
        userId: user.id,
        listingId: listing.id,
        files: pendingFiles.map((pending) => pending.file),
        startSortOrder: uploadedImageCount,
      })

      setUploadingImages(false)

      if (uploadError) {
        if (status === 'draft') {
          setDraftListingId(listing.id)
        }

        return {
          ok: false,
          error: `Listing saved, but image upload failed: ${getImageErrorMessage(uploadError)}`,
          listing,
        }
      }

      const uploadedCount = pendingFiles.length
      clearPendingFiles(pendingFiles)
      nextUploadedImageCount = uploadedImageCount + uploadedCount
      setUploadedImageCount(nextUploadedImageCount)
    }

    if (status === 'draft') {
      setSavedSnapshot(createListingFormSnapshot(form, [], nextUploadedImageCount))
    }

    return { ok: true, listing }
  }

  async function handleSave(status) {
    setSubmitting(true)
    setFormError('')
    setFormSuccess('')

    const result = await persistListing(status)

    setSubmitting(false)

    if (!result.ok) {
      setFormError(result.error)
      return
    }

    setBypassGuard(true)
    setLeaveModalOpen(false)
    setLeaveModalError('')

    const statusLabel = status === 'active' ? 'published' : 'saved as draft'
    setFormSuccess(`Listing ${statusLabel}. Redirecting…`)
    navigate(`/listings/${result.listing.slug}`, { replace: true })
  }

  async function handleSaveDraftAndLeave() {
    setLeaveModalSaving(true)
    setLeaveModalError('')

    const result = await persistListing('draft')

    setLeaveModalSaving(false)

    if (!result.ok) {
      setLeaveModalError(result.error)
      return
    }

    setBypassGuard(true)
    setLeaveModalOpen(false)
    proceedPendingNavigation()
  }

  function handleLeaveWithoutSaving() {
    setBypassGuard(true)
    setLeaveModalOpen(false)
    setLeaveModalError('')
    proceedPendingNavigation()
  }

  function handleStayOnPage() {
    cancelPendingNavigation()
    setLeaveModalOpen(false)
    setLeaveModalError('')
  }

  if (loadingCategories) {
    return (
      <div className="listing-form-page">
        <h1 className="listing-form-page__title">Sell equipment</h1>
        <p className="listing-form__footnote">Loading categories…</p>
      </div>
    )
  }

  if (categoriesError) {
    return (
      <div className="listing-form-page">
        <h1 className="listing-form-page__title">Sell equipment</h1>
        <p className="listing-form__message listing-form__message--error" role="alert">
          {categoriesError}
        </p>
      </div>
    )
  }

  return (
    <div className="listing-form-page">
      <h1 className="listing-form-page__title">Sell equipment</h1>

      <ListingForm
        form={form}
        categories={categories}
        showDraftHints
        pendingFiles={pendingFiles}
        uploadingImages={uploadingImages}
        imageError={imageError}
        imageUploadDisabled={submitting || leaveModalSaving}
        onFieldChange={updateField}
        onAddPendingFiles={handleAddPendingFiles}
        onRemovePendingFile={handleRemovePendingFile}
        onReorderPendingFiles={handleReorderPendingFiles}
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
            disabled={submitting || uploadingImages || leaveModalSaving}
            onClick={() => handleSave('draft')}
          >
            {submitting || uploadingImages ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="submit"
            className="listing-form__button listing-form__button--primary"
            disabled={submitting || uploadingImages || leaveModalSaving}
          >
            {submitting || uploadingImages ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </ListingForm>

      <LeaveListingDraftModal
        open={leaveModalOpen}
        saving={leaveModalSaving}
        error={leaveModalError}
        onSaveDraftAndLeave={handleSaveDraftAndLeave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        onStay={handleStayOnPage}
      />
    </div>
  )
}

export default AddListingPage
