import { useMemo, useRef } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MAX_LISTING_IMAGES } from '../lib/constants'
import { getRemainingImageSlots, validateImageSelection } from '../lib/listingImages'
import './ListingImageUpload.css'

function SortableImageTile({ id, disabled, className, label, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className}${isDragging ? ' listing-image-upload__item--dragging' : ''}${
        disabled ? '' : ' listing-image-upload__item--draggable'
      }`}
      aria-label={disabled ? undefined : `Drag to reorder: ${label}`}
      {...(!disabled ? listeners : {})}
      {...(!disabled ? attributes : {})}
    >
      {children}
      {!disabled ? (
        <span className="listing-image-upload__drag-handle" aria-hidden="true">
          <span className="listing-image-upload__drag-handle-icon">⋮⋮</span>
        </span>
      ) : null}
    </div>
  )
}

function ListingImageUpload({
  label = 'Photos',
  variant = 'default',
  existingImages = [],
  pendingFiles = [],
  uploading = false,
  uploadError = '',
  onAddPendingFiles,
  onRemovePendingFile,
  onReorderPendingFiles,
  onRemoveExistingImage,
  onReorderExistingImages,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const totalCount = existingImages.length + pendingFiles.length
  const remainingSlots = getRemainingImageSlots(existingImages.length, pendingFiles.length)
  const isDropzone = variant === 'dropzone'
  const canReorder = totalCount > 1
  const reorderDisabled = disabled || uploading
  const dragEnabled = canReorder && (onReorderExistingImages || onReorderPendingFiles)

  const sortableEntries = useMemo(
    () => [
      ...existingImages.map((image) => ({
        sortableId: `existing:${image.id}`,
        type: 'existing',
        item: image,
      })),
      ...pendingFiles.map((pending) => ({
        sortableId: `pending:${pending.id}`,
        type: 'pending',
        item: pending,
      })),
    ],
    [existingImages, pendingFiles],
  )

  const sortableIds = useMemo(
    () => sortableEntries.map((entry) => entry.sortableId),
    [sortableEntries],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

  function openFilePicker() {
    if (!disabled && !uploading && remainingSlots > 0) {
      inputRef.current?.click()
    }
  }

  function applyReorder(reorderedEntries) {
    const nextExisting = reorderedEntries
      .filter((entry) => entry.type === 'existing')
      .map((entry) => entry.item)
    const nextPending = reorderedEntries
      .filter((entry) => entry.type === 'pending')
      .map((entry) => entry.item)

    if (onReorderExistingImages) {
      onReorderExistingImages(nextExisting)
    }

    if (onReorderPendingFiles) {
      onReorderPendingFiles(nextPending)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event

    if (!over || active.id === over.id || reorderDisabled) {
      return
    }

    const oldIndex = sortableIds.indexOf(active.id)
    const newIndex = sortableIds.indexOf(over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    applyReorder(arrayMove(sortableEntries, oldIndex, newIndex))
  }

  function getPhotoLabel(entry) {
    if (entry.type === 'existing') {
      const existingIndex = existingImages.findIndex((item) => item.id === entry.item.id)
      return `photo ${existingIndex + 1}`
    }

    const pendingIndex = pendingFiles.findIndex((item) => item.id === entry.item.id)
    return `photo ${existingImages.length + pendingIndex + 1}`
  }

  function renderTile(entry, index) {
    const isMain = index === 0

    if (entry.type === 'existing') {
      const image = entry.item

      return (
        <>
          <img src={image.url} alt="" className="listing-image-upload__image" draggable={false} />
          {isMain ? <span className="listing-image-upload__badge">Main</span> : null}
          {onRemoveExistingImage ? (
            <button
              type="button"
              className="listing-image-upload__remove"
              aria-label="Remove image"
              disabled={reorderDisabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onRemoveExistingImage(image)}
            >
              ×
            </button>
          ) : null}
        </>
      )
    }

    const pending = entry.item

    return (
      <>
        <img src={pending.previewUrl} alt="" className="listing-image-upload__image" draggable={false} />
        {isMain ? <span className="listing-image-upload__badge">Main</span> : null}
        <button
          type="button"
          className="listing-image-upload__remove"
          aria-label="Remove image"
          disabled={reorderDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemovePendingFile(pending.id)}
        >
          ×
        </button>
      </>
    )
  }

  const gridContent = sortableEntries.map((entry, index) => {
    const itemClassName = `listing-image-upload__item${
      index === 0 ? ' listing-image-upload__item--primary' : ''
    }`

    if (dragEnabled) {
      return (
        <SortableImageTile
          key={entry.sortableId}
          id={entry.sortableId}
          disabled={reorderDisabled}
          className={itemClassName}
          label={getPhotoLabel(entry)}
        >
          {renderTile(entry, index)}
        </SortableImageTile>
      )
    }

    return (
      <div key={entry.sortableId} className={itemClassName}>
        {renderTile(entry, index)}
      </div>
    )
  })

  return (
    <div className={`listing-image-upload${isDropzone ? ' listing-image-upload--dropzone' : ''}`}>
      {!isDropzone ? (
        <label className="listing-image-upload__label" htmlFor="listing-image-input">
          {label}
        </label>
      ) : null}

      {!isDropzone ? (
        <p className="listing-image-upload__hint">
          Up to {MAX_LISTING_IMAGES} images. JPEG, PNG, or WebP only. Max 5 MB each. The first image
          is the main photo.
        </p>
      ) : null}

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

      {isDropzone ? (
        <div className="listing-image-upload__dropzone">
          <button
            type="button"
            className="listing-image-upload__upload-button"
            disabled={disabled || uploading || remainingSlots === 0}
            onClick={openFilePicker}
          >
            <span className="listing-image-upload__upload-icon" aria-hidden="true">
              +
            </span>
            Upload photos
          </button>
          <p className="listing-image-upload__hint listing-image-upload__hint--centered">
            Up to {MAX_LISTING_IMAGES} photos · JPEG, PNG or WebP · Max 5 MB each
          </p>
        </div>
      ) : null}

      {totalCount > 0 ? (
        dragEnabled ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <div className="listing-image-upload__grid">{gridContent}</div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="listing-image-upload__grid">{gridContent}</div>
        )
      ) : null}

      {uploading ? <p className="listing-image-upload__status">Uploading images…</p> : null}

      {uploadError ? (
        <p className="listing-image-upload__status listing-image-upload__status--error" role="alert">
          {uploadError}
        </p>
      ) : null}

      {totalCount > 0 ? (
        <p className="listing-image-upload__status">
          {totalCount} of {MAX_LISTING_IMAGES} images selected
          {canReorder ? ' · Drag photos to reorder' : ''}
        </p>
      ) : null}
    </div>
  )
}

export default ListingImageUpload
