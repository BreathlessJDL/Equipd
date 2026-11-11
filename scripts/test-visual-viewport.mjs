#!/usr/bin/env node
/**
 * Visual Viewport helpers + mobile thread composer layout contracts.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  EQUIPD_KEYBOARD_INSET_VAR,
  EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR,
  EQUIPD_VISUAL_VIEWPORT_OFFSET_VAR,
  applyVisualViewportCssVars,
  clearVisualViewportCssVars,
  readVisualViewportMetrics,
} from '../src/lib/visualViewport.js'

function createRoot() {
  const props = new Map()
  return {
    style: {
      setProperty(name, value) {
        props.set(name, value)
      },
      removeProperty(name) {
        props.delete(name)
      },
      getPropertyValue(name) {
        return props.get(name)
      },
    },
    props,
  }
}

const closedKeyboardWindow = {
  innerHeight: 844,
  visualViewport: { height: 844, offsetTop: 0 },
}

const openKeyboardWindow = {
  innerHeight: 844,
  visualViewport: { height: 520, offsetTop: 0 },
}

const closed = readVisualViewportMetrics(closedKeyboardWindow)
assert.equal(closed.height, 844)
assert.equal(closed.offsetTop, 0)
assert.equal(closed.keyboardInset, 0)

const open = readVisualViewportMetrics(openKeyboardWindow)
assert.equal(open.height, 520)
assert.equal(open.keyboardInset, 324)

const root = createRoot()
applyVisualViewportCssVars(openKeyboardWindow, root)
assert.equal(root.props.get(EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR), '520px')
assert.equal(root.props.get(EQUIPD_VISUAL_VIEWPORT_OFFSET_VAR), '0px')
assert.equal(root.props.get(EQUIPD_KEYBOARD_INSET_VAR), '324px')
clearVisualViewportCssVars(root)
assert.equal(root.props.size, 0)

const appShellCss = readFileSync('src/components/layout/AppShell.css', 'utf8')
assert.match(appShellCss, /--equipd-visual-viewport-height/)
assert.match(appShellCss, /--equipd-visual-viewport-offset/)
assert.doesNotMatch(
  appShellCss.replace(/var\(--equipd-visual-viewport-height,\s*100dvh\)/g, ''),
  /\.app-shell:has\(\.messages-page--thread-open\)\s*\{[^}]*height:\s*100dvh/,
)

const messagesCss = readFileSync('src/components/Messages.css', 'utf8')
assert.match(messagesCss, /messages-page__thread-body/)
assert.match(messagesCss, /overflow-y:\s*auto/)
assert.match(messagesCss, /--equipd-keyboard-inset/)
assert.match(
  messagesCss,
  /\.messages-page--thread-open \.messages-page__composer-dock \.messages-page__composer[\s\S]*padding-bottom:\s*0\.55rem/,
)

const composerCss = readFileSync('src/components/messages/MessageThreadComposer.css', 'utf8')
assert.match(composerCss, /align-items:\s*flex-end/)
assert.match(composerCss, /align-self:\s*flex-end/)

const indexHtml = readFileSync('index.html', 'utf8')
assert.match(indexHtml, /viewport-fit=cover/)
assert.match(indexHtml, /interactive-widget=resizes-content/)

const appShell = readFileSync('src/components/layout/AppShell.jsx', 'utf8')
assert.match(appShell, /subscribeVisualViewport/)

console.log('PASS: visual viewport + mobile composer layout')
