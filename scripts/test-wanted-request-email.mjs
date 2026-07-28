/**
 * Local unit checks for wanted-request email formatting + template wiring.
 * Does not call SendGrid or deploy anything.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_REQUIRED_FIELDS,
} from '../supabase/functions/_shared/emailTemplateConfig.js'
import {
  buildEquipmentRequestEmailDynamicData,
  buildEquipmentRequestIdempotencyKey,
  formatWantedRequestBudgetGbp,
  formatWantedRequestCondition,
  formatWantedRequestEquipmentName,
  formatWantedRequestRadius,
  sanitizeWantedRequestPlainText,
} from '../supabase/functions/_shared/wantedRequestEmail.js'

assert.equal(EMAIL_TEMPLATE_KEYS.equipment_request, 'SENDGRID_TEMPLATE_EQUIPMENT_REQUEST')
assert.deepEqual(EMAIL_TEMPLATE_REQUIRED_FIELDS.equipment_request, [
  'subject',
  'preheader',
  'title',
])

assert.equal(formatWantedRequestBudgetGbp(4000), '£4,000')
assert.equal(formatWantedRequestBudgetGbp(4000.5), '£4,000.50')
assert.equal(formatWantedRequestBudgetGbp(null), '')
assert.equal(formatWantedRequestRadius('25'), '25 miles')
assert.equal(formatWantedRequestRadius('nationwide'), 'Nationwide')
assert.equal(formatWantedRequestCondition('used_excellent'), 'Used – Excellent')
assert.equal(
  sanitizeWantedRequestPlainText('<b>Need soon</b>\r\nPlease call'),
  'Need soon\nPlease call',
)

assert.equal(
  formatWantedRequestEquipmentName({
    entryMode: 'catalogue',
    productName: 'Life Fitness Platinum Club Series Treadmill',
    brand: 'Life Fitness',
  }),
  'Life Fitness Platinum Club Series Treadmill',
)

assert.equal(
  formatWantedRequestEquipmentName({
    entryMode: 'manual',
    manualBrand: 'TechnoGym',
    manualModelName: 'Run Artis',
  }),
  'TechnoGym Run Artis',
)

assert.equal(
  formatWantedRequestEquipmentName({
    entryMode: 'manual',
    manualBrand: 'TechnoGym',
    manualModelName: 'TechnoGym Run Artis',
  }),
  'TechnoGym Run Artis',
)

const getEnv = () => ''
const sharedPayload = {
  entryMode: 'catalogue',
  productName: 'Peloton Bike+',
  brand: 'Peloton',
  location: 'Manchester',
  radius: '50',
  maximumBudget: 2500,
  conditionPreference: 'used_good',
  notes: '<script>alert(1)</script>Need delivery',
}

const buyer = buildEquipmentRequestEmailDynamicData({
  payload: sharedPayload,
  profile: { display_name: 'Jordan Smith' },
  buyerEmail: 'jordan@example.com',
  recipientType: 'buyer',
  getEnv,
})

assert.equal(buyer.subject, "We've received your wanted equipment request")
assert.equal(buyer.title, "We've received your wanted equipment request")
assert.equal(buyer.first_name, 'Jordan')
assert.equal(buyer.equipment_name, 'Peloton Bike+')
assert.equal(buyer.location, 'Manchester')
assert.equal(buyer.radius, '50 miles')
assert.equal(buyer.maximum_budget, '£2,500')
assert.equal(buyer.condition_preference, 'Used – Good')
assert.equal(buyer.notes, 'Need delivery')
assert.equal(buyer.cta_text, 'View my wanted requests')
assert.equal(buyer.cta_url, 'https://www.equipd.co.uk/wanted')
assert.equal(buyer.secondary_text, 'Browse equipment')
assert.equal(buyer.secondary_url, 'https://www.equipd.co.uk/browse')
assert.equal(buyer.base_url, 'https://www.equipd.co.uk')
assert.equal(buyer.logo_url, 'https://equipd.co.uk/email/equipd-full-logo.png')
assert.equal(buyer.tagline, 'The marketplace for used gym equipment')
assert.equal(Object.hasOwn(buyer, 'buyer_email'), false)
assert.match(String(buyer.year), /^\d{4}$/)

const support = buildEquipmentRequestEmailDynamicData({
  payload: sharedPayload,
  profile: { display_name: 'Jordan Smith' },
  buyerEmail: 'jordan@example.com',
  recipientType: 'support',
  getEnv,
})

assert.equal(support.subject, 'New wanted request: Peloton Bike+')
assert.equal(support.title, 'New wanted equipment request')
assert.equal(support.buyer_email, 'jordan@example.com')
assert.equal(support.cta_text, '')
assert.equal(support.cta_url, '')
assert.equal(support.secondary_text, '')
assert.equal(support.secondary_url, '')

assert.equal(
  buildEquipmentRequestIdempotencyKey('buyer', 'abc'),
  'equipment_request:buyer:abc',
)
assert.equal(
  buildEquipmentRequestIdempotencyKey('support', 'abc'),
  'equipment_request:support:abc',
)

const fnSource = readFileSync(
  join(process.cwd(), 'supabase/functions/create-wanted-request/index.ts'),
  'utf8',
)
assert.match(fnSource, /sendWantedRequestEmail/)
assert.match(fnSource, /EQUIPMENT_REQUEST_TEMPLATE_KEY/)
assert.match(fnSource, /recipientType: 'buyer'/)
assert.match(fnSource, /recipientType: 'support'/)
assert.match(fnSource, /reserveEmailLog/)
assert.match(fnSource, /SENDGRID_TEMPLATE_EQUIPMENT_REQUEST/)

const configSource = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf8')
assert.match(configSource, /\[functions\.create-wanted-request\]/)

const modalSource = readFileSync(
  join(process.cwd(), 'src/components/wanted/WantedRequestModal.jsx'),
  'utf8',
)
assert.match(modalSource, /createWantedRequest/)
assert.doesNotMatch(modalSource, /UI-only stage/)

const clientLib = readFileSync(join(process.cwd(), 'src/lib/wantedRequests.js'), 'utf8')
assert.match(clientLib, /create-wanted-request/)
assert.doesNotMatch(clientLib, /VITE_SENDGRID|SENDGRID_API_KEY/)

console.log('test-wanted-request-email: ok')
