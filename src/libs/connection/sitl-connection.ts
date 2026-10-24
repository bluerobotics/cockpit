import { isElectron } from '@/libs/utils'

import * as Connection from './connection'
import { RawMavlinkCodec } from './raw-mavlink-codec'

const RELOAD_KEY = 'cockpit-sitl-isolation-reload'
// The first visit waits for Cockpit's service worker to download the whole app
const SERVICE_WORKER_TIMEOUT_MS = 60_000
const ONLY_ON_PAGES = 'The simulator only runs in the Cockpit web version on GitHub Pages.'

/**
 * ArduPilot SITL compiled to WebAssembly, running in a worker inside Cockpit (public/sitl/worker.js).
 * The URI host is the binary under sitl/ (sitl://ardusub loads sitl/ardusub.js).
 * Optional parameters:
 * - model: SITL physics model, vectored by default, JSON for an external simulator like BlueSim
 * - defaults: parameter file under sitl/ loaded as SITL defaults
 * - home: start location as lat,lon,alt,heading
 * The binaries are only published with the GitHub Pages build.
 * @example sitl://ardusub?model=JSON&defaults=bluesim.parm&home=33.810313,-118.393867,0,270
 */
export class SitlConnection extends Connection.Abstract {
  private _codec = new RawMavlinkCodec()
  private _worker: Worker | undefined
  private _disposed = false

  /**
   * Start the simulator, reloading the page first when it is not cross-origin isolated.
   * Resolves once the simulator sends its first bytes, rejects with a message for the user otherwise.
   */
  async initialize(): Promise<void> {
    if (!crossOriginIsolated) {
      await this.reloadWithIsolation()
      return
    }
    sessionStorage.removeItem(RELOAD_KEY)

    await this._codec.initialize()
    if (this._disposed) return

    const options = this.uri().entries()
    const workerUrl = new URL('sitl/worker.js', document.baseURI)
    workerUrl.searchParams.set('binary', this.uri().host)
    workerUrl.searchParams.set('model', options.get('model') ?? 'vectored')
    for (const option of ['home', 'defaults']) {
      const value = options.get(option)
      if (value !== undefined) workerUrl.searchParams.set(option, value)
    }
    const worker = new Worker(workerUrl, { type: 'module' })
    this._worker = worker
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Uint8Array>) => {
        resolve()
        this._codec.decode(event.data, (message) => this.onRead.emit_value(message))
      }
      worker.onerror = (event: Event) => {
        console.error('Simulator stopped:', (event as ErrorEvent).message)
        const host = this.uri().host
        reject(
          new Error(
            `Could not start the simulator '${host}'. It needs the Cockpit web version on GitHub Pages, if you are already there, reload the page.`
          )
        )
      }
    })
  }

  /**
   * The service worker only isolates navigations that select a SITL, and it may not control
   * the page yet on the first visit, so navigate once more with the SITL in the URL.
   */
  private async reloadWithIsolation(): Promise<void> {
    if (isElectron() || !window.isSecureContext || !('serviceWorker' in navigator)) {
      throw new Error(ONLY_ON_PAGES)
    }
    const browserMessage = 'This browser could not prepare the page for the simulator. Use Chrome, Edge or Firefox.'
    if (sessionStorage.getItem(RELOAD_KEY) !== null) {
      throw new Error(browserMessage)
    }
    sessionStorage.setItem(RELOAD_KEY, 'true')
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(browserMessage)), SERVICE_WORKER_TIMEOUT_MS)
    })
    await Promise.race([navigator.serviceWorker.ready, timeout])
    if (this._disposed) return
    const url = new URL(window.location.href)
    url.searchParams.set('MAVLink2RestWebsocketURI', this.uri().toString())
    window.location.replace(url)
  }

  /**
   * Stop the simulator, terminating its worker also ends all of its threads
   * @returns {boolean}
   */
  disconnect(): boolean {
    this._disposed = true
    this._worker?.terminate()
    this._worker = undefined
    return true
  }

  /**
   * The simulator starts in initialize, nothing to do here
   * @returns {boolean}
   */
  connect(): boolean {
    return true
  }

  /**
   * Check if the simulator worker is running
   * @returns {boolean}
   */
  isConnected(): boolean {
    return this._worker !== undefined
  }

  /**
   * Send a mavlink2rest JSON message to the simulator serial port
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  write(data: Uint8Array): boolean {
    if (this._worker === undefined) {
      return false
    }
    try {
      const message = this._codec.encode(data)
      if (message === undefined) {
        return false
      }
      this._worker.postMessage(message)
      return true
    } catch (error) {
      console.error('Error writing to connection:', error)
      return false
    }
  }
}
