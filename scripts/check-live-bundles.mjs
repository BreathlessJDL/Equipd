#!/usr/bin/env node
/** Compare bundles on equipd.co.uk vs www.equipd.co.uk */
for (const url of ['https://equipd.co.uk/', 'https://www.equipd.co.uk/']) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const html = await res.text()
    const match = html.match(/\/assets\/(index-[^"]+\.js)/)
    const bundle = match?.[1]
    let hasPublish = null
    if (bundle) {
      const jsUrl = new URL(`/assets/${bundle}`, res.url).href
      const js = await fetch(jsUrl).then((r) => r.text())
      hasPublish = js.includes('Publish listing')
    }
    console.log({ requested: url, finalUrl: res.url, bundle, hasPublish })
  } catch (e) {
    console.log({ requested: url, error: e.message })
  }
}
