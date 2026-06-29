import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ListingForm from '../components/ListingForm'
import ListingManageSection from '../components/listing/ListingManageSection'
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

  async function handleSave() {
    if (!listing || !form || !user?.id) return

    if (!isListingOwner(listing, user.id)) {
      setFormError('You do not have permission to edit this listing.')
      return
    }

    setSubmitting(true)
    setFormError('')
    setFormSuccess('')

    if (!form.categoryId) {
      setSubmitting(false)
      setFormError('Select a category to save your listing.')
      return
    }

    const payload = prepareListingPayload(form, listing.status, listing)

    if (listing.status === 'active') {
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
        setSubmitting(false)
        setFormError(validationErrors.join(' '))
        return
      }
    }

    if (!payload.price_pence || !payload.condition) {
      setSubmitting(false)
      setFormError('Enter a valid price and condition.')
      return
    }

    const { error } = await updateListing(listing.id, {
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
    })

    if (error) {
      setSubmitting(false)
      setFormError(getListingErrorMessage(error))
      return
    }

    const { error: fulfilmentError } = await persistListingFulfilmentPrivate(listing.id, form)

    if (fulfilmentError) {
      setSubmitting(false)
      setFormError(
        `Listing saved, but private fulfilment details could not be saved: ${getListingFulfilmentPrivateErrorMessage(fulfilmentError)}`,
      )
      return
    }

    if (existingImages.length > 0) {
      const { error: orderError } = await updateListingImagesOrder(existingImages)

      if (orderError) {
        setSubmitting(false)
        setFormError(`Listing saved, but photo order could not be updated: ${getImageErrorMessage(orderError)}`)
        return
      }
    }

    setSubmitting(false)

    setFormSuccess('Listing updated. Redirecting…')
    navigate(`/listings/${listing.slug}`, { replace: true })
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

  return (
    <div className="listing-form-page">
      <h1 className="listing-form-page__title">Edit listing</h1>

      <ListingForm
        form={form}
        categories={categories}
        idPrefix="edit-listing"
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
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        <div className="listing-form__actions">
          <Link to={`/listings/${listing.slug}`} className="listing-form__button listing-form__button--secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="listing-form__button listing-form__button--primary"
            disabled={submitting || uploadingImages}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </ListingForm>

      <ListingManageSection
        listing={listing}
        userId={user?.id}
        onListingChange={setListing}
        onDeleted={() => navigate('/my-listings', { replace: true })}
      />
    </div>
  )
}

export default EditListingPage
