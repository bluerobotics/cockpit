import { isElectron } from '@/libs/utils'

/**
 * Versions of the simulator files, and the build that published them (scripts/sitl-version.mjs)
 */
export interface SitlVersion {
  /**
   * Hash of the files in sitl/, or 'none' in builds without the simulator
   */
  sitl: string
  /**
   * Hash of BlueSim's web export in bluesim/, or 'none' in builds without it
   */
  bluesim: string
  /**
   * Identifies the build itself
   */
  build: string
}

/**
 * How this copy of Cockpit compares with the one on the server
 * - unknown: there is nothing to compare, like in development, Electron or builds without the simulator
 * - current: same build
 * - stale: an older copy, like a tab left open across a deploy
 * - still-stale: an older copy, even after reloading once to the server's build
 */
export type SitlVersionStatus = 'unknown' | 'current' | 'stale' | 'still-stale'

declare const __SITL_VERSION__: SitlVersion

export const appSitlVersion: SitlVersion = __SITL_VERSION__

const NOT_VERSIONED = 'none'
// Holds the build reloaded to, so a copy that stays old does not reload forever
const RELOAD_KEY = 'cockpit-sitl-version-reload'
const SERVICE_WORKER_UPDATE_TIMEOUT_MS = 10_000
// Long enough for the user to read that the page is about to reload
const RELOAD_NOTICE_MIN_MS = 1500

const isSitlVersion = (value: unknown): value is SitlVersion =>
  typeof value === 'object' &&
  value !== null &&
  ['sitl', 'bluesim', 'build'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string')

/**
 * Compares this copy of Cockpit with the server's
 * @param {SitlVersion} app The version this copy was built with
 * @param {SitlVersion} server The version on the server
 * @param {string | null} reloadedTo The build already reloaded to in this session, if any
 * @returns {SitlVersionStatus} How the two compare
 */
export const compareSitlVersions = (
  app: SitlVersion,
  server: SitlVersion,
  reloadedTo: string | null
): SitlVersionStatus => {
  if (server.build === app.build && server.sitl === app.sitl) return 'current'
  return reloadedTo === server.build ? 'still-stale' : 'stale'
}

const fetchServerSitlVersion = async (): Promise<SitlVersion | undefined> => {
  try {
    const response = await fetch(new URL('sitl/version.json', document.baseURI), { cache: 'no-store' })
    if (!response.ok) return undefined
    const version: unknown = await response.json()
    return isSitlVersion(version) ? version : undefined
  } catch {
    return undefined
  }
}

// skipWaiting and clientsClaim make a new service worker take over as soon as it installs
const waitForServiceWorkerUpdate = async (): Promise<void> => {
  const registration = await navigator.serviceWorker?.getRegistration()
  await registration?.update().catch(() => undefined)
  const worker = registration?.installing ?? registration?.waiting
  if (!worker) return
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, SERVICE_WORKER_UPDATE_TIMEOUT_MS)
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return
      clearTimeout(timeout)
      resolve()
    })
  })
}

const staleListeners = new Set<(status: 'stale' | 'still-stale') => void>()
let pendingCheck: Promise<SitlVersionStatus> | undefined = undefined
let isReloading = false
let isStillStaleReported = false

/**
 * Follow when this copy of Cockpit turns out to be older than the server's, to tell the user.
 * On 'stale' the page reloads to the server's build right after, on 'still-stale' it is left as it is.
 * @param {(status: 'stale' | 'still-stale') => void} listener Called once per page load for each status
 * @returns {() => void} Stops following
 */
export const onStaleSitlVersion = (listener: (status: 'stale' | 'still-stale') => void): (() => void) => {
  staleListeners.add(listener)
  return () => {
    staleListeners.delete(listener)
  }
}

const runCheck = async (): Promise<SitlVersionStatus> => {
  const server = await fetchServerSitlVersion()
  if (server === undefined) return 'unknown'
  const status = compareSitlVersions(appSitlVersion, server, sessionStorage.getItem(RELOAD_KEY))
  if (status === 'stale' && !isReloading) {
    isReloading = true
    sessionStorage.setItem(RELOAD_KEY, server.build)
    staleListeners.forEach((listener) => listener('stale'))
    await Promise.all([
      waitForServiceWorkerUpdate(),
      new Promise((resolve) => setTimeout(resolve, RELOAD_NOTICE_MIN_MS)),
    ])
    window.location.reload()
  }
  if (status === 'still-stale' && !isStillStaleReported) {
    isStillStaleReported = true
    staleListeners.forEach((listener) => listener('still-stale'))
  }
  return status
}

/**
 * Checks whether this copy of Cockpit is older than the server's, which mixes old cached files with newer simulator
 * files. When it is, the page reloads once to the server's build. Concurrent calls share one check.
 * @returns {Promise<SitlVersionStatus>} How this copy compares, 'stale' meaning the page is about to reload
 */
export const checkSitlVersion = (): Promise<SitlVersionStatus> => {
  if (import.meta.env.DEV || isElectron() || appSitlVersion.sitl === NOT_VERSIONED) return Promise.resolve('unknown')
  pendingCheck ??= runCheck().finally(() => (pendingCheck = undefined))
  return pendingCheck
}

/**
 * Versions the URL of the BlueSim export Cockpit ships, so its page is not an old cached copy,
 * and points it at this page's physics channel
 * @param {string} source The simulator URL, relative to Cockpit's
 * @param {string} channel The id of this page's physics channel with the SITL worker
 * @returns {string} The absolute URL, with the BlueSim version and channel when it is Cockpit's own BlueSim
 */
export const versionedSimulatorUrl = (source: string, channel: string): string => {
  const url = new URL(source, document.baseURI)
  const blueSimUrl = new URL('bluesim/index.html', document.baseURI)
  if (url.origin !== blueSimUrl.origin || url.pathname !== blueSimUrl.pathname) return url.href
  if (appSitlVersion.bluesim !== NOT_VERSIONED) url.searchParams.set('v', appSitlVersion.bluesim)
  url.searchParams.set('channel', channel)
  return url.href
}
