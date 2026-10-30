function designReferenceSrc(fileName) {
  return `/design-reference/${encodeURI(fileName)}`
}

export const BRAND_PAGE_HERO_BACKGROUND = Object.freeze({
  src: designReferenceSrc('Soft Peach Abstract Hero Background.png'),
  width: 1920,
  height: 819,
})
