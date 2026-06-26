import { useMemo } from 'react'
import { buildOrderTimeline } from '../lib/orderTimeline'
import './OrderTimeline.css'

function OrderTimeline({
  order,
  payment,
  offer,
  supportRequests,
  viewerRole,
  userId,
  timeline: timelineProp = null,
  showCurrentStatus = false,
  compact = false,
}) {
  const timeline = useMemo(() => {
    if (timelineProp) return timelineProp
    if (!order) return null

    return buildOrderTimeline({
      order,
      payment,
      offer,
      supportRequests,
      viewerRole,
      userId,
    })
  }, [timelineProp, order, payment, offer, supportRequests, viewerRole, userId])

  if (!timeline || timeline.events.length === 0) return null

  const { currentStage, events } = timeline

  return (
    <section
      className={`order-timeline${compact ? ' order-timeline--compact' : ''}`}
      aria-label="Order timeline"
    >
      <h2 className="order-timeline__title">Order progress</h2>

      {showCurrentStatus && currentStage ? (
        <p className={`order-timeline__current order-timeline__current--${currentStage.key}`}>
          Current status: {currentStage.label}
        </p>
      ) : null}

      <ol className="order-timeline__list">
        {events.map((event) => (
          <li
            key={event.id}
            className={`order-timeline__item order-timeline__item--${event.state}`}
          >
            <div className="order-timeline__marker" aria-hidden="true" />
            <div className="order-timeline__content">
              <p className="order-timeline__label">{event.label}</p>
              {event.detail ? (
                <p className="order-timeline__detail">{event.detail}</p>
              ) : null}
              {event.timestampLabel ? (
                <p
                  className={`order-timeline__time${
                    event.timestampLabel === 'Same time'
                      ? ' order-timeline__time--same'
                      : ''
                  }`}
                >
                  {event.timestampLabel}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default OrderTimeline
