import { v4 as uuid } from 'uuid'
import { type Ref, ref } from 'vue'

import { setJitterBufferTarget } from '@/libs/webrtc/jitter-buffer'

const RECONNECT_DELAY_MS = 3000
// Time we give the peer connection to reach 'connected' before assuming go2rtc is stuck waiting for an
// unavailable source (e.g. camera not yet on the network) and forcing a reconnect.
const CONNECT_WATCHDOG_MS = 8000

/**
 * Manages a WebRTC connection to a go2rtc stream.
 * Exposes the same reactive interface as WebRTCManager so consumers (VideoPlayer, MiniVideoRecorder)
 * can treat RTSP-via-go2rtc streams identically to regular WebRTC streams.
 */
export class Go2RTCManager {
  public mediaStream: Ref<MediaStream | undefined> = ref()
  public connected = ref(false)
  public signallerStatus: Ref<string> = ref('Disconnected')
  public streamStatus: Ref<string> = ref('Waiting...')
  // Changes on every (re)connection, so stats consumers can tell a fresh peer connection from the previous one
  public connectionId = ''

  private pc: RTCPeerConnection | null = null
  private ws: WebSocket | null = null
  private closed = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectWatchdog: ReturnType<typeof setTimeout> | null = null

  /**
   * @param {number} go2rtcPort - The port go2rtc is listening on
   * @param {string} streamName - The stream name registered in go2rtc
   * @param {number} jitterBufferTarget - RTP receiver jitter buffer target in milliseconds
   */
  constructor(private go2rtcPort: number, private streamName: string, private jitterBufferTarget: number) {}

  /**
   * The current peer connection, exposed for stats monitoring
   * @returns {RTCPeerConnection | null} The active peer connection, or null if there is none
   */
  public get peerConnection(): RTCPeerConnection | null {
    return this.pc
  }

  /**
   * Start the WebRTC connection to go2rtc.
   * Returns reactive refs matching the WebRTCManager.startStream() interface.
   * @returns {{ mediaStream: Ref<MediaStream | undefined>, connected: Ref<boolean>, signallerStatus: Ref<string>, streamStatus: Ref<string> }}
   */
  public start(): {
    /**
     * The media stream
     */
    mediaStream: Ref<MediaStream | undefined>
    /**
     * The connection state
     */
    connected: Ref<boolean>
    /**
     * The status of the signaller
     */
    signallerStatus: Ref<string>
    /**
     * The status of the stream
     */
    streamStatus: Ref<string>
  } {
    this.connect()
    return {
      mediaStream: this.mediaStream,
      connected: this.connected,
      signallerStatus: this.signallerStatus,
      streamStatus: this.streamStatus,
    }
  }

