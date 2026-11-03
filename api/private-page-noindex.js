import { renderPrivateEditListingGoneHtml } from '../src/lib/privatePageNoindex.js'

export default function handler(req, res) {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(renderPrivateEditListingGoneHtml())
}
