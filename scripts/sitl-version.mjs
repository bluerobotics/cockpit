/* eslint-disable @typescript-eslint/explicit-function-return-type */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const HASH_LENGTH = 12
// Builds without the simulator binaries, which only the GitHub Pages build downloads
const MISSING = 'none'
const VERSION_FILE = 'sitl/version.json'

/**
 * Hashes a set of files together, so any of them changing gives a new version.
 * @param {string} directory - Where the files are
 * @param {RegExp} pattern - Names of the files that make up the version
 * @param {string} required - File without which there is nothing to version
 * @returns {string} Short sha256 of the names and contents, or 'none' when the required file is missing
 */
const hashFiles = (directory, pattern, required) => {
  if (!fs.existsSync(path.join(directory, required))) return MISSING
  const hash = crypto.createHash('sha256')
  for (const name of fs
    .readdirSync(directory)
    .filter((file) => pattern.test(file))
    .sort()) {
    hash.update(name)
    hash.update(fs.readFileSync(path.join(directory, name)))
  }
  return hash.digest('hex').slice(0, HASH_LENGTH)
}

/**
 * Versions the simulator files in public/sitl/ and public/bluesim/ by their contents, so they can be loaded and cached
 * as one set. The app gets them as __SITL_VERSION__, and the server publishes them in sitl/version.json, which tells
 * an old cached copy of the app that a newer build was deployed.
 * @param {string} publicDir - The app's public directory
 * @returns {import('vite').Plugin} The Vite plugin
 */
export const sitlVersion = (publicDir) => {
  const readHashes = () => ({
    sitl: hashFiles(path.join(publicDir, 'sitl'), /\.(js|wasm|parm)$/, 'ardusub.wasm'),
    bluesim: hashFiles(path.join(publicDir, 'bluesim'), /^index\.(html|js|wasm|pck)$/, 'index.wasm'),
  })
  const version = { ...readHashes(), build: new Date().toISOString() }

  return {
    name: 'cockpit-sitl-version',
    config: () => ({ define: { __SITL_VERSION__: JSON.stringify(version) } }),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.split('?')[0].endsWith(`/${VERSION_FILE}`)) return next()
        // Hashed again on every request, so SITL files rebuilt while the server runs are not taken from the cache
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.end(JSON.stringify({ ...readHashes(), build: version.build }))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: VERSION_FILE, source: JSON.stringify(version) })
    },
  }
}
