import { useEffect, useState } from 'react'
import './ListingImageGallery.css'

function ListingImageGallery({
  images = [],
  title = 'Listing photo',
  saveButton = null,
  savedCountOverlay = null,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const hasImages = images.length > 0
  const hasMultiple = images.length > 1
  const safeIndex = hasImages ? Math.min(selectedIndex, images.length - 1) : 0
  const currentImage = hasImages ? images[safeIndex] : null

  useEffect(() => {
    if (selectedIndex >= images.length) {
      setSelectedIndex(0)
    }
  }, [images.length, selectedIndex])

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

        <div className="listing-gallery__main-wrap">
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
