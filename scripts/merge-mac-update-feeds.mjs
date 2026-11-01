/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */
// electron-updater on macOS only reads latest-mac.yml and picks the Apple Silicon zip out of it by "arm64" in the
// URL, so the two per-architecture feeds the CI builds have to become one. Usage: <x64.yml> <arm64.yml> <out.yml>
import yaml from 'js-yaml'
import { readFileSync, writeFileSync } from 'node:fs'

const [x64Path, arm64Path, outPath] = process.argv.slice(2)
if (!outPath) {
  console.error('Usage: node scripts/merge-mac-update-feeds.mjs <x64.yml> <arm64.yml> <out.yml>')
  process.exit(1)
}

const x64 = yaml.load(readFileSync(x64Path, 'utf8'))
const arm64 = yaml.load(readFileSync(arm64Path, 'utf8'))
const isArm64 = (file) => file.url.includes('arm64')

const problems = [
  x64.version !== arm64.version && `versions differ: ${x64.version} (x64) and ${arm64.version} (arm64)`,
  !x64.files?.length || x64.files.some(isArm64) ? 'the x64 feed is empty or lists an arm64 file' : false,
  !arm64.files?.length || !arm64.files.every(isArm64) ? 'the arm64 feed is empty or lists a non-arm64 file' : false,
  !x64.minimumSystemVersion && 'the x64 feed has no minimumSystemVersion',
].filter(Boolean)
if (problems.length) {
  console.error(`Refusing to merge the macOS update feeds: ${problems.join('; ')}.`)
  process.exit(1)
}

// The x64 feed is the base so the legacy top-level path/sha512 keep pointing at the build every Mac can run.
writeFileSync(outPath, yaml.dump({ ...x64, files: [...x64.files, ...arm64.files] }, { lineWidth: -1 }))
console.log(`Wrote ${outPath} with ${x64.files.length} x64 and ${arm64.files.length} arm64 files.`)
