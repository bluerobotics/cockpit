/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const allowlistPath = fileURLToPath(new URL('./import-cycles-allowlist.json', import.meta.url))

/**
 * Finds the import cycles of a module graph, as its strongly connected components (Tarjan's algorithm).
 * @param {Map<string, string[]>} graph - Static imports of each module
 * @returns {string[][]} Every group of modules that import each other in a loop, each group and the list sorted
 */
export const findImportCycles = (graph) => {
  const index = new Map()
  const lowLink = new Map()
  const stack = []
  const onStack = new Set()
  const cycles = []

  const visit = (module) => {
    index.set(module, index.size)
    lowLink.set(module, index.get(module))
    stack.push(module)
    onStack.add(module)
    for (const imported of graph.get(module) ?? []) {
      if (!index.has(imported)) {
        visit(imported)
        lowLink.set(module, Math.min(lowLink.get(module), lowLink.get(imported)))
      } else if (onStack.has(imported)) {
        lowLink.set(module, Math.min(lowLink.get(module), index.get(imported)))
      }
    }
    if (lowLink.get(module) !== index.get(module)) return
    const group = []
    let member
    do {
      member = stack.pop()
      onStack.delete(member)
      group.push(member)
    } while (member !== module)
    if (group.length > 1) cycles.push(group.sort())
  }

  for (const module of graph.keys()) if (!index.has(module)) visit(module)
  return cycles.sort((a, b) => a[0].localeCompare(b[0]))
}

/**
 * Compares the cycles found against the allowlisted ones. Matching is by exact membership, so a cycle that shrinks
 * must have its entry shrunk too, and the modules that left it cannot loop again unnoticed.
 * @param {string[][]} cycles - Cycles found in the build
 * @param {string[][]} allowed - Cycles listed in the allowlist
 * @returns {{ newCycles: string[][], staleEntries: string[][] }} Found cycles with no entry, and entries with no cycle
 */
export const compareWithAllowlist = (cycles, allowed) => {
  const sameSet = (a, b) => a.length === b.length && a.every((file) => b.includes(file))
  return {
    newCycles: cycles.filter((group) => !allowed.some((entry) => sameSet(group, entry))),
    staleEntries: allowed.filter((entry) => !cycles.some((group) => sameSet(group, entry))),
  }
}

/**
 * Fails the build when `src/` gains an import cycle that is not in `import-cycles-allowlist.json`. Modules in a cycle
 * can read each other's exports before they are initialized, so whether Cockpit boots depends on which module of the
 * loop happens to load first.
 * @param {string} rootDir - Repository root, which the allowlisted paths are relative to
 * @returns {import('vite').Plugin} The Vite plugin
 */
export const importCycleGuard = (rootDir) => ({
  name: 'cockpit-import-cycle-guard',
  apply: 'build',
  buildEnd(error) {
    if (error) return
    // Vite hands out module ids with forward slashes on every platform, Windows included.
    const root = rootDir.split(path.sep).join('/')
    const srcDir = `${root}/src/`
    const fileOf = (id) => id.split('?')[0]

    // Rollup lists only static imports here, after type-only ones were erased, so this is the graph that runs.
    const graph = new Map()
    for (const id of this.getModuleIds()) {
      const file = fileOf(id)
      if (!file.startsWith(srcDir)) continue
      const imports = graph.get(file) ?? []
      for (const imported of this.getModuleInfo(id).importedIds) {
        const importedFile = fileOf(imported)
        if (importedFile.startsWith(srcDir) && importedFile !== file) imports.push(importedFile)
      }
      graph.set(file, imports)
    }

    const cycles = findImportCycles(graph).map((group) => group.map((file) => file.slice(root.length + 1)))
    const allowed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
    const { newCycles, staleEntries } = compareWithAllowlist(cycles, allowed)

    const list = (groups) => groups.map((group) => `  - ${group.join('\n    ')}`).join('\n')
    const problems = []
    if (newCycles.length > 0) {
      problems.push(
        `New import cycle in src/, which can crash Cockpit at startup with "Cannot access '...' before initialization":\n` +
          `${list(newCycles)}\n` +
          'Break it by moving what both sides need into a module that imports neither, or by loading one side with a ' +
          'dynamic import().'
      )
    }
    if (staleEntries.length > 0) {
      const staleListing = list(staleEntries)
      problems.push(
        'These entries in scripts/import-cycles-allowlist.json no longer match a cycle exactly. Delete them, or ' +
          `replace one with the smaller cycle it shrank into:\n${staleListing}`
      )
    }
    if (problems.length > 0) this.error(problems.join('\n\n'))
  },
})

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--self-check')) {
  const graph = new Map([
    ['a', ['b']],
    ['b', ['c', 'd']],
    ['c', ['a']],
    ['d', ['e']],
    ['e', ['d']],
    ['f', ['a']],
  ])
  assert.deepEqual(findImportCycles(graph), [
    ['a', 'b', 'c'],
    ['d', 'e'],
  ])
  assert.deepEqual(findImportCycles(new Map([['a', ['b']]])), [])
  assert.deepEqual(compareWithAllowlist([['a', 'b']], [['b', 'a']]), { newCycles: [], staleEntries: [] })
  assert.deepEqual(compareWithAllowlist([['a', 'b']], [['a', 'b', 'c']]), {
    newCycles: [['a', 'b']],
    staleEntries: [['a', 'b', 'c']],
  })
  assert.deepEqual(compareWithAllowlist([], [['a', 'b']]), { newCycles: [], staleEntries: [['a', 'b']] })
  console.log('import-cycles self-check passed')
}
