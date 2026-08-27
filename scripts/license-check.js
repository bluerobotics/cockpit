#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

/**
 * License policy gate for the resolved npm dependency tree.
 *
 * Gates the tree against `license-policy.json`: every package whose license is not on the allowlist has
 * to be recorded under `acknowledged`, so a newly added copyleft, custom or unlicensed dependency fails
 * while the known intentional ones (FFmpeg's GPL siblings, GSAP, marchingsquares) stay quiet.
 * `--self-check` exercises the verdict logic.
 *
 * The tree comes from `yarn licenses list`, which resolves it from `yarn.lock` rather than from whatever
 * happens to be in `node_modules`, so the answer does not drift with a stale install.
 *
 * Yarn's production tree is not the same set as what reaches a user, so the policy's `distributed` key
 * names the dev-tree packages whose code ships anyway: the Electron runtime, and the workbox subtree that
 * `vite-plugin-pwa` compiles into the service worker in `dist/`.
 */

const POLICY_PATH = path.join(__dirname, 'license-policy.json')

/**
 * Whole-string match, or a prefix match when the pattern ends in `*`.
 * @param {string} pattern A license id, optionally ending in `*`.
 * @param {string} value
 * @returns {boolean}
 */
function matchesPattern(pattern, value) {
  return pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : pattern === value
}

/**
 * Split an SPDX expression into its license ids, dropping the operators and parentheses.
 * @param {string} expression
 * @returns {string[]}
 */
function licenseIds(expression) {
  return expression
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !['AND', 'OR'].includes(token.toUpperCase()))
}

const SEVERITY = { allowed: 0, review: 1, blocked: 2 }

/**
 * Classify a single license id. Anything the policy does not recognize needs review rather than
 * silently passing, since an unrecognized identifier is as unresolved as a missing one.
 * @param {string} id
 * @param {object} policy
 * @returns {'allowed'|'review'|'blocked'}
 */
function tierOfId(id, policy) {
  if (policy.allowed.some((pattern) => matchesPattern(pattern, id))) return 'allowed'
  if (policy.blocked.some((pattern) => matchesPattern(pattern, id))) return 'blocked'
  return 'review'
}

/**
 * Classify a license expression as reported by npm metadata. A whole-string match wins, so a custom
 * license whose text happens to contain "or" is not mistaken for an SPDX choice. Otherwise an `OR`
 * expression takes its most permissive arm, because the recipient may choose it, while everything else
 * takes its least permissive one.
 * @param {string} expression
 * @param {object} policy
 * @returns {'allowed'|'review'|'blocked'}
 */
function tierOf(expression, policy) {
  // yarn marks a license it read from the package's LICENSE file, rather than from its `license` field,
  // with a trailing asterisk. That reading is the more trustworthy of the two, so keep the identifier.
  const value = expression.trim().replace(/\*$/, '')
  for (const key of ['allowed', 'blocked', 'review']) {
    if (policy[key].some((pattern) => matchesPattern(pattern, value))) return key
  }

  if (!/\b(AND|OR)\b/i.test(value)) return 'review'

  const tiers = licenseIds(value).map((id) => tierOfId(id, policy))
  if (/\bOR\b/i.test(value) && tiers.includes('allowed')) return 'allowed'
  return tiers.reduce((worst, tier) => (SEVERITY[tier] > SEVERITY[worst] ? tier : worst), 'allowed')
}

/**
 * Resolve the dependency tree through yarn. `--production` narrows it to the packages installed alongside
 * the application; the full tree is everything, build tooling included.
 * @param {boolean} productionOnly
 * @returns {{name: string, version: string, license: string, url: string, vendorUrl: string, vendorName: string}[]}
 */
