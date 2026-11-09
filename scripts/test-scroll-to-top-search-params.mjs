#!/usr/bin/env node
/**
 * Homepage browse filters must not reset window scroll on same-path URL updates.
 *
 *   node scripts/test-scroll-to-top-search-params.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldResetWindowScrollOnRouteChange } from '../src/lib/scrollToTop.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/',
    nextPathname: '/',
    hash: '',
    navigationType: 'PUSH',
  }) === false,
  'same-path search-param navigation does not scroll to top',
)

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/',
    nextPathname: '/',
    hash: '',
    navigationType: 'POP',
  }) === false,
  'POP on the homepage does not force scroll to top',
)

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/',
    nextPathname: '/about',
    hash: '',
    navigationType: 'PUSH',
  }) === true,
  'real page navigation still scrolls to top',
)

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/browse',
    nextPathname: '/',
    hash: '',
    navigationType: 'PUSH',
  }) === true,
  'browse to homepage still scrolls to top',
)

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/about',
    nextPathname: '/help',
    hash: '',
    navigationType: 'POP',
  }) === false,
  'back/forward does not steal restored scroll',
)

assert(
  shouldResetWindowScrollOnRouteChange({
    previousPathname: '/help',
    nextPathname: '/help',
    hash: '#refunds',
    navigationType: 'PUSH',
  }) === false,
  'hash navigation is skipped',
)
logPass('Scroll-to-top rules preserve homepage filter position')

const homeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/HomePage.jsx'),
  'utf8',
)
assert(
  homeSource.includes('revealBrowseAnchorIfOffscreen'),
  'homepage filter apply does not force a browse-anchor jump while the section is on screen',
)
assert(
  !homeSource.includes('useBrowseScrollAfterFilterChange'),
  'homepage no longer uses the URL-sync scroll-to-anchor hook',
)
logPass('Homepage filter apply preserves in-view scroll')

const scrollToTopSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/routing/ScrollToTop.jsx'),
  'utf8',
)
assert(
  scrollToTopSource.includes('shouldResetWindowScrollOnRouteChange'),
  'ScrollToTop uses the pathname-aware helper',
)
logPass('ScrollToTop is wired to the helper')

console.log('All homepage filter scroll tests passed.')
