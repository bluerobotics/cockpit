import { instrument } from '@/libs/performance-monitoring'
import * as Protocol from '@/libs/vehicle/protocol/protocol'

import * as Connection from './connection'

/**
 * Options for {@link WebSocketConnection}.
 */
export interface WebSocketConnectionOptions {
  /**
   * Returns the user-configured watchdog timeout in milliseconds: how long the socket may stay
   * `OPEN` without receiving any message before the connection is considered stuck and forcibly
   * recycled. Decoupled from the UI-facing heartbeat timeout so users can pick each independently.
   * @returns {number} Current watchdog timeout in milliseconds.
   */
  getWatchdogTimeoutMs?: () => number
}

const DEFAULT_WATCHDOG_TIMEOUT_MS = 4_000

// Initial delay before retrying after a close, doubled on each consecutive failure up to the cap.
// Keeps quick-recovery cases snappy while avoiding a tight loop when the link is down for long.
const RECONNECT_INITIAL_DELAY_MS = 500
const RECONNECT_MAX_DELAY_MS = 5_000

const WATCHDOG_INTERVAL_MS = 1_000

// Absolute floor for the idle window, protecting against pathological configuration. Anything
// shorter than this would cause spurious recycles even on healthy links where the normal
// inter-message gap (e.g. 1 Hz heartbeats on a low-traffic vehicle) is around a second.
const MIN_IDLE_TIMEOUT_MS = 1_000

// Maximum time a new socket is allowed to remain in the `CONNECTING` state before we give up and
// recycle. A real TCP+TLS+upgrade handshake should comfortably complete inside this on any link
// Cockpit is usable on; longer means something at the network layer is permanently lost.
const CONNECTING_TIMEOUT_MS = 10_000

const LOG_PREFIX = '[WebSocketConnection]'

/**
 * Connection abstraction for websocket communication, with auto-reconnect, error handling, and a
 * watchdog that recovers from sockets stuck in `CONNECTING` or `OPEN`-but-silent states (which
 * Chromium can hold for over a minute on a half-dead TCP connection before firing `onclose`).
 */
export class WebSocketConnection extends Connection.Abstract {
  private _socket: WebSocket | null = null
  private _textEncoder = new TextEncoder()
  private _textDecoder = new TextDecoder()

  private _getWatchdogTimeoutMs: () => number
  private _connectingSince: number | undefined
  private _openedAt: number | undefined
  private _lastMessageAt = 0
  private _reconnectAttempts = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private _watchdogInterval: ReturnType<typeof setInterval> | undefined
  private _disposed = false

  /**
   * Websocket constructor
   * @param {Connection.URI} uri - URI to connect to.
   * @param {Protocol.Type} vehicleProtocol - Vehicle communication protocol carried over the socket.
   * @param {WebSocketConnectionOptions} options - Optional configuration for reconnect behavior.
   */
  constructor(uri: Connection.URI, vehicleProtocol: Protocol.Type, options: WebSocketConnectionOptions = {}) {
    super(uri, vehicleProtocol)

    this._getWatchdogTimeoutMs = options.getWatchdogTimeoutMs ?? (() => DEFAULT_WATCHDOG_TIMEOUT_MS)

    this._openSocket()
    this._startWatchdog()
  }

  /**
   * Permanently disconnect this websocket and stop all background activity. After calling this the
   * connection cannot be reused.
   * @returns {boolean} Always true.
   */
  disconnect(): boolean {
    this._disposed = true
    this._stopWatchdog()
    this._cancelPendingReconnect()
    this._detachSocket()
    return true
  }

  /**
   * Ensure the websocket is being established. If it was disposed this is a no-op; otherwise it
   * triggers an immediate reconnect attempt when the socket is missing or already closed.
   * @returns {boolean} Always true.
   */
  connect(): boolean {
    if (this._disposed) return true
    if (this._socket === null || this._socket.readyState === WebSocket.CLOSED) {
      this._scheduleReconnect(0)
    }
    return true
  }

  /**
   * Whether the underlying socket is currently in the `OPEN` state.
   * @returns {boolean} True when the socket is open and ready to send/receive.
   */
  isConnected(): boolean {
    return this._socket?.readyState === WebSocket.OPEN
  }

