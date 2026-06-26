function MobileMenuIconImage({ src, className = '' }) {
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}

export default MobileMenuIconImage