  /**
   * Establish the WebSocket signaling connection and create a PeerConnection.
   * Based on go2rtc's own WebRTC client implementation.
   */
  private connect(): void {
    if (this.closed) return

    this.cleanup()
    this.signallerStatus.value = 'Connecting...'
    this.streamStatus.value = 'Connecting...'

    const pc = new RTCPeerConnection()
    this.pc = pc
    this.connectionId = uuid()

    pc.addTransceiver('video', { direction: 'recvonly' })

    pc.ontrack = (event: RTCTrackEvent) => {
      const [remoteStream] = event.streams
      if (!remoteStream) return
      this.mediaStream.value = remoteStream

      setJitterBufferTarget(pc, this.jitterBufferTarget)

      const videoTracks = remoteStream.getVideoTracks()
      videoTracks.forEach((track) => {
        if ('contentHint' in track) {
          track.contentHint = 'motion'
        }
      })

      console.debug(`[go2rtc] Track added for stream '${this.streamName}'`)
    }

    // A listener rather than the single-slot pc.onconnectionstatechange, which anything else holding the peer
    // connection (the stats library, for one) can overwrite, silently taking the reconnection with it
    pc.addEventListener('connectionstatechange', () => {
      // A superseded connection must not write the status refs, which by then describe the one that replaced it
      if (this.pc !== pc) return

      const state = pc.connectionState
      console.debug(`[go2rtc] Connection state for '${this.streamName}': ${state}`)
      this.streamStatus.value = state

      switch (state) {
        case 'connected':
          this.clearConnectWatchdog()
          this.connected.value = true
          break
        case 'disconnected':
        case 'failed':
          this.connected.value = false
          this.scheduleReconnect()
          break
        case 'closed':
          this.connected.value = false
          break
      }
    })

    this.armConnectWatchdog()

    const wsUrl = `ws://127.0.0.1:${this.go2rtcPort}/api/ws?src=${encodeURIComponent(this.streamName)}`
    const ws = new WebSocket(wsUrl)
    this.ws = ws

    ws.onopen = () => {
      this.signallerStatus.value = 'Connected'

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || ws.readyState !== WebSocket.OPEN) return
        const msg = JSON.stringify({ type: 'webrtc/candidate', value: ev.candidate.candidate })
        ws.send(msg)
      }

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (ws.readyState !== WebSocket.OPEN || !pc.localDescription) return
          const msg = JSON.stringify({ type: 'webrtc/offer', value: pc.localDescription.sdp })
          ws.send(msg)
        })
        .catch((error) => {
          console.error(`[go2rtc] Failed to create offer for '${this.streamName}':`, error)
          this.streamStatus.value = 'Offer failed'
          this.scheduleReconnect()
        })
    }

    ws.onmessage = (ev) => {
      let msg: {
        /**
         * The type of the message
         */
        type: string
        /**
         * The value of the message
         */
        value: string
      }
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }

      if (msg.type === 'webrtc/answer') {
        pc.setRemoteDescription({ type: 'answer', sdp: msg.value }).catch((error) => {
          console.error(`[go2rtc] Failed to set remote description for '${this.streamName}':`, error)
        })
      } else if (msg.type === 'webrtc/candidate') {
        pc.addIceCandidate({ candidate: msg.value, sdpMid: '0' }).catch((error) => {
          console.error(`[go2rtc] Failed to add ICE candidate for '${this.streamName}':`, error)
        })
      }
    }

    ws.onerror = (error) => {
      console.error(`[go2rtc] WebSocket error for '${this.streamName}':`, error)
      this.signallerStatus.value = 'Error'
    }

    ws.onclose = () => {
      this.signallerStatus.value = 'Disconnected'
      if (!this.closed) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Schedule a reconnection attempt after a delay
   */
  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return
    console.log(`[go2rtc] Reconnecting '${this.streamName}' in ${RECONNECT_DELAY_MS}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.closed) {
        this.connect()
      }
    }, RECONNECT_DELAY_MS)
  }

  /**
   * Arm a watchdog that forces a reconnect if the peer connection does not reach 'connected' in time.
   * Required because go2rtc keeps the WebSocket open without ever answering when the source (e.g. an
   * RTSP camera) is not yet reachable, leaving the RTCPeerConnection stuck in 'new' state forever.
   */
  private armConnectWatchdog(): void {
    this.clearConnectWatchdog()
    this.connectWatchdog = setTimeout(() => {
      this.connectWatchdog = null
      if (this.closed || this.connected.value) return
      console.warn(
        `[go2rtc] Stream '${this.streamName}' did not connect within ${CONNECT_WATCHDOG_MS}ms. Forcing reconnect.`
      )
      this.streamStatus.value = 'Source unavailable'
      this.cleanup()
      this.scheduleReconnect()
    }, CONNECT_WATCHDOG_MS)
  }

  /**
   * Clear the connection watchdog timer if it is set
   */
  private clearConnectWatchdog(): void {
    if (this.connectWatchdog) {
      clearTimeout(this.connectWatchdog)
      this.connectWatchdog = null
    }
  }

  /**
   * Clean up the current PeerConnection and WebSocket without closing the manager
   */
  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.clearConnectWatchdog()

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    if (this.pc) {
      this.pc.ontrack = null
      this.pc.onicecandidate = null
      this.pc.close()
      this.pc = null
    }
  }

  /**
   * Permanently close this manager and release all resources
   * @param {string} [reason] - Optional reason for closing
   */
  public close(reason?: string): void {
    if (this.closed) return
    this.closed = true
    console.log(`[go2rtc] Closing manager for '${this.streamName}'${reason ? `: ${reason}` : ''}`)
    this.cleanup()
    this.connected.value = false
    this.mediaStream.value = undefined
    this.signallerStatus.value = 'Closed'
    this.streamStatus.value = 'Closed'
  }
}
