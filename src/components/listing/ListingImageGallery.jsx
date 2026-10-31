import { useCallback, useEffect, useRef, useState } from 'react'
import ListingPhoto from '../ListingPhoto'
import {
  LISTING_GALLERY_MAIN_QUALITY,
  LISTING_GALLERY_MAIN_SIZES,
  LISTING_GALLERY_MAIN_WIDTHS,
  LISTING_GALLERY_THUMB_SIZES,
  LISTING_GALLERY_THUMB_WIDTHS,
} from '../../lib/listingImageTransforms'
import {
  LISTING_GALLERY_PRELOAD_CONCURRENCY,
  LISTING_GALLERY_THUMB_EAGER_COUNT,
  createListingGalleryImageLoader,
  getAdjacentGalleryIndexes,
  getProgressiveGalleryIndexes,
  shouldPreloadRemainingGalleryImages,
  wrapGalleryIndex,
} from '../../lib/listingGalleryPreload'
import './ListingImageGallery.css'

const SWIPE_THRESHOLD_PX = 40
const SWIPE_MAX_VERTICAL_DRIFT_PX = 80

function CameraIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.25 4.25 5.9 3.2A1 1 0 0 1 6.75 2.75h2.5a1 1 0 0 1 .85.45l.65 1.05H12a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75H4A1.75 1.75 0 0 1 2.25 12v-6A1.75 1.75 0 0 1 4 4.25h1.25Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="2.15" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function galleryImagesKey(images) {
  return images.map((image) => image.id || image.url).join('|')
}

