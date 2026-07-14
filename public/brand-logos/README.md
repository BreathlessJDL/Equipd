# Brand logos

Official manufacturer logos used by the brand registry (`src/lib/brandCatalogueCore.js`).

## Featured assets

| Brand | File |
|-------|------|
| Life Fitness | `life-fitness.png` |
| Technogym | `technogym.png` |
| Matrix Fitness | `matrix-fitness.png` |
| Precor | `precor.png` |
| Cybex | `cybex.png` |
| Concept2 | `concept2.png` |
| Wattbike | `wattbike.png` |
| Woodway | `woodway.png` |
| Pulse Fitness | `pulse-fitness.png` |
| Hammer Strength | `hammer-strength.png` |
| Peloton | `peloton.png` |
| NordicTrack | `nordictrack.png` |
| BowFlex | `bowflex.png` |

All assets use transparent backgrounds so logos render consistently on Equipment Values and brand pages. Reference logos via registry `logoPath` values only — do not hardcode paths in components.

Normalize / refresh assets with:

```bash
node scripts/normalize-brand-logo-backgrounds.mjs
```
