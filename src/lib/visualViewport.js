/**
 * Visual Viewport CSS variables for mobile keyboard-aware layouts.
 * iOS Safari often keeps 100dvh at the layout viewport while the keyboard
 * covers the bottom of the screen. Size the thread shell to visualViewport
 * instead of guessing keyboard height.
 */

export const EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR = '--equipd-visual-viewport-height'
export const EQUIPD_KEYBOARD_INSET_VAR = '--equipd-keyboard-inset'

export function readVisualViewportMetrics(targetWindow = window) {
  const layoutHeight = Number(targetWindow.innerHeight) || 0
  const viewport = targetWindow.visualViewport

  if (!viewport) {
    return {
      height: layoutHeight,
      keyboardInset: 0,
    }
  }

  const height = Math.max(0, Math.round(viewport.height))
  const offsetTop = Math.max(0, viewport.offsetTop || 0)
  const keyboardInset = Math.max(0, Math.round(layoutHeight - viewport.height - offsetTop))

  return { height, keyboardInset }
}

export function applyVisualViewportCssVars(
  targetWindow = window,
  root = targetWindow.document?.documentElement,
) {
  if (!root?.style) return readVisualViewportMetrics(targetWindow)

  const metrics = readVisualViewportMetrics(targetWindow)
  root.style.setProperty(EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR, `${metrics.height}px`)
  root.style.setProperty(EQUIPD_KEYBOARD_INSET_VAR, `${metrics.keyboardInset}px`)
  return metrics
}

export function clearVisualViewportCssVars(root = document.documentElement) {
  if (!root?.style) return
  root.style.removeProperty(EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR)
  root.style.removeProperty(EQUIPD_KEYBOARD_INSET_VAR)
}

export function subscribeVisualViewport(
  onChange,
  targetWindow = window,
) {
  const handleChange = () => {
    const metrics = applyVisualViewportCssVars(targetWindow)
    onChange?.(metrics)
  }

  handleChange()

  const viewport = targetWindow.visualViewport
  viewport?.addEventListener('resize', handleChange)
  viewport?.addEventListener('scroll', handleChange)
  targetWindow.addEventListener('resize', handleChange)

  return () => {
    viewport?.removeEventListener('resize', handleChange)
    viewport?.removeEventListener('scroll', handleChange)
    targetWindow.removeEventListener('resize', handleChange)
  }
}
