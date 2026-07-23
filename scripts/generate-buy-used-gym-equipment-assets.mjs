/**
 * Generate buyer landing page journey, hero and OG assets from Equipd-styled
 * HTML fixtures (Playwright + sharp). No invented product photography.
 *
 *   node scripts/generate-buy-used-gym-equipment-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const journeyDir = join(root, 'public', 'images', 'buy')
const heroDir = join(root, 'public', 'buy-used-gym-equipment')

const PRODUCT_IMAGE =
  'https://mhwvzovxlqimcuxvyyjf.supabase.co/storage/v1/object/public/equipment-product-images/technogym/technogym-non-motorised-treadmill-skill-line-skillmill.jpg'

const SHARED_CSS = `
  :root {
    --navy: #172033;
    --orange: #f25d22;
    --muted: #667085;
    --border: #e4e7ec;
    --warm: #fff8f3;
    --bg: #f6f7f9;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, system-ui, sans-serif;
    color: var(--navy);
    background: #fff;
  }
  .card {
    background: #fff;
    border: 1px solid color-mix(in srgb, var(--navy) 8%, var(--border));
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(23, 32, 51, 0.08);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 16px;
    border-radius: 8px;
    border: 0;
    background: var(--orange);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
  }
  .btn-secondary {
    background: #fff;
    color: var(--navy);
    border: 1px solid var(--border);
  }
  .muted { color: var(--muted); }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--orange) 10%, #fff);
    color: var(--orange);
    font-size: 12px;
    font-weight: 650;
  }
`

function journeyHtml(step) {
  const panels = {
    1: `
      <div class="browse">
        <div class="browse-bar">
          <div class="search">Search treadmills, bikes, racks…</div>
          <div class="filters">
            <span>Brand</span><span>Category</span><span>Location</span><span>Price</span>
          </div>
        </div>
        <div class="grid">
          ${[1, 2, 3, 4].map((n) => `
            <div class="listing">
              <div class="thumb thumb-${n}"></div>
              <div class="meta">
                <strong>${n === 1 ? 'Technogym Skillmill' : n === 2 ? 'Life Fitness T5' : n === 3 ? 'Matrix T30' : 'Concept2 RowErg'}</strong>
                <span class="muted">${n === 1 ? 'Leeds' : n === 2 ? 'Manchester' : n === 3 ? 'Birmingham' : 'Bristol'}</span>
                <em>£${n === 1 ? '2,750' : n === 2 ? '1,895' : n === 3 ? '1,250' : '980'}</em>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <style>
        .frame { padding: 48px 56px; background: linear-gradient(180deg, #fffaf6, #fff); }
        .browse { width: 100%; max-width: 1180px; margin: 0 auto; }
        .browse-bar { display: grid; gap: 14px; margin-bottom: 22px; }
        .search {
          height: 52px; border-radius: 12px; border: 1px solid var(--border);
          display: flex; align-items: center; padding: 0 18px; color: var(--muted); background: #fff;
          box-shadow: 0 8px 20px rgba(23,32,51,.05);
        }
        .filters { display: flex; gap: 10px; flex-wrap: wrap; }
        .filters span {
          padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border);
          background: #fff; font-size: 13px; color: var(--muted);
        }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .listing { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: #fff; }
        .thumb { height: 148px; background: #eef1f5 center/cover no-repeat; }
        .thumb-1 { background-image: url('${PRODUCT_IMAGE}'); background-size: contain; background-color: #f4f6f8; }
        .thumb-2 { background: linear-gradient(135deg, #dfe7f1, #f7f8fa); }
        .thumb-3 { background: linear-gradient(135deg, #e8ddd4, #f8f5f1); }
        .thumb-4 { background: linear-gradient(135deg, #d9e8e2, #f4faf7); }
        .meta { padding: 12px 14px 16px; display: grid; gap: 4px; }
        .meta strong { font-size: 14px; }
        .meta em { font-style: normal; font-weight: 750; color: var(--navy); }
      </style>
    `,
    2: `
      <div class="offer-wrap">
        <div class="offer card">
          <div class="offer-head">
            <div class="thumb"></div>
            <div>
              <strong>Technogym Skillmill Connect</strong>
              <div class="muted">Asking price £2,750</div>
            </div>
          </div>
          <label class="muted">Your offer</label>
          <div class="amount">£2,500</div>
          <div class="note muted">Include a short message for the seller</div>
          <div class="actions">
            <button class="btn">Make an Offer</button>
            <button class="btn btn-secondary">Cancel</button>
          </div>
        </div>
        <div class="chat card">
          <div class="bubble them">Is the console included and fully working?</div>
          <div class="bubble me">Yes — Connect console, good condition overall.</div>
          <div class="bubble them">Happy to offer £2,500 if that works?</div>
        </div>
      </div>
      <style>
        .frame { padding: 56px; background: linear-gradient(160deg, #fff8f3, #fff); display:flex; align-items:center; justify-content:center; }
        .offer-wrap { display:grid; grid-template-columns: 1.05fr .95fr; gap: 28px; width: 100%; max-width: 1100px; align-items: stretch; }
        .offer { padding: 28px; display:grid; gap: 12px; }
        .offer-head { display:flex; gap: 14px; align-items:center; margin-bottom: 8px; }
        .offer-head .thumb {
          width: 72px; height: 72px; border-radius: 12px;
          background: #f4f6f8 url('${PRODUCT_IMAGE}') center/contain no-repeat;
          border: 1px solid var(--border);
        }
        .amount {
          font-size: 42px; font-weight: 750; letter-spacing: -0.04em; color: var(--orange);
          padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--warm);
        }
        .actions { display:flex; gap: 10px; margin-top: 8px; }
        .chat { padding: 22px; display:grid; gap: 12px; align-content: start; background: #fff; }
        .bubble {
          max-width: 88%; padding: 12px 14px; border-radius: 14px; font-size: 15px; line-height: 1.4;
        }
        .bubble.them { background: #f3f4f6; justify-self: start; }
        .bubble.me { background: color-mix(in srgb, var(--orange) 14%, #fff); justify-self: end; }
      </style>
    `,
    3: `
      <div class="checkout card">
        <h2>Secure checkout</h2>
        <div class="row"><span>Item price</span><strong>£2,500.00</strong></div>
        <div class="row"><span>Buyer Protection fee</span><strong>£125.00</strong></div>
        <div class="divider"></div>
        <div class="row total"><span>Total to pay</span><strong>£2,625.00</strong></div>
        <p class="note muted">Your payment is held securely until you confirm handover.</p>
        <button class="btn pay">Pay Securely</button>
        <div class="secure muted">Processed securely by Stripe</div>
      </div>
      <style>
        .frame { padding: 64px; background: linear-gradient(180deg, #fff7f1, #fff); display:flex; align-items:center; justify-content:center; }
        .checkout { width: 520px; padding: 36px 40px; }
        h2 { margin: 0 0 22px; font-size: 28px; letter-spacing: -0.03em; }
        .row { display:flex; justify-content:space-between; gap: 16px; padding: 10px 0; font-size: 16px; }
        .row span { color: var(--muted); }
        .divider { height: 1px; background: var(--border); margin: 8px 0 4px; }
        .total { font-size: 20px; padding-top: 14px; }
        .total strong { color: var(--navy); font-size: 24px; }
        .note { margin: 18px 0 22px; line-height: 1.5; }
        .pay { width: 100%; min-height: 52px; font-size: 16px; }
        .secure { margin-top: 14px; text-align:center; font-size: 13px; }
      </style>
    `,
    4: `
      <div class="handover">
        <div class="phone card">
          <div class="status">Ready to confirm</div>
          <div class="qr"></div>
          <strong>Scan to confirm handover</strong>
          <p class="muted">Inspect first, then confirm when you are happy.</p>
        </div>
        <div class="side">
          <div class="protect card">
            <div class="shield">✓</div>
            <div>
              <strong>Buyer Protection</strong>
              <p class="muted">24-hour protection starts after confirmed handover.</p>
            </div>
          </div>
          <div class="options card">
            <div class="opt"><span>1</span><div><strong>Collect in person</strong><p class="muted">QR confirmation after inspection</p></div></div>
            <div class="opt"><span>2</span><div><strong>Seller delivery</strong><p class="muted">Inspect on arrival, then confirm</p></div></div>
            <div class="opt"><span>3</span><div><strong>Buyer courier</strong><p class="muted">Evidence + delivery confirmation</p></div></div>
          </div>
        </div>
      </div>
      <style>
        .frame { padding: 56px; background: linear-gradient(155deg, #fff8f3, #fff); display:flex; align-items:center; justify-content:center; }
        .handover { display:grid; grid-template-columns: .9fr 1.1fr; gap: 28px; width: 100%; max-width: 1100px; }
        .phone { padding: 28px; text-align:center; display:grid; gap: 14px; justify-items:center; }
        .status { font-size: 13px; font-weight: 700; color: var(--orange); letter-spacing: .04em; text-transform: uppercase; }
        .qr {
          width: 210px; height: 210px; border-radius: 18px; border: 1px solid var(--border);
          background:
            linear-gradient(#172033 0 0) 20% 20% / 18% 18%,
            linear-gradient(#172033 0 0) 50% 20% / 18% 18%,
            linear-gradient(#172033 0 0) 80% 20% / 18% 18%,
            linear-gradient(#172033 0 0) 20% 50% / 18% 18%,
            linear-gradient(#172033 0 0) 80% 50% / 18% 18%,
            linear-gradient(#172033 0 0) 20% 80% / 18% 18%,
            linear-gradient(#172033 0 0) 50% 80% / 18% 18%,
            linear-gradient(#172033 0 0) 80% 80% / 18% 18%,
            #fff;
          background-repeat: no-repeat;
        }
        .side { display:grid; gap: 18px; }
        .protect { display:flex; gap: 14px; align-items:flex-start; padding: 20px 22px; }
        .shield {
          width: 42px; height: 42px; border-radius: 50%; background: #e8f8ef; color: #099250;
          display:flex; align-items:center; justify-content:center; font-weight: 800;
        }
        .options { padding: 8px 8px 8px 12px; display:grid; gap: 4px; }
        .opt { display:flex; gap: 12px; align-items:flex-start; padding: 12px; border-radius: 12px; }
        .opt span {
          width: 28px; height: 28px; border-radius: 50%; background: color-mix(in srgb, var(--orange) 12%, #fff);
          color: var(--orange); display:flex; align-items:center; justify-content:center; font-weight: 750; flex-shrink: 0;
        }
        .opt p { margin: 2px 0 0; font-size: 13px; }
        .opt strong { font-size: 15px; }
        .protect p, .phone p { margin: 4px 0 0; }
      </style>
    `,
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHARED_CSS}</style></head>
  <body><div class="frame" id="capture">${panels[step]}</div></body></html>`
}

function heroHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${SHARED_CSS}
    body { background: transparent; width: 994px; height: 759px; overflow: hidden; }
    .hero {
      position: relative; width: 994px; height: 759px;
      background: transparent;
    }
    .listing {
      position: absolute; left: 58px; top: 88px; width: 340px;
      border-radius: 18px; overflow: hidden; background: #fff;
      border: 1px solid #eadfd4;
      box-shadow: 0 24px 50px rgba(23,32,51,.14);
    }
    .listing img { display:block; width: 100%; height: 220px; object-fit: contain; background: #f5f7fa; }
    .listing-body { padding: 16px 18px 18px; }
    .listing h3 { margin: 0 0 6px; font-size: 18px; letter-spacing: -0.02em; }
    .price { margin: 0 0 4px; font-size: 22px; font-weight: 800; }
    .loc { margin: 0 0 14px; font-size: 13px; color: var(--muted); }
    .chat {
      position: absolute; right: 42px; top: 150px; width: 320px; padding: 16px;
      border-radius: 18px; background: #fff; border: 1px solid #eadfd4;
      box-shadow: 0 22px 44px rgba(23,32,51,.12);
      display: grid; gap: 10px;
    }
    .bubble { padding: 10px 12px; border-radius: 12px; font-size: 13px; line-height: 1.35; max-width: 92%; }
    .them { background: #f3f4f6; }
    .me { background: #ffe8db; justify-self: end; }
    .protect {
      position: absolute; left: 210px; bottom: 78px; width: 300px;
      display: flex; gap: 12px; align-items: flex-start;
      padding: 14px 16px; border-radius: 16px; background: #fff;
      border: 1px solid #d8f0e2; box-shadow: 0 18px 36px rgba(23,32,51,.1);
    }
    .protect .badge {
      width: 36px; height: 36px; border-radius: 50%; background: #e8f8ef; color: #099250;
      display:flex; align-items:center; justify-content:center; font-weight: 800; flex-shrink:0;
    }
    .protect strong { display:block; font-size: 14px; margin-bottom: 2px; }
    .protect span { font-size: 12px; color: var(--muted); line-height: 1.35; }
    .note {
      position: absolute; font-family: Caveat, cursive; color: var(--orange);
      font-size: 28px; font-weight: 700; line-height: 1; white-space: nowrap;
    }
    .n1 { left: 40px; top: 42px; transform: rotate(-4deg); }
    .n2 { right: 36px; top: 96px; transform: rotate(3deg); }
    .n3 { right: 28px; bottom: 210px; transform: rotate(-2deg); }
    .n4 { left: 48px; bottom: 36px; transform: rotate(2deg); }
  </style></head>
  <body>
    <div class="hero" id="capture">
      <div class="note n1">Find the right equipment</div>
      <div class="note n2">Chat with sellers and agree a price</div>
      <div class="listing">
        <img src="${PRODUCT_IMAGE}" alt="" />
        <div class="listing-body">
          <h3>Technogym Skillmill Connect</h3>
          <div class="price">£2,750</div>
          <div class="loc">Good · Leeds, UK</div>
          <button class="btn" style="width:100%">Make an Offer</button>
        </div>
      </div>
      <div class="chat">
        <div class="bubble them">Is this still available?</div>
        <div class="bubble me">Yes — happy to answer any questions.</div>
        <div class="bubble them">Could you do £2,500?</div>
      </div>
      <div class="note n3">Secure payment through Equipd</div>
      <div class="protect">
        <div class="badge">✓</div>
        <div>
          <strong>Buyer Protection</strong>
          <span>Protected until you're happy after confirmed handover.</span>
        </div>
      </div>
      <div class="note n4">Protected until you're happy</div>
    </div>
  </body></html>`
}

async function writeVariants(pngBuffer, basePathNoExt) {
  const full = await sharp(pngBuffer).resize(1536, 1024, { fit: 'cover' }).png().toBuffer()
  const mobile = await sharp(full).resize(800, 533, { fit: 'cover' }).png().toBuffer()
  await sharp(full).png().toFile(`${basePathNoExt}.png`)
  await sharp(full).webp({ quality: 86 }).toFile(`${basePathNoExt}.webp`)
  await sharp(mobile).png().toFile(`${basePathNoExt}-800.png`)
  await sharp(mobile).webp({ quality: 86 }).toFile(`${basePathNoExt}-800.webp`)
}

async function captureHtml(page, html, selector = '#capture') {
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const el = page.locator(selector)
  return el.screenshot({ type: 'png', omitBackground: true })
}

async function generateOg(heroPngPath) {
  const width = 1200
  const height = 630
  const outputPath = join(heroDir, 'buy-used-gym-equipment-og.png')
  const logoPath = join(root, 'public', 'email', 'equipd-full-logo.png')

  const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#fff8f1"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#1c2638" flood-opacity=".14"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="1120" cy="72" r="180" fill="#ff7a1a" opacity=".09"/>
  <circle cx="1030" cy="590" r="250" fill="#ff7a1a" opacity=".06"/>
  <rect x="610" y="120" width="530" height="400" rx="26" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="610" y="120" width="530" height="400" rx="26" fill="none" stroke="#f0e2d5" stroke-width="2"/>
  <rect x="68" y="514" width="244" height="7" rx="3.5" fill="#f47721"/>
</svg>`)

  const text = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .headline { font: 800 56px Inter, Arial, sans-serif; fill: #172033; letter-spacing: -1.8px; }
    .support { font: 500 26px Inter, Arial, sans-serif; fill: #4b5565; }
    .label { font: 700 19px Inter, Arial, sans-serif; fill: #d85609; letter-spacing: .3px; }
  </style>
  <text x="68" y="214" class="label">THE UK FITNESS EQUIPMENT MARKETPLACE</text>
  <text x="68" y="294" class="headline">Buy Used Gym</text>
  <text x="68" y="362" class="headline">Equipment</text>
  <text x="68" y="426" class="support">Browse listings and pay securely</text>
  <text x="68" y="464" class="support">with Buyer Protection</text>
</svg>`)

  const logo = await sharp(logoPath)
    .resize({ width: 250, height: 70, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const collage = await sharp(heroPngPath)
    .resize({ width: 494, height: 340, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer()

  await sharp(background)
    .composite([
      { input: logo, left: 68, top: 54 },
      { input: collage, left: 628, top: 150 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath)

  return outputPath
}

async function main() {
  await mkdir(journeyDir, { recursive: true })
  await mkdir(heroDir, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 })

  for (const step of [1, 2, 3, 4]) {
    await page.setViewportSize({ width: 1536, height: 1024 })
    const png = await captureHtml(page, journeyHtml(step), '#capture')
    await writeVariants(png, join(journeyDir, `step-${step}`))
    console.log(`wrote journey step-${step}`)
  }

  await page.setViewportSize({ width: 994, height: 759 })
  const heroPng = await captureHtml(page, heroHtml(), '#capture')
  const heroPngPath = join(heroDir, 'buy-used-gym-equipment-marketplace.png')
  await writeFile(heroPngPath, heroPng)
  await sharp(heroPng).webp({ quality: 88 }).toFile(join(heroDir, 'buy-used-gym-equipment-marketplace.webp'))
  console.log('wrote hero artwork')

  const ogPath = await generateOg(heroPngPath)
  console.log(`wrote og ${ogPath}`)

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
