import { BrowserWindow, ipcMain } from 'electron'

import type { AdsbAircraftQuery, AdsbLolAircraft, AisStreamReport, AisStreamRequest } from '../../types/traffic'
import { fetchWithTimeout } from '../utils'

const ADSB_REQUEST_TIMEOUT_MS = 15 * 1000
const ADSB_MAX_RADIUS_NAUTICAL_MILES = 250
const AIS_STREAM_URL = 'wss://stream.aisstream.io/v0/stream'
// A busy harbour reports many times a second, so the reports are coalesced per vessel and handed over on this beat
// instead of crossing the process boundary one by one.
const AIS_FLUSH_INTERVAL_MS = 1000
const AIS_RECONNECT_BACKOFF_MS = [2000, 5000, 15000, 30000]

let mainWindow: BrowserWindow | null = null

let aisSocket: WebSocket | null = null
let aisRequest: AisStreamRequest | null = null
let aisFlushTimer: ReturnType<typeof setInterval> | undefined
let aisReconnectTimer: ReturnType<typeof setTimeout> | undefined
let aisReconnectAttempt = 0
let aisFailureReported = false
// A refused key or area is refused again on every attempt, so the reconnects a transient outage earns stop here
// until the renderer asks for the stream again with something changed.
let aisRefused = false
// Keyed by vessel and report type, so a position and an identity report of the same vessel both survive the beat.
const pendingAisReports = new Map<string, AisStreamReport>()

const sendToRenderer = (channel: string, payload: unknown): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

const reportAisFailure = (message: string): void => {
  if (aisFailureReported) return
  aisFailureReported = true
  sendToRenderer('ais-stream-error', message)
}

const validateAdsbQuery = (query: AdsbAircraftQuery): void => {
  const { latitude, longitude, radiusNauticalMiles } = query
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) throw new Error('the search latitude is out of range.')
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('the search longitude is out of range.')
  if (!Number.isFinite(radiusNauticalMiles) || radiusNauticalMiles <= 0) {
    throw new Error('the search radius must be a positive distance.')
  }
}

const validateAisRequest = (request: AisStreamRequest): void => {
  if (!request.apiKey?.trim()) throw new Error('an aisstream.io API key is needed to stream vessel traffic.')
  for (const value of [request.south, request.west, request.north, request.east]) {
    if (!Number.isFinite(value)) throw new Error('the area to stream vessels from is not a valid one.')
  }
  if (request.south >= request.north || request.west >= request.east) {
    throw new Error('the area to stream vessels from is not a valid one.')
  }
}

const fetchNearbyAdsbAircraft = async (
  _event: Electron.IpcMainInvokeEvent,
  query: AdsbAircraftQuery
): Promise<AdsbLolAircraft[]> => {
  validateAdsbQuery(query)

  // The endpoint takes the radius as whole nautical miles, and answers nothing beyond its own reach.
  const radius = Math.min(Math.max(1, Math.round(query.radiusNauticalMiles)), ADSB_MAX_RADIUS_NAUTICAL_MILES)
  const url = `https://api.adsb.lol/v2/point/${query.latitude.toFixed(6)}/${query.longitude.toFixed(6)}/${radius}`

  try {
    const response = await fetchWithTimeout(url, ADSB_REQUEST_TIMEOUT_MS)
    if (!response.ok) throw new Error(`the air traffic feed answered HTTP ${response.status}.`)
    const data = (await response.json()) as Record<string, unknown>
    return Array.isArray(data.ac) ? (data.ac as AdsbLolAircraft[]) : []
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('the air traffic feed did not answer in time.')
    }
    throw error
  }
}

const flushAisReports = (): void => {
  if (pendingAisReports.size === 0) return
  const reports = [...pendingAisReports.values()]
  pendingAisReports.clear()
  sendToRenderer('ais-stream-reports', reports)
}

const frameText = (data: unknown): string => {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  return ''
}

const refusalReason = (frame: Record<string, unknown>): string | undefined => {
  const stated = frame.error ?? frame.Error
  if (typeof stated !== 'string' || stated.trim() === '') return undefined
  return stated.slice(0, 200)
}