  /**
   * Write data to the websocket. Silently drops the message if the socket is not currently `OPEN`,
   * since attempting to send on a `CONNECTING` socket throws and we already detect missing data via
   * the watchdog.
   * @param {Uint8Array} data - Bytes to send (will be decoded to a UTF-8 string for the socket).
   * @returns {boolean} True if the message was handed to the socket, false if it was dropped.
   */
  write(data: Uint8Array): boolean {
    const socket = this._socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return false

    try {
      socket.send(this._textDecoder.decode(data))
      return true
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to send data:`, error)
      return false
    }
  }

  /**
   * Detach the current socket (if any) and start a new connection attempt.
   */
  private _openSocket(): void {
    if (this._disposed) return

    this._detachSocket()

    const uri = this.uri()
    // Stamp the CONNECTING start before the WebSocket is constructed: in environments where the
    // socket can open synchronously (e.g. some test mocks) `_onOpen` runs inside this call and
    // would otherwise see an undefined `_connectingSince`.
    this._connectingSince = Date.now()

    let socket: WebSocket
    try {
      socket = new WebSocket(uri)
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to construct socket for ${uri.toString()}:`, error)
      this._connectingSince = undefined
      this._scheduleReconnect()
      return
    }

    this._socket = socket
    console.info(`${LOG_PREFIX} Connecting to ${uri.toString()}...`)

