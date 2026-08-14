#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
//
// Measures cyclomatic complexity and nesting depth for the functions a pull request adds or changes,
// at the head revision and again at the base, and reports which of them trip the thresholds the
// automated reviewer acts on.
//
// The reviewer has no interpreter and must never check out head code, so it cannot run ESLint for
// itself. Tallying `&&`/`??`/`case` by eye across a long function, twice, is the part of that job a
// language model is worst at, and a miscount either invents a finding or silently loses one. So every
// number and every threshold lives here, and the reviewer is left with only the judgement of whether
// a triggered function is genuinely tangled — which is what it is actually good at.
//
// Usage: complexity-report.js <base-sha> <head-sha> <out-file>
//        complexity-report.js --self-check

const assert = require('assert')
const { execFileSync } = require('child_process')
const fs = require('fs')

const COMPLEXITY_THRESHOLD = 12
const COMPLEXITY_BUMP = 5
const DEPTH_THRESHOLD = 4
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|vue)$/
// Keeps a pathological PR from handing the reviewer a report longer than the diff.
const MAX_ENTRIES = 60

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })

/**
 * Line ranges the diff produces in the HEAD version of each file, from a zero-context diff.
 * @param {string} diffText
 * @returns {Map<string, Array<[number, number]>>}
 */
const changedHeadLines = (diffText) => {
  const out = new Map()
  let current = null
  for (const line of diffText.split('\n')) {
    const file = /^\+\+\+ b\/(.*)$/.exec(line)
    if (file) {
      current = file[1]
      if (!out.has(current)) out.set(current, [])
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk || current === null) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    // A pure deletion carries `+n,0` and adds no head line to attribute anything to.
    if (count > 0) out.get(current).push([start, start + count - 1])
  }
  return out
}

const overlaps = (ranges, from, to) => (ranges ?? []).some(([a, b]) => a <= to && b >= from)

const messagesFrom = (result, ruleId) => result.messages.filter((message) => message.ruleId === ruleId)

/**
 * Attributes each `max-depth` site to the innermost function containing it, in place, so a shallow
 * outer function does not inherit the depth of a callback declared inside it.
 * @param {Array<object>} fns Function records for one file.
 * @param {Array<{line: number, depth: number}>} sites
 * @returns {void}
 */
const attributeDepth = (fns, sites) => {
  for (const site of sites) {
    let innermost = null
    for (const fn of fns) {
      if (site.line < fn.line || site.line > fn.endLine) continue
      if (!innermost || fn.endLine - fn.line < innermost.endLine - innermost.line) innermost = fn
    }
    if (!innermost) continue
    innermost.depth = Math.max(innermost.depth, site.depth)
    if (site.depth >= DEPTH_THRESHOLD) innermost.depthLines.push(site.line)
  }
}

/**
 * Reduces raw ESLint results to one record per function, carrying the deepest nesting found inside it.
 * @param {Array<object>} results ESLint result objects for one revision.
 * @param {(filePath: string) => Array<string>} sourceOf Returns the file's lines, used to name functions.
 * @returns {Map<string, Array<object>>} Function records keyed by repository-relative path.
 */
const collect = (results, sourceOf) => {
  const perFile = new Map()
  for (const result of results) {
    const fns = []
    for (const message of messagesFrom(result, 'complexity')) {
      const complexity = Number(/complexity of (\d+)/.exec(message.message)?.[1])
      if (!complexity) continue
      // Depth attribution and the touched test both need the function's whole span, and a head-only
      // range silently reports nothing at all, so refuse to guess at it.
      if (!message.endLine) {
        throw new Error(`ESLint reported no endLine for the function at ${result.relPath}:${message.line}`)
      }
      const lines = sourceOf(result.filePath)
      fns.push({
        name: /'([^']+)'/.exec(message.message)?.[1] ?? null,
        decl: (lines[message.line - 1] ?? '').trim().slice(0, 120),
        line: message.line,
        endLine: message.endLine,
        complexity,
        depth: 0,
        depthLines: [],
      })
    }
    const sites = []
    for (const message of messagesFrom(result, 'max-depth')) {
      const depth = Number(/too deeply \((\d+)\)/.exec(message.message)?.[1])
      if (depth) sites.push({ line: message.line, depth })
    }
    attributeDepth(fns, sites)
    perFile.set(result.relPath, fns)
  }
  return perFile
}

