import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ListingForm from '../components/ListingForm'
import ListingManageSection from '../components/listing/ListingManageSection'
import SellerInventoryEditor from '../components/listing/SellerInventoryEditor'
import '../components/ListingForm.css'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  getListingFulfilmentPrivateErrorMessage,
  fetchListingFulfilmentPrivate,
  mergeFulfilmentPrivateIntoForm,
  persistListingFulfilmentPrivate,
} from '../lib/listingFulfilmentPrivate'
import {
  deleteListingImage,
  getImageErrorMessage,
  updateListingImagesOrder,
  uploadListingImages,
} from '../lib/listingImages'
import {
  fetchCategories,
  fetchListingBySlug,
  getListingErrorMessage,
  isListingOwner,
  listingToForm,
  prepareListingPayload,
  updateListing,
  validateListingForPublish,
} from '../lib/listings'
import { useAuth } from '../hooks/useAuth'

function EditListingPage() {
  usePageTitle('Edit Listing')
  const navigate = useNavigate()
  const { slug } = useParams()
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const [form, setForm] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [existingImages, setExistingImages] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [imageError, setImageError] = useState('')
  const [deletingListing, setDeletingListing] = useState(false)

  useEffect(() => {
    if (!slug) return undefined

    let active = true

    async function loadPageData() {
      setLoading(true)
      setLoadError('')

      const [listingResult, categoriesResult] = await Promise.all([
        fetchListingBySlug(slug),
        fetchCategories(),
      ])

      if (!active) return

      if (listingResult.error) {
        setLoadError(getListingErrorMessage(listingResult.error))
        setLoading(false)
        return
      }

      if (!listingResult.data) {
        setLoadError('Listing not found.')
        setLoading(false)
        return
      }

      if (categoriesResult.error) {
        setLoadError(getListingErrorMessage(categoriesResult.error))
        setLoading(false)
        return
      }

      setListing(listingResult.data)

      const { data: privateFulfilment, error: privateError } = await fetchListingFulfilmentPrivate(
        listingResult.data.id,
      )

      if (!active) return

      if (privateError) {
        console.warn(
          '[EditListingPage] Private fulfilment details unavailable; continuing with empty fields.',
          privateError,
        )
      }

      setForm(
        mergeFulfilmentPrivateIntoForm(
          listingToForm(listingResult.data),
          privateFulfilment,
        ),
      )
      setExistingImages(listingResult.data.listing_images ?? [])
      setCategories(categoriesResult.data ?? [])
      setLoading(false)
    }

    loadPageData()

    return () => {
      active = false
    }
  }, [slug])

  function updateField(field, value) {
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      setForm((current) => ({ ...current, ...field }))
    } else {
      setForm((current) => ({ ...current, [field]: value }))
    }
    setFormError('')
    setFormSuccess('')
  }

  async function handleAddImages(files, validationError) {
    if (!listing || !user?.id) return

    if (validationError) {
      setImageError(validationError)
      return
    }

    setUploadingImages(true)
    setImageError('')

    const { data, error } = await uploadListingImages({
      userId: user.id,
      listingId: listing.id,
      files,
      startSortOrder: existingImages.length,
    })

    setUploadingImages(false)

    if (error) {
      setImageError(getImageErrorMessage(error))
      if (data?.length) {
        setExistingImages((current) => [...current, ...data])
      }
      return
    }

    setExistingImages((current) => [...current, ...data])
  }

  async function handleRemoveExistingImage(image) {
    setUploadingImages(true)
    setImageError('')

    const { error } = await deleteListingImage(image)

    setUploadingImages(false)

    if (error) {
      setImageError(getImageErrorMessage(error))
      return
    }

    setExistingImages((current) => current.filter((item) => item.id !== image.id))
  }

  function handleReorderExistingImages(next) {
    setExistingImages(next)
    setImageError('')
  }

  async function persistListing({ targetStatus, validateForPublish = false, redirect = false, successMessage }) {
    if (!listing || !form || !user?.id || deletingListing) {
      return { ok: false }
    }

    if (!isListingOwner(listing, user.id)) {
      return { ok: false, error: 'You do not have permission to edit this listing.' }
    }

    if (!form.categoryId) {
      return { ok: false, error: 'Select a category to save your listing.' }
    }

    const payload = prepareListingPayload(form, targetStatus, listing)

    if (validateForPublish) {
      const validationErrors = validateListingForPublish({
        title: form.title,
        categoryId: form.categoryId,
        pricePence: payload.price_pence,
        condition: payload.condition,
        form,
        existingListing: listing,
        description: form.description,
        hasPhotos: existingImages.length > 0,
        deliveryOptions: form.deliveryOptions,
      })

      if (validationErrors.length > 0) {
        return { ok: false, error: validationErrors.join(' ') }
      }
    }

    if (!payload.price_pence || !payload.condition) {
      return { ok: false, error: 'Enter a valid price and condition.' }
    }

    const { data, error } = await updateListing(listing.id, {
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
      status: targetStatus,
      equipment_product_id: payload.equipment_product_id,
      canonical_product_key: payload.canonical_product_key,
    })

    if (error) {
      return { ok: false, error: getListingErrorMessage(error) }
    }

    const { error: fulfilmentError } = await persistListingFulfilmentPrivate(listing.id, form)

    if (fulfilmentError) {
      return {
        ok: false,
        error: `Listing saved, but private fulfilment details could not be saved: ${getListingFulfilmentPrivateErrorMessage(fulfilmentError)}`,
      }
    }

    if (existingImages.length > 0) {
      const { error: orderError } = await updateListingImagesOrder(existingImages)

      if (orderError) {
        return {
          ok: false,
          error: `Listing saved, but photo order could not be updated: ${getImageErrorMessage(orderError)}`,
        }
      }
    }

    setListing(data)

    if (redirect) {
      setFormSuccess(successMessage)
      navigate(`/listings/${data.slug}`, { replace: true })
      return { ok: true }
    }

    return { ok: true, listing: data, successMessage }
  }

  async function runSave({ targetStatus, validateForPublish, redirect, successMessage }) {
    setSubmitting(true)
    setFormError('')
    setFormSuccess('')

    const result = await persistListing({
      targetStatus,
      validateForPublish,
      redirect,
      successMessage,
    })

    setSubmitting(false)

    if (!result.ok) {
      if (result.error) {
        setFormError(result.error)
      }
      return
    }

    if (!redirect && result.successMessage) {
      setFormSuccess(result.successMessage)
    }
  }

  function handleSaveDraft() {
    if (listing?.status !== 'draft') return

    runSave({
      targetStatus: 'draft',
      validateForPublish: false,
      redirect: false,
      successMessage: 'Draft saved.',
    })
  }

  function handlePublishDraft() {
    if (listing?.status !== 'draft') return

    runSave({
      targetStatus: 'active',
      validateForPublish: true,
      redirect: true,
      successMessage: 'Listing published. Redirecting…',
    })
  }

  function handleSaveChanges() {
    if (!listing || listing.status === 'draft') return

    runSave({
      targetStatus: listing.status,
      validateForPublish: listing.status === 'active',
      redirect: true,
      successMessage: 'Listing updated. Redirecting…',
    })
  }

  if (loading) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Edit listing</h2>
        <p className="page-stub__lead">Loading listing…</p>
      </section>
    )
  }

  if (loadError || !listing || !form) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Edit listing</h2>
        <p className="listing-form__message listing-form__message--error" role="alert">
          {loadError || 'This listing could not be loaded.'}
        </p>
        <p className="page-stub__lead">
          <Link to="/">Back to browse</Link>
        </p>
      </section>
    )
  }

  if (!isListingOwner(listing, user?.id)) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Edit listing</h2>
        <p className="listing-form__message listing-form__message--error" role="alert">
          You do not have permission to edit this listing.
        </p>
        <p className="page-stub__lead">
          <Link to={`/listings/${listing.slug}`}>View listing</Link>
        </p>
      </section>
    )
  }

  const isDraft = listing.status === 'draft'
  const formId = 'edit-listing-form'

  return (
    <div className="listing-form-page listing-form-page--pinned-actions">
      <h1 className="listing-form-page__title">{isDraft ? 'Edit draft listing' : 'Edit listing'}</h1>

      {isDraft ? (
        <p className="listing-form__hint listing-form__hint--inline">
          Finish required details, then publish when you are ready. Saving keeps this listing as a draft.
        </p>
      ) : null}

      <SellerInventoryEditor
        key={listing.inventory_version}
        listing={listing}
        onListingChange={setListing}
      />

      <ListingForm
        form={form}
        categories={categories}
        idPrefix="edit-listing"
        formId={formId}
        existingImages={existingImages}
        uploadingImages={uploadingImages}
        imageError={imageError}
        imageUploadDisabled={submitting}
        onFieldChange={updateField}
        onAddPendingFiles={handleAddImages}
        onRemoveExistingImage={handleRemoveExistingImage}
        onReorderExistingImages={handleReorderExistingImages}
        formError={formError}
        formSuccess={formSuccess}
        showQuantity={false}
        onSubmit={(event) => {
          event.preventDefault()
          if (isDraft) {
            handlePublishDraft()
            return
          }
          handleSaveChanges()
        }}
      />

      <div className="listing-form-page__actions-bar" aria-label="Listing actions">
        <div className="listing-form__actions">
          <Link to={isDraft ? '/my-listings' : `/listings/${listing.slug}`} className="listing-form__button listing-form__button--secondary">
            Cancel
          </Link>
          {isDraft ? (
            <button
              type="button"
              className="listing-form__button listing-form__button--secondary"
              disabled={submitting || uploadingImages}
              onClick={handleSaveDraft}
            >
              {submitting ? 'Saving…' : 'Save draft'}
            </button>
          ) : null}
          <button
            type="submit"
            form={formId}
            className="listing-form__button listing-form__button--primary"
            disabled={submitting || uploadingImages}
          >
            {submitting ? (isDraft ? 'Publishing…' : 'Saving…') : isDraft ? 'Publish listing' : 'Save changes'}
          </button>
        </div>
      </div>

      <ListingManageSection
        listing={listing}
        userId={user?.id}
        onListingChange={setListing}
        onDeleteStart={() => setDeletingListing(true)}
        onDeleteEnd={() => setDeletingListing(false)}
        onDeleted={() => navigate('/my-listings', { replace: true })}
      />
    </div>
  )
}

export default EditListingPage
