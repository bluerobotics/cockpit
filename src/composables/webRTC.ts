/* eslint-disable jsdoc/no-undefined-types */ // TODO: Fix RTCConfiguration is unknown

import { type Ref, ref, watch } from 'vue'

import * as Connection from '@/libs/connection/connection'
import { Session } from '@/libs/webrtc/session'
import { Signaller } from '@/libs/webrtc/signaller'
import type { Stream } from '@/libs/webrtc/signalling_protocol'

/**
 *
 */
interface startStreamReturn {
  /**
   * MediaStream object, if WebRTC stream is chosen
   */
  mediaStream: Ref<MediaStream | undefined>
  /**
   * Connection state
   */
  connected: Ref<boolean>
  /**
   * Current status of the signalling
   */
  signallerStatus: Ref<string>
  /**
   * Current status of the stream
   */
  streamStatus: Ref<string>
}

/**
 *
 */
export class WebRTCManager {
  public availableStreams: Ref<Array<Stream>> = ref(new Array<Stream>())
  public availableICEIPs: Ref<Array<string>> = ref(new Array<string>())
  private mediaStream: Ref<MediaStream | undefined> = ref()
  public signallerStatus: Ref<string> = ref('waiting...')
  public streamStatus: Ref<string> = ref('waiting...')
  private connected = ref(false)
  private consumerId: string | undefined
  private streamName: string | undefined
  public session: Session | undefined
  private rtcConfiguration: RTCConfiguration
  private selectedICEIPs: string[] = []
  private selectedICEProtocols: string[] = []
  private JitterBufferTarget: number | null

  private hasEnded = false
  private signaller: Signaller
  private waitingForAvailableStreamsAnswer = false
  private waitingForSessionStart = false

  /**
   *
   * @param {Connection.URI} webRTCSignallingURI
   * @param {RTCConfiguration} rtcConfiguration
   */
  constructor(webRTCSignallingURI: Connection.URI, rtcConfiguration: RTCConfiguration) {
    console.debug('[WebRTC] Trying to connect to signalling server.')
    this.rtcConfiguration = rtcConfiguration
    this.signaller = new Signaller(
      webRTCSignallingURI,
      true,
      (): void => {
        this.startConsumer()
      },
      (status: string): void => this.updateSignallerStatus(status)
    )
  }

  /**
   *
   * @param {string} reason
   */
  public close(reason: string): void {
    this.stopSession(reason)
    this.signaller.end(reason)
    this.hasEnded = true
  }

  /**
   *
   * @param { Ref<Stream | undefined> } selectedStream - Stream to receive stream from
   * @param { Ref<string[]> } selectedICEIPs - ICE IPs allowed to be used in the connection
   * @param { Ref<string[]> } selectedICEProtocols - ICE protocols allowed to be used in the connection
   * @param { Ref<number | null> } jitterBufferTarget - RTP receiver jitter buffer target in milliseconds
   * @returns { startStreamReturn }
   */
  public startStream(
    selectedStream: Ref<Stream | undefined>,
    selectedICEIPs: Ref<string[]>,
    selectedICEProtocols: Ref<string[]>,
    jitterBufferTarget: Ref<number | null>
  ): startStreamReturn {
    this.selectedICEIPs = selectedICEIPs.value
    this.selectedICEProtocols = selectedICEProtocols.value
    this.JitterBufferTarget = jitterBufferTarget.value

    watch(selectedStream, (newStream, oldStream) => {
      if (newStream?.id === oldStream?.id) {
        return
      }

      const msg = `Selected stream changed from "${oldStream?.id}" to "${newStream?.id}".`
      console.debug('[WebRTC] ' + msg)
      if (oldStream !== undefined) {
        this.stopSession(msg)
      }
      if (newStream !== undefined) {
        this.streamName = newStream.name
        this.startSession()
      }
    })

    watch(selectedICEIPs, (newIps, oldIps) => {
      if (newIps === oldIps) {
        return
      }

      const msg = `Selected IPs changed from "${oldIps}" to "${newIps}".`
      console.debug('[WebRTC] ' + msg)

      this.selectedICEIPs = newIps

      if (this.streamName !== undefined) {
        this.stopSession(msg)
      }

      if (this.streamName !== undefined) {
        this.startSession()
      }
    })

    watch(selectedICEProtocols, (newProtocols, oldProtocols) => {
      if (newProtocols === oldProtocols) {
        return
      }

      const msg = `Selected Protocols changed from "${oldProtocols}" to "${newProtocols}".`
      console.debug('[WebRTC] ' + msg)

      this.selectedICEProtocols = newProtocols

      if (this.streamName !== undefined) {
        this.stopSession(msg)
      }

      if (this.streamName !== undefined) {
        this.startSession()
      }
    })

    return {
      mediaStream: this.mediaStream,
      connected: this.connected,
      signallerStatus: this.signallerStatus,
      streamStatus: this.streamStatus,
    }
  }

