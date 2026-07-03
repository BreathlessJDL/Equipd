import { useEffect, useRef, useState } from 'react'
import './ListingImageGallery.css'

const SWIPE_THRESHOLD_PX = 40
const SWIPE_MAX_VERTICAL_DRIFT_PX = 80

function ListingImageGallery({
  images = [],
  title = 'Listing photo',
  saveButton = null,
  savedCountOverlay = null,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const mainWrapRef = useRef(null)
  const touchStartRef = useRef(null)
  const hasImages = images.length > 0
  const hasMultiple = images.length > 1
  const safeIndex = hasImages ? Math.min(selectedIndex, images.length - 1) : 0
  const currentImage = hasImages ? images[safeIndex] : null

  useEffect(() => {
    if (selectedIndex >= images.length) {
      setSelectedIndex(0)
    }
  }, [images.length, selectedIndex])

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

      if (deltaX < 0) {
        setSelectedIndex((index) => (index === images.length - 1 ? 0 : index + 1))
      } else {
        setSelectedIndex((index) => (index === 0 ? images.length - 1 : index - 1))
      }
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
  }, [hasMultiple, images.length])

  function showPrevious() {
    if (!hasMultiple) return
    setSelectedIndex((index) => (index === 0 ? images.length - 1 : index - 1))
  }

  function showNext() {
    if (!hasMultiple) return
    setSelectedIndex((index) => (index === images.length - 1 ? 0 : index + 1))
  }

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
                <img src={image.url} alt="" className="listing-gallery__thumb-image" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}

        <div ref={mainWrapRef} className="listing-gallery__main-wrap">
          {saveButton || savedCountOverlay ? (
            <div className="listing-gallery__main-overlays">
              {saveButton ? <div className="listing-gallery__save">{saveButton}</div> : null}
              {savedCountOverlay}
            </div>
          ) : null}

          {hasImages ? (
            <>
              <img
                src={currentImage.url}
                alt={title}
                className="listing-gallery__main-image"
                draggable={false}
              />
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
                    className="listing-gallery__dots"
                    aria-label={`Photo ${safeIndex + 1} of ${images.length}`}
                  >
                    {images.map((image, index) => (
                      <span
                        key={image.id}
                        className={`listing-gallery__dot${
                          index === safeIndex ? ' listing-gallery__dot--active' : ''
                        }`}
                      />
                    ))}
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
