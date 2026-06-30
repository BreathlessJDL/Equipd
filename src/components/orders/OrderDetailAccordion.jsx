import { useState } from 'react'
import './OrderDetailAccordion.css'

function OrderDetailAccordion({
  title,
  status,
  defaultOpen = false,
  className = '',
  children,
  id,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <details
      id={id}
      className={`order-detail-accordion${className ? ` ${className}` : ''}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="order-detail-accordion__summary">
        <span className="order-detail-accordion__heading">
          <span className="order-detail-accordion__title">{title}</span>
          {status ? (
            <span className="order-detail-accordion__status">{status}</span>
          ) : null}
        </span>
      </summary>
      <div className="order-detail-accordion__content">{children}</div>
    </details>
  )
}

export default OrderDetailAccordion