function ListingImageGallery({
  images = [],
  title = 'Listing photo',
  imageAlt = null,
  saveButton = null,
  savedCountOverlay = null,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [displayedIndex, setDisplayedIndex] = useState(0)
  const [currentImageReady, setCurrentImageReady] = useState(false)
  const mainWrapRef = useRef(null)
  const touchStartRef = useRef(null)
  const loadedUrlsRef = useRef(new Set())
  const inflightUrlsRef = useRef(new Set())
  const requestIdRef = useRef(0)
  const imagesKeyRef = useRef('')
  const hasImages = images.length > 0
  const hasMultiple = images.length > 1
  const safeIndex = hasImages ? wrapGalleryIndex(selectedIndex, images.length) : 0
  const safeDisplayedIndex = hasImages ? wrapGalleryIndex(displayedIndex, images.length) : 0
  const displayedImage = hasImages ? images[safeDisplayedIndex] : null
  const pending = hasImages && safeIndex !== safeDisplayedIndex
  const mainAlt = imageAlt || title
  const thumbAltBase = imageAlt || title
  const loadGalleryImage = useRef(createListingGalleryImageLoader()).current

  const showPrevious = useCallback(() => {
    if (images.length < 2) return
    setSelectedIndex((index) => wrapGalleryIndex(index - 1, images.length))
  }, [images.length])

  const showNext = useCallback(() => {
    if (images.length < 2) return
    setSelectedIndex((index) => wrapGalleryIndex(index + 1, images.length))
  }, [images.length])

  useEffect(() => {
    const key = galleryImagesKey(images)
    if (key === imagesKeyRef.current) return
    imagesKeyRef.current = key
    loadedUrlsRef.current = new Set()
    inflightUrlsRef.current = new Set()
    requestIdRef.current += 1
    setSelectedIndex(0)
    setDisplayedIndex(0)
    setCurrentImageReady(false)
  }, [images])

  useEffect(() => {
    if (!hasImages) return undefined

    const url = images[safeIndex]?.url
    if (!url) return undefined

    if (loadedUrlsRef.current.has(url)) {
      setDisplayedIndex(safeIndex)
      return undefined
    }

    if (safeIndex === safeDisplayedIndex) return undefined

    const requestId = ++requestIdRef.current
    let cancelled = false

    loadGalleryImage(url, { fetchPriority: 'high' }).then((ok) => {
      if (ok) loadedUrlsRef.current.add(url)
      if (cancelled || requestId !== requestIdRef.current) return
      loadedUrlsRef.current.add(url)
      setDisplayedIndex(safeIndex)
    })

    return () => {
      cancelled = true
    }
  }, [hasImages, images, loadGalleryImage, safeDisplayedIndex, safeIndex])

  useEffect(() => {
    if (!hasImages || !currentImageReady) return undefined

    let cancelled = false
    const adjacent = getAdjacentGalleryIndexes(safeIndex, images.length)
    const remaining = shouldPreloadRemainingGalleryImages()
      ? getProgressiveGalleryIndexes(safeIndex, images.length, adjacent)
      : []

    async function preload(url) {
      if (!url || cancelled) return
      if (loadedUrlsRef.current.has(url) || inflightUrlsRef.current.has(url)) return

      inflightUrlsRef.current.add(url)
      const ok = await loadGalleryImage(url, { fetchPriority: 'low' })
      inflightUrlsRef.current.delete(url)
      if (ok) loadedUrlsRef.current.add(url)
    }

    async function run() {
      await Promise.all(adjacent.map((index) => preload(images[index]?.url)))
      if (cancelled) return

      const queue = [...remaining]
      async function worker() {
        while (queue.length && !cancelled) {
          const index = queue.shift()
          await preload(images[index]?.url)
        }
      }

      const workers = Math.min(LISTING_GALLERY_PRELOAD_CONCURRENCY, queue.length)
      await Promise.all(Array.from({ length: workers }, () => worker()))
    }

    run()
    return () => {
      cancelled = true
    }
  }, [currentImageReady, hasImages, images, loadGalleryImage, safeIndex])

  useEffect(() => {
    const element = mainWrapRef.current
    if (!element || !hasMultiple) return undefined

    function handleTouchStart(event) {
      if (event.touches.length !== 1) {
        touchStartRef.current = null
        return
      }

      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      }
    }

    function handleTouchMove(event) {
      const start = touchStartRef.current
      if (!start || event.touches.length !== 1) return

      const deltaX = event.touches[0].clientX - start.x
      const deltaY = event.touches[0].clientY - start.y

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        event.preventDefault()
      }
    }

    function handleTouchEnd(event) {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!start) return

      const touchEndX = event.changedTouches[0]?.clientX
      const touchEndY = event.changedTouches[0]?.clientY
      if (touchEndX == null || touchEndY == null) return

      const deltaX = touchEndX - start.x
      const deltaY = touchEndY - start.y

      if (Math.abs(deltaY) > SWIPE_MAX_VERTICAL_DRIFT_PX) return
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return

      if (deltaX < 0) showNext()
      else showPrevious()
    }

    function handleTouchCancel() {
      touchStartRef.current = null
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [hasMultiple, showNext, showPrevious])

  useEffect(() => {
    if (!hasMultiple) return undefined

    function handleKeyDown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasMultiple, showNext, showPrevious])

  return (
    <section className="listing-gallery" aria-label="Listing photos">
      <div className={`listing-gallery__layout${hasMultiple ? '' : ' listing-gallery__layout--single'}`}>
        {hasMultiple ? (
          <div className="listing-gallery__thumbs" role="tablist" aria-label="Photo thumbnails">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                role="tab"
                aria-selected={index === safeIndex}
                aria-label={`View photo ${index + 1} of ${images.length}`}
                className={`listing-gallery__thumb-button${
                  index === safeIndex ? ' listing-gallery__thumb-button--selected' : ''
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <ListingPhoto
                  url={image.url}
                  alt={
                    images.length > 1
                      ? `${thumbAltBase} — photo ${index + 1}`
                      : thumbAltBase
                  }
                  className="listing-gallery__thumb-image"
                  widths={LISTING_GALLERY_THUMB_WIDTHS}
                  sizes={LISTING_GALLERY_THUMB_SIZES}
                  priority={index < LISTING_GALLERY_THUMB_EAGER_COUNT}
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={mainWrapRef}
          className={`listing-gallery__main-wrap${pending ? ' listing-gallery__main-wrap--pending' : ''}`}
          aria-busy={pending || undefined}
        >
          {saveButton || savedCountOverlay ? (
            <div className="listing-gallery__main-overlays">
              {saveButton ? <div className="listing-gallery__save">{saveButton}</div> : null}
              {savedCountOverlay}
            </div>
          ) : null}

          {hasImages ? (
            <>
              <ListingPhoto
                url={displayedImage.url}
                alt={mainAlt}
                className="listing-gallery__main-image"
                widths={LISTING_GALLERY_MAIN_WIDTHS}
                sizes={LISTING_GALLERY_MAIN_SIZES}
                quality={LISTING_GALLERY_MAIN_QUALITY}
                priority
                loading="eager"
                fetchPriority="high"
                draggable={false}
                onLoad={() => {
                  if (displayedImage?.url) loadedUrlsRef.current.add(displayedImage.url)
                  setCurrentImageReady(true)
                }}
              />
              {pending ? (
                <div className="listing-gallery__pending" aria-hidden="true">
                  <span className="listing-gallery__pending-bar" />
                </div>
              ) : null}
              {hasMultiple ? (
                <>
                  <button
                    type="button"
                    className="listing-gallery__nav listing-gallery__nav--prev"
                    aria-label="Previous photo"
                    onClick={showPrevious}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="listing-gallery__nav listing-gallery__nav--next"
                    aria-label="Next photo"
                    onClick={showNext}
                  >
                    ›
                  </button>
                  <div
                    className="listing-gallery__counter"
                    aria-label={`Photo ${safeIndex + 1} of ${images.length}`}
                  >
                    <CameraIcon className="listing-gallery__counter-icon" />
                    <span>
                      {safeIndex + 1} / {images.length}
                    </span>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="listing-gallery__empty" role="img" aria-label="No photos available">
              <span className="listing-gallery__empty-icon" aria-hidden="true">
                📷
              </span>
              <p className="listing-gallery__empty-text">No photos for this listing</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default ListingImageGallery