/**
 * Matches a head function to its base counterpart. Named functions match by name; the anonymous
 * arrows that most of this codebase is written as match on their declaration line instead, which is
 * stable unless the signature itself changed. Repeated keys (two `onMounted(async () => {` in one
 * file) are paired in source order. A rename or a reflowed signature loses the key, so an unclaimed
 * base function scoring identically is taken as the counterpart rather than reported as new code.
 * @param {Array<object>} headFns
 * @param {Array<object>} baseFns
 * @returns {Map<object, object|null>} Head record to base record, or null when it did not exist.
 */
const pairWithBase = (headFns, baseFns) => {
  const keyOf = (fn) => fn.name ?? fn.decl
  const pending = new Map()
  for (const fn of baseFns) {
    const key = keyOf(fn)
    if (!pending.has(key)) pending.set(key, [])
    pending.get(key).push(fn)
  }
  const pairs = new Map()
  const unkeyed = []
  for (const fn of headFns) {
    const queue = pending.get(keyOf(fn))
    const base = queue && queue.length ? queue.shift() : null
    pairs.set(fn, base)
    if (!base) unkeyed.push(fn)
  }
  // Mispairing here costs a silence, while leaving a rename unpaired reports inherited complexity as
  // new — the one outcome this report exists to prevent — so the tie goes to pairing.
  const leftover = [...pending.values()].flat()
  for (const fn of unkeyed) {
    const match = leftover.findIndex((base) => base.complexity === fn.complexity && base.depth === fn.depth)
    if (match !== -1) pairs.set(fn, leftover.splice(match, 1)[0])
  }
  return pairs
}

/**
 * The triggers a function trips, as the review guidelines define them. An untouched function trips
 * nothing however high it scores: a PR is never asked to pay down complexity it inherited.
 * @param {object} head
 * @param {object|null} base
 * @param {Array<[number, number]>} ranges Changed head-line ranges for this file.
 * @param {boolean} isNewFile
 * @returns {Array<string>}
 */
const triggersFor = (head, base, ranges, isNewFile) => {
  const triggers = []
  const bodyTouched = isNewFile || overlaps(ranges, head.line, head.endLine)
  if (bodyTouched && head.complexity > COMPLEXITY_THRESHOLD) {
    if (!base) {
      triggers.push(`new-function-above-${COMPLEXITY_THRESHOLD}`)
    } else if (base.complexity <= COMPLEXITY_THRESHOLD) {
      triggers.push(`pushed-above-${COMPLEXITY_THRESHOLD}`)
    } else if (head.complexity - base.complexity >= COMPLEXITY_BUMP) {
      triggers.push(`gained-${head.complexity - base.complexity}-while-already-above-${COMPLEXITY_THRESHOLD}`)
    }
  }
  // Depth fires on its own, and only for a block the diff itself added or deepened — a shallow line
  // added to an already-deep function leaves the depth inherited, so it reports nothing.
  const addedDeepBlock = head.depthLines.some((line) => isNewFile || overlaps(ranges, line, line))
  if (addedDeepBlock) triggers.push(`nested-${DEPTH_THRESHOLD}-or-deeper`)
  return triggers
}

/**
 * Lints one file list at the currently checked-out revision.
 * @param {Array<string>} files Repository-relative paths.
 * @returns {Promise<Map<string, Array<object>>>}
 */
const measure = async (files) => {
  const present = files.filter((file) => fs.existsSync(file))
  if (!present.length) return new Map()
  // Required lazily so `--self-check` runs without an install, the way its siblings under this
  // directory do.
  const { ESLint } = require('eslint')
  const eslint = new ESLint({
    overrideConfig: { rules: { 'complexity': ['warn', 0], 'max-depth': ['warn', 0] } },
    errorOnUnmatchedPattern: false,
    // ESLint 8 ignores dot-directories by default, and every file it skips comes back measured-and-clean
    // — so without this the changed files under `.github/`, this script included, would score nothing.
    ignore: false,
  })
  const results = await eslint.lintFiles(present)
  const cache = new Map()
  const sourceOf = (filePath) => {
    if (!cache.has(filePath)) cache.set(filePath, fs.readFileSync(filePath, 'utf8').split('\n'))
    return cache.get(filePath)
  }
  for (const result of results) result.relPath = result.filePath.replace(`${process.cwd()}/`, '')
  return collect(results, sourceOf)
}

/**
 * The report the reviewer reads: the thresholds that were applied, how much was measured, and one
 * entry per function that tripped something.
 * @param {string} baseSha
 * @param {string} headSha
 * @param {Array<string>} files Every lintable path the diff touches.
 * @param {Set<string>} added Of those, the ones the diff created.
 * @param {Map<string, Array<object>>} headFns Function records at head, from `collect`.
 * @param {Map<string, Array<object>>} baseFns The same at base.
 * @param {Map<string, Array<[number, number]>>} ranges Changed head-line ranges, from `changedHeadLines`.
 * @returns {object}
 */