const onAisMessage = (data: string): void => {
  if (data === '') return

  let frame: Record<string, unknown>
  try {
    frame = JSON.parse(data) as Record<string, unknown>
  } catch {
    // aisstream.io answers a refused subscription with a plain-text reason rather than a report.
    aisRefused = true
    reportAisFailure(data.slice(0, 200))
    return
  }

  const refusal = refusalReason(frame)
  if (refusal !== undefined) {
    aisRefused = true
    reportAisFailure(refusal)
    return
  }

  const mmsi = (frame as AisStreamReport).MetaData?.MMSI
  if (mmsi === undefined) return
  const report = frame as AisStreamReport
  // Anything arriving means the key and the area were accepted, so the next outage gets reported on its own.
  aisReconnectAttempt = 0
  aisFailureReported = false
  pendingAisReports.set(`${mmsi}/${report.MessageType ?? 'unknown'}`, report)
}

const closeAisSocket = (): void => {
  if (!aisSocket) return
  const socket = aisSocket
  aisSocket = null
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
  socket.close()
}

const scheduleAisReconnect = (): void => {
  if (!aisRequest || aisRefused || aisReconnectTimer !== undefined) return
  const delay = AIS_RECONNECT_BACKOFF_MS[Math.min(aisReconnectAttempt, AIS_RECONNECT_BACKOFF_MS.length - 1)]
  aisReconnectAttempt += 1
  aisReconnectTimer = setTimeout(() => {
    aisReconnectTimer = undefined
    openAisSocket()
  }, delay)
}

const openAisSocket = (): void => {
  const request = aisRequest
  if (!request) return
  closeAisSocket()

  const socket = new WebSocket(AIS_STREAM_URL)
  // The feed sends its reports as binary frames, which this runtime hands over as a Blob unless asked otherwise, and
  // a Blob can only be read back asynchronously.
  socket.binaryType = 'arraybuffer'
  aisSocket = socket

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        APIKey: request.apiKey,
        BoundingBoxes: [
          [
            [request.south, request.west],
            [request.north, request.east],
          ],
        ],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      })
    )
  }
  socket.onmessage = (event) => onAisMessage(frameText(event.data))
  socket.onerror = () => reportAisFailure('the vessel traffic feed could not be reached.')
  socket.onclose = () => {
    if (aisSocket !== socket) return
    aisSocket = null
    scheduleAisReconnect()
  }
}

const stopAisStream = (): void => {
  aisRequest = null
  clearTimeout(aisReconnectTimer)
  aisReconnectTimer = undefined
  clearInterval(aisFlushTimer)
  aisFlushTimer = undefined
  pendingAisReports.clear()
  closeAisSocket()
}

const startAisStream = async (_event: Electron.IpcMainInvokeEvent, request: AisStreamRequest): Promise<void> => {
  validateAisRequest(request)
  if (typeof WebSocket === 'undefined') throw new Error('this build cannot open a vessel traffic stream.')

  stopAisStream()
  aisRequest = request
  aisReconnectAttempt = 0
  aisFailureReported = false
  aisRefused = false
  aisFlushTimer = setInterval(flushAisReports, AIS_FLUSH_INTERVAL_MS)
  openAisSocket()
}

/**
 * Hands the traffic bridge the window its streamed reports go to.
 * @param {BrowserWindow} window The window currently showing Cockpit
 * @returns {void}
 */
export const setTrafficServiceMainWindow = (window: BrowserWindow): void => {
  mainWindow = window
  // A stream left open would keep reconnecting to a feed nobody reads, and reporting into a window that is gone.
  window.on('closed', () => {
    mainWindow = null
    stopAisStream()
  })
}

/**
 * Sets up the traffic bridge, which fetches the public air traffic feed and streams the public vessel traffic feed
 * from the main process, since neither sends the headers a browser needs to read them from the renderer.
 * @returns {void}
 */
export const setupTrafficService = (): void => {
  ipcMain.handle('fetch-nearby-adsb-aircraft', fetchNearbyAdsbAircraft)
  ipcMain.handle('start-ais-stream', startAisStream)
  ipcMain.handle('stop-ais-stream', () => stopAisStream())
}
