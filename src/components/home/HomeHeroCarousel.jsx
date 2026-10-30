import { useCallback, useEffect, useId, useRef, useState } from 'react'
import HomeHero from './HomeHero'
import HomeHeroImageSlide from './HomeHeroImageSlide'
import {
  HOME_HERO_ROTATE_MS,
  HOME_HERO_TRANSITION_MS,
  getHomeHeroSlides,
} from '../../lib/homeHeroCarousel'
import './HomeHeroCarousel.css'

function CarouselArrow({ direction, onClick }) {
  const label = direction === 'prev' ? 'Previous hero slide' : 'Next hero slide'

  return (
    <button
      type="button"
      className={`home-hero-carousel__arrow home-hero-carousel__arrow--${direction}`}
      onClick={onClick}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === 'prev' ? 'M15 6.5 8.5 12 15 17.5' : 'M9 6.5 15.5 12 9 17.5'}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function HomeHeroCarousel({ isLoggedIn = false }) {
  const slides = getHomeHeroSlides(isLoggedIn)
  const slideCount = slides.length
  const labelId = useId()
  const pauseReasonsRef = useRef(new Set())
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setIndex(0)
  }, [isLoggedIn])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  const pause = useCallback((reason) => {
    pauseReasonsRef.current.add(reason)
    setPaused(true)
  }, [])

  const resume = useCallback((reason) => {
    pauseReasonsRef.current.delete(reason)
    if (pauseReasonsRef.current.size === 0) {
      setPaused(false)
    }
  }, [])

  const goTo = useCallback((nextIndex) => {
    const count = slides.length
    if (count <= 0) return
    const wrapped = ((nextIndex % count) + count) % count
    setIndex(wrapped)
  }, [slides.length])

  const goNext = useCallback(() => {
    goTo(index + 1)
  }, [goTo, index])

  const goPrev = useCallback(() => {
    goTo(index - 1)
  }, [goTo, index])

  useEffect(() => {
    if (paused || reduceMotion || slideCount < 2) return undefined
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount)
    }, HOME_HERO_ROTATE_MS)
    return () => window.clearInterval(intervalId)
  }, [paused, reduceMotion, slideCount, index])

  function handleKeyDown(event) {
    if (isEditableTarget(event.target)) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    } else if (event.key === 'Home') {
      event.preventDefault()
      goTo(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      goTo(slideCount - 1)
    }
  }

  const activeSlide = slides[index]

  return (
    <section className="home-hero home-hero--carousel" aria-labelledby={labelId}>
      <h2 id={labelId} className="visually-hidden">Equipd homepage highlights</h2>
      <div
        className="home-hero-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Homepage highlights"
        data-home-hero-carousel
        data-reduce-motion={reduceMotion ? 'true' : 'false'}
        style={{ '--home-hero-transition': `${HOME_HERO_TRANSITION_MS}ms` }}
        onMouseEnter={() => pause('hover')}
        onMouseLeave={() => resume('hover')}
        onFocusCapture={() => pause('focus')}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            resume('focus')
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="home-hero-carousel__stage">
          {slides.map((slide, slideIndex) => {
            const active = slideIndex === index
            const priority = slideIndex === 0
            return (
              <div
                key={slide.id}
                className={`home-hero-carousel__slide${active ? ' is-active' : ''}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${slideIndex + 1} of ${slideCount}`}
                aria-hidden={active ? undefined : true}
                inert={active ? undefined : true}
              >
                {slide.type === 'coat-rack' ? (
                  <HomeHero priority={priority && active} />
                ) : null}
                {slide.type === 'image-cta' ? (
                  <HomeHeroImageSlide
                    banner={slide.banner}
                    priority={priority}
                    variant={slide.id}
                  />
                ) : null}
              </div>
            )
          })}

          {slideCount > 1 ? (
            <>
              <CarouselArrow direction="prev" onClick={goPrev} />
              <CarouselArrow direction="next" onClick={goNext} />
            </>
          ) : null}
        </div>

        {slideCount > 1 ? (
          <div className="home-hero-carousel__dots" role="tablist" aria-label="Choose a homepage highlight">
            {slides.map((slide, dotIndex) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                className="home-hero-carousel__dot"
                aria-label={`Show slide ${dotIndex + 1}`}
                aria-selected={dotIndex === index}
                tabIndex={dotIndex === index ? 0 : -1}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
        ) : null}

        <p className="visually-hidden" aria-live="polite">
          {activeSlide?.type === 'coat-rack'
            ? 'Sell now'
            : activeSlide?.banner?.label || activeSlide?.banner?.alt || 'Homepage highlight'}
        </p>
      </div>
    </section>
  )
}

export default HomeHeroCarousel