const buildReport = (baseSha, headSha, files, added, headFns, baseFns, ranges) => {
  const triggered = []
  let measured = 0
  for (const [file, fns] of headFns) {
    const pairs = pairWithBase(fns, baseFns.get(file) ?? [])
    for (const fn of fns) {
      measured += 1
      const base = pairs.get(fn) ?? null
      const triggers = triggersFor(fn, base, ranges.get(file), added.has(file))
      if (!triggers.length) continue
      triggered.push({
        file,
        line: fn.line,
        endLine: fn.endLine,
        name: fn.name ?? fn.decl,
        complexity: fn.complexity,
        baseComplexity: base ? base.complexity : null,
        depth: fn.depth,
        baseDepth: base ? base.depth : null,
        triggers,
      })
    }
  }
  triggered.sort((a, b) => b.complexity - a.complexity || b.depth - a.depth)
  return {
    base: baseSha,
    head: headSha,
    thresholds: { complexity: COMPLEXITY_THRESHOLD, bump: COMPLEXITY_BUMP, depth: DEPTH_THRESHOLD },
    changedFiles: files.length,
    functionsMeasured: measured,
    triggeredCount: triggered.length,
    truncated: triggered.length > MAX_ENTRIES,
    triggered: triggered.slice(0, MAX_ENTRIES),
  }
}

const main = async (baseSha, headSha, outFile) => {
  // pull_request.base.sha is the base-branch tip, so a two-dot diff against it would blame this PR
  // for everything that landed on the base after we branched.
  const mergeBase = git(['merge-base', baseSha, headSha]).trim()
  const files = git(['diff', '--name-only', mergeBase, headSha])
    .split('\n')
    .filter((file) => file && LINTABLE.test(file))
  // `--name-only` prints only the post-image of a rename, so measuring the base at those paths
  // would skip the file and report every function that moved with it as new.
  const renamedFrom = new Map(
    git(['diff', '--name-status', '--find-renames', mergeBase, headSha])
      .split('\n')
      .filter((line) => line.startsWith('R'))
      .map((line) => line.split('\t'))
      .map(([, from, to]) => [to, from])
  )
  const added = new Set(
    git(['diff', '--name-status', '--diff-filter=A', mergeBase, headSha])
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t').pop())
  )
  // Both sides of a rename have to be in the pathspec, or git has no pre-image to detect it against
  // and the moved file comes back as one whole-file hunk.
  const rangeArgs = ['diff', '-U0', '--find-renames', mergeBase, headSha, '--', ...files, ...renamedFrom.values()]
  const ranges = files.length ? changedHeadLines(git(rangeArgs)) : new Map()

  let report
  if (!files.length) {
    report = buildReport(mergeBase, headSha, files, added, new Map(), new Map(), ranges)
  } else {
    git(['checkout', '--detach', '--force', headSha])
    const headFns = await measure(files)
    git(['checkout', '--detach', '--force', mergeBase])
    const basePaths = [...new Set(files.map((file) => renamedFrom.get(file) ?? file))]
    const measuredBase = await measure(basePaths)
    const baseFns = new Map()
    for (const file of files) {
      const from = renamedFrom.get(file) ?? file
      const fns = measuredBase.get(from)
      if (fns) baseFns.set(file, fns)
    }
    report = buildReport(mergeBase, headSha, files, added, headFns, baseFns, ranges)
  }

  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`${report.changedFiles} lintable file(s) changed, ${report.functionsMeasured} function(s) measured`)
  console.log(`${report.triggeredCount} function(s) tripped a threshold`)
  for (const entry of report.triggered) {
    const was = entry.baseComplexity === null ? 'new' : `was ${entry.baseComplexity}`
    console.log(
      `  cc ${entry.complexity} (${was}), depth ${entry.depth}  ${entry.file}:${entry.line}  ${
        entry.name
      }  [${entry.triggers.join(', ')}]`
    )
  }
}

