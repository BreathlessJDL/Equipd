export const emptyListingForm = {
  title: '',
  description: '',
  categoryId: '',
  brand: '',
  condition: '',
  rating: '',
  model: '',
  colour: '',
  length: '',
  width: '',
  height: '',
  locationSearch: '',
  locationPlace: null,
  deliveryOptions: [],
  deliveryRangeMiles: '',
  collectionAddress: '',
  collectionPhone: '',
  collectionInstructions: '',
  price: '',
  quantity: '1',
  collectionAvailable: true,
  courierAvailable: false,
  deliveryNotes: '',
  equipmentProductId: '',
  equipmentProductKey: '',
  equipmentProductFamily: '',
  estimatedOriginalRrp: null,
  estimatedOriginalRrpCurrency: 'GBP',
}

function hasText(value) {
  return Boolean(String(value ?? '').trim())
}

/**
 * True when the create-listing form has any meaningful user input.
 */
export function isCreateListingFormDirty(form, pendingFiles = []) {
  if (pendingFiles.length > 0) return true
  if (!form) return false

  if (hasText(form.title)) return true
  if (hasText(form.description)) return true
  if (hasText(form.categoryId)) return true
  if (hasText(form.brand)) return true
  if (hasText(form.model)) return true
  if (hasText(form.condition)) return true
  if (hasText(form.rating)) return true
  if (hasText(form.colour)) return true
  if (hasText(form.length)) return true
  if (hasText(form.width)) return true
  if (hasText(form.height)) return true
  if (hasText(form.locationSearch)) return true
  if (form.locationPlace) return true
  if ((form.deliveryOptions?.length ?? 0) > 0) return true
  if (hasText(form.deliveryRangeMiles)) return true
  if (hasText(form.collectionAddress)) return true
  if (hasText(form.collectionPhone)) return true
  if (hasText(form.collectionInstructions)) return true
  if (hasText(form.price)) return true
  if (String(form.quantity ?? '1') !== '1') return true

  return false
}

export function createListingFormSnapshot(form, pendingFiles = [], uploadedImageCount = 0) {
  return JSON.stringify({
    form: form ?? emptyListingForm,
    pendingIds: pendingFiles.map((file) => file.id),
    uploadedImageCount,
  })
}

export function isCreateListingFormChangedSinceSave(form, pendingFiles, uploadedImageCount, savedSnapshot) {
  if (!savedSnapshot) return true
  return createListingFormSnapshot(form, pendingFiles, uploadedImageCount) !== savedSnapshot
}
