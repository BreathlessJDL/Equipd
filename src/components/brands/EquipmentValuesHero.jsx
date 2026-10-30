import HomeEquipmentValuator from '../home/HomeEquipmentValuator'
import {
  EQUIPMENT_VALUES_HERO,
  EQUIPMENT_VALUES_HERO_MOBILE_MEDIA,
  EQUIPMENT_VALUES_POPULAR_SEARCHES,
} from '../../lib/equipmentValuesHero'
import './EquipmentValuesHero.css'

export default function EquipmentValuesHero() {
  const banner = EQUIPMENT_VALUES_HERO

  return (
    <section className="equipment-values-hero" aria-label="Equipment valuations">
      <div className="equipment-values-hero__art">
        <picture>
          <source
            media={EQUIPMENT_VALUES_HERO_MOBILE_MEDIA}
            srcSet={banner.mobileSrc}
            width={banner.mobileWidth}
            height={banner.mobileHeight}
          />
          <img
            src={banner.src}
            alt={banner.alt}
            className="equipment-values-hero__image"
            width={banner.width}
            height={banner.height}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <HomeEquipmentValuator
        idPrefix="brands-valuator"
        contained
        searchOnly
        showShowcase={false}
        submitLabel="Find value"
        popularSearches={EQUIPMENT_VALUES_POPULAR_SEARCHES}
        className="equipment-values-hero__search"
      />
    </section>
  )
}