function resolveTree(productionOnly) {
  const args = ['licenses', 'list', '--json', '--no-progress']
  if (productionOnly) args.push('--production')

  // execFileSync does no PATHEXT resolution, and on Windows yarn is a `.cmd` shim.
  const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn'

  let stdout
  try {
    stdout = execFileSync(yarn, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    throw new Error(`Could not resolve the dependency tree with \`yarn ${args.join(' ')}\`: ${error.message}`)
  }

  const table = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .find((entry) => entry.type === 'table')
  if (!table) throw new Error('`yarn licenses list` returned no package table.')

  const columns = table.data.head.map((name) => name.toLowerCase())
  return table.data.body.map((row) => Object.fromEntries(columns.map((name, index) => [name, row[index]])))
}

/**
 * Whether a package's code reaches a user: either it is in the production tree, or a build plugin
 * compiles it into what ships.
 * @param {{name: string, version: string}} pkg
 * @param {Set<string>} productionKeys `name@version` for every package of the production tree.
 * @param {object} policy
 * @returns {boolean}
 */
function isDistributed(pkg, productionKeys, policy) {
  if (productionKeys.has(`${pkg.name}@${pkg.version}`)) return true
  return policy.distributed.some((pattern) => matchesPattern(pattern, pkg.name))
}

/**
 * Merge both trees into one inventory, applying the policy's license corrections and marking which
 * packages are distributed.
 * @param {object} policy
 * @returns {{name: string, version: string, license: string, reported: string, distributed: boolean, url: string, acknowledged: object|null, tier: string}[]}
 */
function buildInventory(policy) {
  const productionKeys = new Set(resolveTree(true).map((pkg) => `${pkg.name}@${pkg.version}`))

  return resolveTree(false).map((pkg) => {
    const acknowledged = policy.acknowledged[pkg.name] ?? null
    const license = acknowledged?.actual ?? pkg.license
    return {
      name: pkg.name,
      version: pkg.version,
      license,
      reported: pkg.license,
      distributed: isDistributed(pkg, productionKeys, policy),
      url: pkg.url,
      acknowledged,
      tier: tierOf(license, policy),
    }
  })
}

/**
 * Why an acknowledgement no longer describes the package that is installed, or null while it still does.
 * The recorded `version` is what re-asks the question for an entry whose decision was read out of the
 * package's license file, since that reading is invisible to the npm metadata the license comparison
 * watches and only ever held for the version it was read at.
 * @param {object} pkg
 * @returns {string|null}
 */
function staleReason(pkg) {
  const entry = pkg.acknowledged
  if (!entry) return null
  if (entry.license !== pkg.reported) return `reviewed as "${entry.license}", now reports "${pkg.reported}"`
  if (entry.version && entry.version !== pkg.version) {
    return `reviewed at version ${entry.version}, now resolves to ${pkg.version}`
  }
  return null
}

/**
 * Sort the findings into the ones that fail the gate and the ones that only warn. A finding on a package
 * that cannot reach the application warns, whether it is an unreviewed license or a stale acknowledgement.
 * @param {object[]} inventory
 * @returns {{failures: object[], warnings: object[], staleFailures: object[], staleWarnings: object[]}}
 */
function verdict(inventory) {
  const unacknowledged = inventory.filter((pkg) => pkg.tier !== 'allowed' && !pkg.acknowledged)
  // Over every acknowledged package, not just the flagged ones: an entry that corrects a wrong license
  // through `actual` makes its package look allowed, which would otherwise hide a later upstream change.
  const stale = inventory.filter((pkg) => staleReason(pkg))

  return {
    failures: unacknowledged.filter((pkg) => pkg.distributed),
    warnings: unacknowledged.filter((pkg) => !pkg.distributed),
    staleFailures: stale.filter((pkg) => pkg.distributed),
    staleWarnings: stale.filter((pkg) => !pkg.distributed),
  }
}

/**
 * Gate the tree against the policy. Findings on distributed packages fail; findings that only exist in
 * build tooling warn, since they never reach a user. Returns the process exit code.
 * @param {object[]} inventory
 * @returns {number}
 */
function check(inventory) {
  const { failures, warnings, staleFailures, staleWarnings } = verdict(inventory)

  const describe = (pkg) => `${pkg.name}@${pkg.version} — ${pkg.tier.toUpperCase()}: ${pkg.reported}`
  const buildOnly = '(build tooling only, does not reach the application)'

  for (const pkg of warnings) {
    console.warn(`Warning: ${describe(pkg)} ${buildOnly}`)
  }

  for (const pkg of staleWarnings) {
    console.warn(`Warning: review of ${pkg.name}@${pkg.version} is stale: ${staleReason(pkg)} ${buildOnly}`)
  }

  for (const pkg of staleFailures) {
    console.error(`Recorded review is stale for ${pkg.name}@${pkg.version}:`)
    console.error(`  ${staleReason(pkg)}.`)
    console.error('  Re-review it and update scripts/license-policy.json.')
  }

  for (const pkg of failures) {
    console.error(`Error: ${describe(pkg)}`)
    console.error(`  ${pkg.url}`)
  }

  const acknowledgedCount = inventory.filter((pkg) => pkg.acknowledged).length
  const warningCount = warnings.length + staleWarnings.length
  const failureCount = failures.length + staleFailures.length
  console.log(
    `Checked ${inventory.length} packages against scripts/license-policy.json: ` +
      `${acknowledgedCount} reviewed, ${warningCount} build-only warnings, ${failureCount} failures.`
  )

  if (failureCount > 0) {
    console.error('')
    console.error('A dependency reaching the application has a license that has not been reviewed.')
    console.error('Record the decision in scripts/license-policy.json and document it in THIRD-PARTY-NOTICES.md,')
    console.error('or drop the dependency. Do not widen the allowlist to make this pass.')
    return 1
  }
  return 0
}

/**
 * Assert the verdict logic against the expressions this repository actually resolves, so a change to the
 * matching rules cannot quietly start passing a copyleft license.
 * @returns {void}
 */
function selfCheck() {
  const { strict: assert } = require('assert')
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'))
  const cases = [
    ['MIT', 'allowed'],
    // yarn read this one out of the LICENSE file instead of the `license` field.
    ['MIT*', 'allowed'],
    ['(MIT OR CC0-1.0)', 'allowed'],
    ['MIT AND BSD-3-Clause', 'allowed'],
    ['(EDL-1.0 OR EPL-1.0)', 'allowed'],
    ['WTFPL OR ISC', 'allowed'],
    ['(MIT AND Zlib)', 'allowed'],
    // An AND expression is only as permissive as its strictest arm, so Font Awesome's icon artwork keeps
    // its attribution requirement instead of being waved through by the MIT half.
    ['(CC-BY-4.0 AND MIT)', 'review'],
    ['LGPL-3.0', 'review'],
    ['UNKNOWN', 'review'],
    ['SEE LICENSE IN LICENSE', 'review'],
    ['BDS-3-Clause', 'review'],
    ['AGPL-3.0', 'blocked'],
    ['GPL-3.0-or-later', 'blocked'],
    // "OR" appears inside the sentence but this is one custom license, not a choice between two.
    ["Standard 'no charge' license: https://gsap.com/standard-license.", 'review'],
  ]

  for (const [expression, expected] of cases) {
    assert.equal(tierOf(expression, policy), expected, `${expression} should be ${expected}`)
  }

  // Every acknowledgement must justify itself, or the allowlist bypass becomes a place to hide things.
  for (const [name, entry] of Object.entries(policy.acknowledged)) {
    assert.ok(entry.license, `${name} must record the license it was reviewed at`)
    assert.ok(entry.reason && entry.reason.length > 20, `${name} must record why it is acceptable`)
    // A decision read out of the package's own license text only ever held for the version it was read at,
    // and the license comparison above cannot see that text change. Two shapes of entry rest on it: one
    // that corrects the reported license, and one acknowledged against a blocked license, which can only
    // pass through a permission written into the text.
    const fromLicenseText = entry.actual || tierOf(entry.license, policy) === 'blocked'
    assert.ok(
      !fromLicenseText || entry.version,
      `${name} was reviewed from its license text, so it must record a version`
    )
  }

  const bumped = {
    name: 'x',
    version: '2.0.0',
    reported: 'ISC',
    tier: 'allowed',
    acknowledged: { license: 'ISC', actual: 'LGPL-3.0', version: '1.0.0' },
  }
  assert.equal(verdict([{ ...bumped, version: '1.0.0', distributed: true }]).staleFailures.length, 0)
  assert.equal(verdict([{ ...bumped, distributed: true }]).staleFailures.length, 1)
  assert.equal(verdict([{ ...bumped, distributed: false }]).staleFailures.length, 0)
  assert.equal(verdict([{ ...bumped, distributed: false }]).staleWarnings.length, 1)

  // The dev tree is not the same set as what stays on a developer machine: whatever a build step compiles
  // into the shipped bundle has to fail the gate like any production dependency.
  const productionKeys = new Set(['leaflet@1.9.3'])
  const distributes = (name, version) => isDistributed({ name, version }, productionKeys, policy)
  assert.ok(distributes('leaflet', '1.9.3'), 'a production package is distributed')
  assert.ok(!distributes('leaflet', '1.9.4'), 'a version the lockfile does not resolve is not distributed')
  assert.ok(distributes('electron', '29.4.6'), 'the Electron runtime ships with Standalone')
  assert.ok(distributes('workbox-core', '7.3.0'), 'workbox is compiled into the service worker')
  assert.ok(!distributes('electron-builder', '25.1.8'), 'the packager itself does not ship')

  console.log(
    `Self-check passed: ${cases.length} license expressions and ${
      Object.keys(policy.acknowledged).length
    } acknowledgements.`
  )
}

/**
 * Runs the policy gate, or the self-check when asked for it.
 * @returns {void}
 */
function main() {
  if (process.argv.includes('--self-check')) {
    selfCheck()
    return
  }

  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'))
  process.exitCode = check(buildInventory(policy))
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`❌ Could not check the dependency licenses: ${error.message}`)
    process.exit(1)
  }
}