  /**
   *
   * @param {string} newStatus
   */
  private updateStreamStatus(newStatus: string): void {
    const time = new Date().toTimeString().split(' ').first()
    this.streamStatus.value = `${newStatus} (${time})`
  }

  /**
   *
   * @param {string} newStatus
   */
  private updateSignallerStatus(newStatus: string): void {
    const time = new Date().toTimeString().split(' ').first()
    this.signallerStatus.value = `${newStatus} (${time})`
  }

  /**
   *
   */
  private startConsumer(): void {
    this.hasEnded = false
    // Requests a new consumer ID
    if (this.consumerId === undefined) {
      this.signaller.requestConsumerId((newConsumerId: string): void => {
        this.consumerId = newConsumerId
      })
    }

    this.availableStreams.value = []
    this.updateStreamsAvailable()
  }

  /**
   *
   */
  private updateStreamsAvailable(): void {
    if (this.waitingForAvailableStreamsAnswer) {
      this.signaller.requestStreams()
      return
    }
    if (this.hasEnded) {
      this.waitingForAvailableStreamsAnswer = false
      return
    }
    this.waitingForAvailableStreamsAnswer = true

    // Asks for available streams, which will trigger the consumer "onAvailableStreams" callback
    window.setTimeout(() => {
      // Register the parser to update the list of streams when the signaller receives the answer
      this.signaller.parseAvailableStreamsAnswer((availableStreams): void => {
        if (!this.waitingForAvailableStreamsAnswer) {
          return
        }
        this.waitingForAvailableStreamsAnswer = false
        this.availableStreams.value = availableStreams

        this.updateStreamsAvailable()
      })

      this.signaller.requestStreams()
    }, 1000)
  }

  /**
   *
   * @param {RTCTrackEvent} event
   */
  private onTrackAdded(event: RTCTrackEvent): void {
    const [remoteStream] = event.streams
    this.mediaStream.value = remoteStream

    this.session?.setJitterBufferTarget(this.JitterBufferTarget)

    // Assign 'motion' contentHint to media stream video tracks, so it performs better on low bandwith situations
    // More on that here: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/contentHint
    const videoTracks = this.mediaStream.value.getVideoTracks().filter((t) => t.kind === 'video')
    videoTracks.forEach((track) => {
      if (!('contentHint' in track)) {
        console.error('MediaStreamTrack contentHint attribute not supported.')
        return
      }
      track.contentHint = 'motion'
    })

    console.debug('[WebRTC] Track added')
    console.debug('Event:', event)
    console.debug('Settings:', event.track.getSettings?.())
    console.debug('Constraints:', event.track.getConstraints?.())
    console.debug('Capabilities:', event.track.getCapabilities?.())
  }

  /**
   * Called when a peer is connected
   */
  private onPeerConnected(): void {
    this.connected.value = true
  }