    socket.onopen = () => this._onOpen()
    socket.onmessage = (event: MessageEvent) => this._onMessage(event)
    socket.onerror = (event: Event) => this._onError(event)
    socket.onclose = (event: CloseEvent) => this._onClose(event)
  }

  /**
   * Mark the connection as healthy and reset reconnect state when the socket opens.
   */
  private _onOpen(): void {
    this._connectingSince = undefined
    this._openedAt = Date.now()
    this._reconnectAttempts = 0
    this._lastMessageAt = Date.now()
    console.info(`${LOG_PREFIX} Connected to ${this.uri().toString()}.`)
  }

  /**
   * @param {MessageEvent} event Message event from the underlying socket.
   */
  private _onMessage(event: MessageEvent): void {
    this._lastMessageAt = Date.now()
    try {
      // The whole synchronous MAVLink parse + dispatch fan-out runs inside this emit. Instrumented so
      // that, with opt-in profiling on, telemetry-reception cost shows up labelled in self-profiles.
      instrument('mavlink-ws-message', () => this.onRead.emit_value(this._textEncoder.encode(event.data)))
    } catch (error) {
      // Render the error inline as a string: many native errors thrown from downstream parsers
      // have no enumerable own properties, which made earlier syslogs show a useless `{}` here.
      const reason = error instanceof Error ? error.message || String(error) : String(error)
      const preview = typeof event.data === 'string' ? event.data.slice(0, 200) : '[non-string payload]'
      console.error(`${LOG_PREFIX} Error reading websocket message: ${reason}. Payload (truncated): ${preview}`)
    }
  }

  /**
   * @param {Event} event Error event from the underlying socket.
   */
  private _onError(event: Event): void {
    console.warn(`${LOG_PREFIX} Socket error on ${this.uri().toString()}:`, event)
  }

  /**
   * @param {CloseEvent} event Close event from the underlying socket.
   */
  private _onClose(event: CloseEvent): void {
    const uptime = this._openUptimeDescription()
    if (event.wasClean) {
      console.info(
        `${LOG_PREFIX} Socket closed (code=${event.code}, reason="${event.reason || 'n/a'}", clean=true). ${uptime}`
      )
    } else {
      console.warn(
        `${LOG_PREFIX} Socket closed unexpectedly (code=${event.code}, reason="${event.reason || 'n/a'}"). ${uptime}`
      )
    }
    this._connectingSince = undefined
    this._openedAt = undefined
    this._scheduleReconnect()
  }

  /**
   * @param {number} [forcedDelayMs] If provided, override the backoff schedule with this delay.
   */
  private _scheduleReconnect(forcedDelayMs?: number): void {
    if (this._disposed) return
    if (this._reconnectTimer !== undefined) return

    const delay = forcedDelayMs ?? this._nextBackoffDelayMs()
    this._reconnectAttempts += 1

    if (delay > 0) {
      console.info(
        `${LOG_PREFIX} Reconnecting in ${delay} ms (attempt #${this._reconnectAttempts}) to ${this.uri().toString()}.`
      )
    }

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined
      this._openSocket()
    }, delay)
  }

  /**
   * Cancel a pending reconnect timer, if one is scheduled.
   */
  private _cancelPendingReconnect(): void {
    if (this._reconnectTimer === undefined) return
    clearTimeout(this._reconnectTimer)
    this._reconnectTimer = undefined
  }

  /**
   * @returns {number} Capped exponential backoff delay (in ms) for the next reconnect attempt.
   */
  private _nextBackoffDelayMs(): number {
    const exp = Math.min(this._reconnectAttempts, 10)
    const delay = RECONNECT_INITIAL_DELAY_MS * 2 ** exp
    return Math.min(delay, RECONNECT_MAX_DELAY_MS)
  }

  /**
   * Remove all handlers from the current socket and close it. Safe to call when no socket exists.
   */
  private _detachSocket(): void {
    const socket = this._socket
    if (!socket) return

    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null

    if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
      try {
        socket.close()
      } catch (error) {
        console.warn(`${LOG_PREFIX} Error while closing socket:`, error)
      }
    }

    this._socket = null
    this._connectingSince = undefined
    this._openedAt = undefined
  }

  /**
   * Start the periodic watchdog that recycles sockets stuck in `CONNECTING` or `OPEN`-but-silent.
   */
  private _startWatchdog(): void {
    if (this._watchdogInterval !== undefined) return
    this._watchdogInterval = setInterval(() => this._runWatchdog(), WATCHDOG_INTERVAL_MS)
  }

  /**
   * Stop the periodic watchdog. Safe to call when no watchdog is running.
   */
  private _stopWatchdog(): void {
    if (this._watchdogInterval === undefined) return
    clearInterval(this._watchdogInterval)
    this._watchdogInterval = undefined
  }

  /**
   * Single watchdog tick. Recycles the socket if it has been stuck for too long, or schedules a
   * reconnect if the socket is missing entirely.
   */
  private _runWatchdog(): void {
    if (this._disposed) return

    const socket = this._socket
    const idleTimeoutMs = Math.max(MIN_IDLE_TIMEOUT_MS, this._getWatchdogTimeoutMs())

    // No socket and no pending reconnect: failsafe path that recovers from any state where we lost
    // track of the socket without scheduling its replacement (e.g. an exception during _openSocket).
    if (!socket) {
      if (this._reconnectTimer === undefined) this._scheduleReconnect()
      return
    }

    if (socket.readyState === WebSocket.CONNECTING) {
      const connectingFor = Date.now() - (this._connectingSince ?? Date.now())
      if (connectingFor > CONNECTING_TIMEOUT_MS) {
        console.warn(
          `${LOG_PREFIX} Socket stuck in CONNECTING for ${connectingFor} ms (limit ${CONNECTING_TIMEOUT_MS} ms). Recycling.`
        )
        this._detachSocket()
        this._scheduleReconnect()
      }
      return
    }

    if (socket.readyState === WebSocket.OPEN) {
      const idleFor = Date.now() - this._lastMessageAt
      if (idleFor > idleTimeoutMs) {
        const uptime = this._openUptimeDescription()
        console.warn(
          `${LOG_PREFIX} No data received for ${idleFor} ms (limit ${idleTimeoutMs} ms). Recycling socket. ${uptime}`
        )
        this._detachSocket()
        this._scheduleReconnect()
      }
    }
  }

  /**
   * @returns {string} Human-readable description of how long the socket has been (or was) `OPEN`,
   *   suitable for appending to a log line. Distinguishes "never reached OPEN" so a CONNECTING
   *   stuck/timed-out path can also use this without lying.
   */
  private _openUptimeDescription(): string {
    if (this._openedAt === undefined) return 'never reached OPEN'

    const elapsedMs = Date.now() - this._openedAt
    if (elapsedMs < 60_000) return `was OPEN for ${(elapsedMs / 1000).toFixed(1)} s`

    const totalSeconds = Math.floor(elapsedMs / 1000)
    const seconds = totalSeconds % 60
    const totalMinutes = Math.floor(totalSeconds / 60)
    const minutes = totalMinutes % 60
    const hours = Math.floor(totalMinutes / 60)

    if (hours === 0) return `was OPEN for ${minutes}m ${seconds}s`
    return `was OPEN for ${hours}h ${minutes}m ${seconds}s`
  }
}
