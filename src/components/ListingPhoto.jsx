import {
  LISTING_THUMB_IMAGE_SIZES,
  LISTING_THUMB_IMAGE_WIDTHS,
  buildListingImageSources,
  restoreOriginalListingImage,
} from '../lib/listingImageTransforms'

function ListingPhoto({
  url,
  alt = '',
  widths = LISTING_THUMB_IMAGE_WIDTHS,
  sizes = LISTING_THUMB_IMAGE_SIZES,
  quality,
  className,
  priority = false,
  loading,
  fetchPriority,
  decoding = 'async',
  draggable = false,
  ...rest
}) {
  if (!url) return null

  const { src, srcSet } = buildListingImageSources(url, { widths, quality })

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      fetchPriority={fetchPriority ?? (priority ? 'high' : 'auto')}
      decoding={decoding}
      draggable={draggable}
      onError={(event) => restoreOriginalListingImage(event.currentTarget, url)}
      {...rest}
    />
  )
}

export default ListingPhoto
