import { resolveResearchEngine } from './intelligenceEquipmentResearchEngine.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

assert(resolveResearchEngine('fast') === 'fast', 'explicit fast')
assert(resolveResearchEngine('v3') === 'v3', 'explicit v3')
assert(resolveResearchEngine('v2') === 'v2', 'explicit v2')
assert(resolveResearchEngine(undefined) === 'fast', 'missing defaults to fast')
assert(resolveResearchEngine(null) === 'fast', 'null defaults to fast')
assert(resolveResearchEngine('') === 'fast', 'empty defaults to fast')
assert(resolveResearchEngine('FAST') === 'fast', 'case insensitive fast')
assert(resolveResearchEngine('unknown') === 'fast', 'unknown defaults to fast')

console.log('equipment research engine resolver tests passed')