  /**
   *
   * @param {Stream} stream
   * @param {string} consumerId
   */
  private requestSession(stream: Stream, consumerId: string): void {
    console.debug(`[WebRTC] Requesting stream:`, stream)

    // Requests a new Session ID
    this.signaller.requestSessionId(consumerId, stream.id, (receivedSessionId: string): void => {
      this.onSessionIdReceived(stream, stream.id, receivedSessionId)
    })

    this.hasEnded = false
  }

  /**
   *
   */
  private startSession(): void {
    if (this.waitingForSessionStart) {
      return
    }
    this.waitingForSessionStart = true

    window.setTimeout(() => {
      if (!this.waitingForSessionStart) {
        return
      }

      const stream = this.availableStreams.value.find((s) => {
        return s.name === this.streamName
      })
      if (stream === undefined) {
        const error = `Failed to start a new Session with "${this.streamName}". Reason: not available`
        console.error('[WebRTC] ' + error)
        this.updateStreamStatus(error)

        this.waitingForSessionStart = false
        this.startSession()
        return
      }

      const msg = `Starting session with producer "${stream.id}" ("${this.streamName}")`
      this.updateStreamStatus(msg)
      console.debug('[WebRTC] ' + msg)

      if (this.consumerId === undefined) {
        const error =
          'Failed to start a new Session with producer' +
          `"${stream.id}" ("${this.streamName}"). Reason: undefined consumerId`
        console.error('[WebRTC] ' + error)
        this.updateStreamStatus(error)

        this.startConsumer()
        this.startSession()
        return
      }

      this.requestSession(stream, this.consumerId)

      this.waitingForSessionStart = false
    }, 1000)
  }

  /**
   *
   * @param {string} reason
   */
  private onSessionClosed(reason: string): void {
    this.stopSession(reason)
    this.consumerId = undefined
    this.startConsumer()
    this.startSession()
  }

  /**
   *
   * @param {Stream} stream
   * @param {string} producerId
   * @param {string} receivedSessionId
   */
  private onSessionIdReceived(stream: Stream, producerId: string, receivedSessionId: string): void {
    // Create a new Session with the received Session ID
    this.session = new Session(
      receivedSessionId,
      this.consumerId!,
      stream,
      this.signaller,
      this.rtcConfiguration,
      this.selectedICEIPs,
      this.selectedICEProtocols,
      (event: RTCTrackEvent): void => this.onTrackAdded(event),
      (): void => this.onPeerConnected(),
      (availableICEIPs: string[]) => (this.availableICEIPs.value = availableICEIPs),
      (_sessionId, reason) => this.onSessionClosed(reason),
      (status: string): void => this.updateStreamStatus(status)
    )

    // Registers Session callback for the Signaller endSession parser
    this.signaller.parseEndSessionQuestion(this.consumerId!, producerId, this.session.id, (sessionId, reason) => {
      console.debug(`[WebRTC] Session ${sessionId} ended. Reason: ${reason}`)
      this.session = undefined
      this.hasEnded = true
    })

    // Registers Session callbacks for the Signaller Negotiation parser
    this.signaller.parseNegotiation(
      this.consumerId!,
      producerId,
      this.session.id,
      this.session.onIncomingICE.bind(this.session),
      this.session.onIncomingSDP.bind(this.session)
    )

    const msg = `Session ${this.session.id} successfully started`
    console.debug('[WebRTC] ' + msg)
    this.updateStreamStatus(msg)
  }

  /**
   *
   * @param {string} reason
   */
  private stopSession(reason: string): void {
    if (this.session === undefined) {
      console.debug('[WebRTC] Stopping an undefined session, probably it was already stopped?')
      return
    }
    const msg = `Stopping session ${this.session.id}. Reason: ${reason}`
    this.updateStreamStatus(msg)
    console.debug('[WebRTC] ' + msg)

    this.session.end()
    this.session = undefined
    this.hasEnded = true
  }
}