const selfCheck = () => {
  const hunks = changedHeadLines(
    [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,2 +1,3 @@',
      '@@ -40 +41 @@',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -9,4 +10,0 @@',
    ].join('\n')
  )
  assert.deepStrictEqual(
    hunks.get('src/a.ts'),
    [
      [1, 3],
      [41, 41],
    ],
    'hunk ranges, including a countless single-line hunk'
  )
  assert.deepStrictEqual(hunks.get('src/b.ts'), [], 'a pure deletion contributes no head range')

  const results = [
    {
      relPath: 'src/a.ts',
      filePath: '/repo/src/a.ts',
      messages: [
        { ruleId: 'complexity', message: "Function 'outer' has a complexity of 9.", line: 1, endLine: 20 },
        { ruleId: 'complexity', message: 'Arrow function has a complexity of 3.', line: 5, endLine: 9 },
        { ruleId: 'max-depth', message: 'Blocks are nested too deeply (4). Maximum allowed is 0.', line: 6 },
        { ruleId: 'no-console', message: 'ignored', line: 2 },
      ],
    },
  ]
  const lines = ['function outer() {', '', '', '', '  const inner = () => {', '', '', '', '  }', ''].concat(
    Array(12).fill('')
  )
  const collected = collect(results, () => lines)
  const [outer, inner] = collected.get('src/a.ts')
  assert.strictEqual(outer.complexity, 9, 'complexity is read off the message')
  assert.strictEqual(outer.name, 'outer', 'a named function keeps its name')
  assert.strictEqual(inner.name, null, 'an arrow function has no name')
  assert.strictEqual(inner.decl, 'const inner = () => {', 'an arrow is identified by its declaration line')
  assert.strictEqual(inner.depth, 4, 'depth lands on the innermost enclosing function')
  assert.strictEqual(outer.depth, 0, "an outer function does not inherit a callback's depth")

  const mk = (over) => ({ line: 1, endLine: 9, name: 'f', decl: 'f', complexity: over, depth: 0, depthLines: [] })
  const touched = [[3, 4]]
  assert.deepStrictEqual(
    triggersFor(mk(13), null, touched, false),
    ['new-function-above-12'],
    'a new function above the threshold'
  )
  assert.deepStrictEqual(
    triggersFor(mk(13), mk(12), touched, false),
    ['pushed-above-12'],
    'pushed from the threshold to above it'
  )
  assert.deepStrictEqual(
    triggersFor(mk(20), mk(15), touched, false),
    ['gained-5-while-already-above-12'],
    'a big gain on an already-complex function'
  )
  assert.deepStrictEqual(
    triggersFor(mk(17), mk(15), touched, false),
    [],
    'the performUndo case: +2 on a function already above the threshold is silent'
  )
  assert.deepStrictEqual(
    triggersFor(mk(59), mk(59), [[400, 400]], false),
    [],
    'an untouched function is silent at any value'
  )
  assert.deepStrictEqual(triggersFor(mk(3), null, touched, true), [], 'a new file is not a trigger on its own')

  const deep = { line: 1, endLine: 9, name: 'g', decl: 'g', complexity: 4, depth: 5, depthLines: [4] }
  assert.deepStrictEqual(
    triggersFor(deep, deep, touched, false),
    ['nested-4-or-deeper'],
    'depth fires on its own, below the complexity threshold'
  )
  const inherited = { ...deep, depthLines: [8] }
  assert.deepStrictEqual(
    triggersFor(inherited, inherited, touched, false),
    [],
    'depth the diff did not add is inherited and silent'
  )

  const pairs = pairWithBase(
    [
      { name: null, decl: 'onMounted(async () => {', complexity: 5 },
      { name: null, decl: 'onMounted(async () => {', complexity: 6 },
    ],
    [{ name: null, decl: 'onMounted(async () => {', complexity: 4 }]
  )
  const paired = [...pairs.values()]
  assert.strictEqual(paired[0].complexity, 4, 'repeated declaration lines pair in source order')
  assert.strictEqual(paired[1], null, 'the second one has no counterpart left to pair with')

  const renamed = { ...mk(30), name: 'renamedTangle' }
  const renamedPair = pairWithBase([renamed], [{ ...mk(30), name: 'tangle' }])
  assert.strictEqual(renamedPair.get(renamed).name, 'tangle', 'an identical score pairs a renamed function')
  assert.deepStrictEqual(
    triggersFor(renamed, renamedPair.get(renamed), touched, false),
    [],
    'so a rename does not report inherited complexity as new'
  )

  console.log('all cases passed')
}

const [, , first, second, third] = process.argv
if (first === '--self-check') {
  selfCheck()
} else if (!first || !second || !third) {
  console.error('usage: complexity-report.js <base-sha> <head-sha> <out-file> | --self-check')
  process.exit(1)
} else {
  main(first, second, third).catch((error) => {
    console.error(`::error::complexity report failed: ${error.message}`)
    process.exit(1)
  })
}
