import { useEffect, useRef } from 'react'
import './SignaturePad.css'

function SignaturePad({ value, onChange, disabled = false, className = '' }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const context = canvas.getContext('2d')
    if (!context) return undefined

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * window.devicePixelRatio)
      canvas.height = Math.floor(rect.height * window.devicePixelRatio)
      context.scale(window.devicePixelRatio, window.devicePixelRatio)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = 2
      context.strokeStyle = '#1a2744'

      if (value) {
        const image = new Image()
        image.onload = () => {
          context.clearRect(0, 0, rect.width, rect.height)
          context.drawImage(image, 0, 0, rect.width, rect.height)
        }
        image.src = value
      } else {
        context.clearRect(0, 0, rect.width, rect.height)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [value])

  function getPoint(event) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function startDrawing(event) {
    if (disabled) return

    event.preventDefault()
    drawingRef.current = true

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const point = getPoint(event)

    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function draw(event) {
    if (!drawingRef.current || disabled) return

    event.preventDefault()

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const point = getPoint(event)

    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function stopDrawing() {
    if (!drawingRef.current || disabled) return

    drawingRef.current = false

    const canvas = canvasRef.current
    onChange?.(canvas.toDataURL('image/png'))
  }

  function handleClear() {
    if (disabled) return

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()

    context.clearRect(0, 0, rect.width, rect.height)
    onChange?.('')
  }

  return (
    <div className={`signature-pad${className ? ` ${className}` : ''}`}>
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        aria-label="Courier signature pad"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button
        type="button"
        className="signature-pad__clear"
        disabled={disabled}
        onClick={handleClear}
      >
        Clear signature
      </button>
    </div>
  )
}

export default SignaturePad
