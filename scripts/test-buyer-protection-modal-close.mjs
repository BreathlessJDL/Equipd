/**
 * Buyer Protection modal close control — SVG icon, no corrupted Unicode glyph.
 * Run: node scripts/test-buyer-protection-modal-close.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const jsx = read('src/components/BuyerProtectionModal.jsx')
const css = read('src/components/BuyerProtectionModal.css')
const icon = read('src/components/icons/ModalCloseIcon.jsx')
const authModal = read('src/components/auth/AuthModal.jsx')

assert.match(jsx, /import \{ ModalCloseIcon \} from '\.\/icons\/ModalCloseIcon'/)
assert.match(jsx, /<ModalCloseIcon\s*\/>/)
assert.match(jsx, /aria-label=["']Close Buyer Protection["']/)
assert.match(jsx, /className=["']auth-modal__close buyer-protection-modal__close["']/)

const closeBlock = jsx.match(/buyer-protection-modal__close[\s\S]*?<\/button>/)?.[0] || ''
assert.ok(closeBlock.includes('<ModalCloseIcon'), 'BP close renders ModalCloseIcon')
assert.equal([...closeBlock].some((ch) => ch.codePointAt(0) === 0x251c || ch.codePointAt(0) === 0xf9), false,
  'no box-drawing/ù corruption in close button')
assert.equal([...closeBlock].some((ch) => ch.codePointAt(0) === 0xd7), false,
  'close button does not rely on U+00D7 multiplication sign')

assert.match(icon, /viewBox=["']0 0 24 24["']/)
assert.match(icon, /M6 6l12 12M18 6 6 18/)
assert.match(icon, /aria-hidden=["']true["']/)

assert.match(css, /min-width:\s*44px/)
assert.match(css, /min-height:\s*44px/)
assert.match(css, /\.buyer-protection-modal__close:focus-visible/)

// Shared AuthModal close pattern remains intact for other modals.
assert.match(authModal, /className=["']auth-modal__close["']/)
assert.match(authModal, /aria-label=["']Close["']/)

console.log('buyer-protection-modal-close: ok')
