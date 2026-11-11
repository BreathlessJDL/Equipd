#!/usr/bin/env node
/**
 * Mobile conversation layout contracts: persistent composer, independent
 * history scrolling, no app-shell Visual Viewport translation.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const messagesPage = readFileSync('src/pages/MessagesPage.jsx', 'utf8')
const appShellCss = readFileSync('src/components/layout/AppShell.css', 'utf8')
const messagesCss = readFileSync('src/components/Messages.css', 'utf8')
const visualViewport = readFileSync('src/lib/visualViewport.js', 'utf8')

assert.match(messagesPage, /threadBodyRef/)
assert.match(messagesPage, /container\.scrollTop = container\.scrollHeight/)
assert.doesNotMatch(messagesPage, /subscribeVisualViewport/)
assert.doesNotMatch(messagesPage, /scrollIntoView/)
assert.match(messagesPage, /ResizeObserver/)
assert.match(
  messagesPage,
  /className="messages-page__composer-dock"/,
)
assert.match(
  messagesPage,
  /className="messages-page__thread-body"/,
)

assert.doesNotMatch(appShellCss, /translateY\(/)
assert.doesNotMatch(appShellCss, /--equipd-visual-viewport-offset/)
assert.match(
  appShellCss,
  /\.app-shell:has\(\.messages-page--thread-open\)\s*\{[^}]*overflow:\s*hidden/,
)
assert.match(
  appShellCss,
  /\.app-shell:has\(\.messages-page--thread-open\)\s*\{[^}]*min-height:\s*0/,
)
assert.match(
  appShellCss,
  /\.app-shell:has\(\.messages-page--thread-open\) \.app-shell__main--messages[\s\S]*min-height:\s*0/,
)
assert.match(
  appShellCss,
  /\.app-shell__main--messages > \.messages-page--thread-open[\s\S]*min-height:\s*0/,
)

const threadOpenCss = messagesCss.slice(
  messagesCss.indexOf('.messages-page--thread-open {'),
)
assert.match(
  threadOpenCss,
  /\.messages-page--thread-open \.messages-page__thread[\s\S]*min-height:\s*0/,
)
assert.match(
  threadOpenCss,
  /\.messages-page--thread-open \.messages-page__thread-body[\s\S]*overflow-y:\s*auto/,
)
assert.match(
  threadOpenCss,
  /\.messages-page--thread-open \.messages-page__composer-dock[\s\S]*flex-shrink:\s*0/,
)
assert.match(
  threadOpenCss,
  /\.messages-page--thread-open \.messages-page__thread-body[\s\S]*max-height:\s*none/,
)

assert.match(visualViewport, /EQUIPD_VISUAL_VIEWPORT_HEIGHT_VAR/)
assert.doesNotMatch(visualViewport, /EQUIPD_VISUAL_VIEWPORT_OFFSET_VAR/)
assert.doesNotMatch(
  visualViewport,
  /setProperty\(EQUIPD_VISUAL_VIEWPORT_OFFSET/,
)

const desktopLayout = messagesCss.match(
  /@media \(min-width: 768px\) \{[\s\S]*?grid-template-columns: minmax\(18rem, 22rem\)/,
)
assert.ok(desktopLayout, 'desktop two-column inbox layout retained')

console.log('PASS: message thread layout contracts')
