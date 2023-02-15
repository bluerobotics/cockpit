/* eslint-disable jsdoc/no-undefined-types */ // TODO: fix type RTCConfiguration, RTCSessionDescriptionInit, RTCIceCandidateInit and RTCPeerConnectionIceEventInit are undefined
import type { Signaller } from '@/libs/webrtc/signaller'
import type { Stream } from '@/libs/webrtc/signalling_protocol'

type OnCloseCallback = (sessionId: string, reason: string) => void
type OnTrackAddedCallback = (event: RTCTrackEvent) => void

/**
 * An abstraction for the Mavlink Camera Manager WebRTC Session
 */
export class Session {
  public id: string
  public consumerId: string
  public stream: Stream
  public status: string
  private ended: boolean
  private signaller: Signaller
  private peerConnection: RTCPeerConnection
  public rtcConfiguration: RTCConfiguration
  public onTrackAdded?: OnTrackAddedCallback
  public onClose?: OnCloseCallback

  /**
   * Creates a new Session instance, connecting with a given Stream
   *
   * @param {string} sessionId - Unique ID of the session, given by the signalling server
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {Stream} stream - The Stream instance for which this Session will be created with, given by the signalling server
   * @param {Signaller} signaller - The Signaller instance for this Session to use
   * @param {RTCConfiguration} rtcConfiguration - Configuration for the RTC connection, such as Turn and Stun servers
   * @param {OnTrackAddedCallback} onTrackAdded - An optional callback for when a track is added to this session
   * @param {OnCloseCallback} onClose - An optional callback for when this session closes
   */
  constructor(
    sessionId: string,
    consumerId: string,
    stream: Stream,
    signaller: Signaller,
    rtcConfiguration: RTCConfiguration,
    onTrackAdded?: OnTrackAddedCallback,
    onClose?: OnCloseCallback
  ) {
    this.id = sessionId
    this.consumerId = consumerId
    this.stream = stream
    this.onTrackAdded = onTrackAdded
    this.onClose = onClose
    this.status = ''
    this.signaller = signaller
    this.rtcConfiguration = rtcConfiguration
    this.ended = false

    this.peerConnection = this.createRTCPeerConnection(rtcConfiguration)

    this.updateStatus('[WebRTC] [Session] Creating Session...')
  }

  /**
   * Whether the session has ended
   *
   * @returns {boolean} true if the session has ended, false otherwise
   */
  public hasEnded(): boolean {
    return this.ended
  }

  /**
   * Whether the session is connected
   *
   * @returns {boolean} true if the session is connected, false otherwise
   */
  public isConnected(): boolean {
    return this.peerConnection.connectionState == 'connected'
  }

  /**
   * Updates its status
   *
   * @param {string} status - its new status
   */
  public updateStatus(status: string): void {
    this.status = status
  }

  /**
   * Creates its RTCPeerConnection, registering all callbacks
   *
   * @param {RTCConfiguration} configuration - Configuration for the RTC connection, such as Turn and Stun servers
   * @returns {RTCPeerConnection} - A new instance of RTCPeerConnection
   */
  private createRTCPeerConnection(configuration: RTCConfiguration): RTCPeerConnection {
    console.debug('[WebRTC] [Session] Creating RTCPeerConnection')

    const peerConnection = new RTCPeerConnection(configuration)
    peerConnection.addTransceiver('video', {
      direction: 'recvonly',
    })
    this.ended = false

    peerConnection.addEventListener('negotiationneeded', this.onNegotiationNeeded.bind(this))
    peerConnection.addEventListener('track', this.onTrackAddedCallback.bind(this))
    peerConnection.addEventListener('icecandidate', this.onIceCandidate.bind(this))
    peerConnection.addEventListener('icecandidateerror', this.onIceCandidateError.bind(this))
    peerConnection.addEventListener('iceconnectionstatechange', this.onIceConnectionStateChange.bind(this))
    peerConnection.addEventListener('connectionstatechange', this.onConnectionStateChange.bind(this))
    peerConnection.addEventListener('signalingstatechange', this.onSignalingStateChange.bind(this))
    peerConnection.addEventListener('icegatheringstatechange', this.onIceGatheringStateChange.bind(this))

    return peerConnection
  }

  /**
   * Defines the behavior for when a remote SDP is received from the signalling server
   *
   * @param {RTCSessionDescription} description - The SDP received from the signalling server
   */
  public onIncomingSDP(description: RTCSessionDescription): void {
    this.peerConnection
      .setRemoteDescription(description)
      .then(() => {
        console.debug(`[WebRTC] [Session] Remote description set to ${JSON.stringify(description, null, 4)}`)
        this.onRemoteDescriptionSet()
      })
      .catch((reason) =>
        console.error(`[WebRTC] [Session] Failed setting remote description ${description}. Reason: ${reason}`)
      )
  }

  /**
   * Defines the behavior for when a remote SDP is set to its RTCPeerConnection
   */
  private onRemoteDescriptionSet(): void {
    this.peerConnection
      .createAnswer()
      .then((description: RTCSessionDescriptionInit) => {
        console.debug(`[WebRTC] [Session] SDP Answer created as: ${JSON.stringify(description, null, 4)}`)
        this.onAnswerCreated(description)
      })
      .catch((reason) => console.error(`[WebRTC] [Session] Failed creating description answer. Reason: ${reason}`))
  }

  /**
   * Defines the behavior for when a local SDP is created by its RTCPeerConnection
   *
   * @param {RTCSessionDescriptionInit} description - The local SDP created by its RTCPeerConnection
   */
  private onAnswerCreated(description: RTCSessionDescriptionInit): void {
    this.peerConnection
      .setLocalDescription(description)
      .then(() => {
        console.debug(`[WebRTC] [Session] Local description set as${JSON.stringify(description, null, 4)}`)
        this.onLocalDescriptionSet()
      })
      .catch(function (reason) {
        console.error(`[WebRTC] [Session] Failed setting local description. Reason: ${reason}`)
      })
  }

  /**
   * Defines the behavior for when a local SDP is set to its RTCPeerConnection
   */
  private onLocalDescriptionSet(): void {
    if (this.peerConnection.localDescription === null) {
      return
    }

    this.signaller.sendMediaNegotiation(this.id, this.consumerId, this.stream.id, this.peerConnection.localDescription)
  }

  /**
   * Defines the behavior for when it receives an ICE candidate from the signalling server
   *
   * @param {RTCIceCandidateInit} candidate - The ICE candidate received from the signalling server
   */
  public onIncomingICE(candidate: RTCIceCandidateInit): void {
    this.peerConnection
      .addIceCandidate(candidate)
      .then(() => console.debug(`[WebRTC] [Session] ICE candidate added: ${JSON.stringify(candidate, null, 4)}`))
      .catch((reason) =>
        console.error(`[WebRTC] [Session] Failed adding ICE candidate ${candidate}. Reason: ${reason}`)
      )
  }

  /**
   * Defines the behavior for when a local ICE candidate is created by its RTCPeerConnection
   *
   * @param {RTCPeerConnectionIceEventInit} event - the ICE candidate created by its RTCPeerConnection
   */
  private onIceCandidate(event: RTCPeerConnectionIceEventInit): void {
    if (!event.candidate) {
      return
    }

    this.signaller.sendIceNegotiation(this.id, this.consumerId, this.stream.id, event.candidate)
  }

  /**
   * Defines the behavior for when a ICE negotation fails. Read more about it [here](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidateerror_event)
   *
   * @param {Event} event - the ICE candidate created by its RTCPeerConnection
   */
  private onIceCandidateError(event: Event): void {
    const ev = event as RTCPeerConnectionIceErrorEvent
    console.debug(`[WebRTC] [Session] ICE Candidate "${ev.url}" negotiation failed`)
  }

  /**
   * Defines the behavior for when a track is added to its RTCPeerConnection
   *
   * @param {RTCTrackEvent} event - The RTCTrackEvent given by its RTCPeerConnection
   */
  private onTrackAddedCallback(event: RTCTrackEvent): void {
    this.onTrackAdded?.(event)
  }

  /**
   * Defines the behavior for when a track is added to its RTCPeerConnection
   *
   * @param {Event} _event - The RTCTrackEvent given by its RTCPeerConnection
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private onNegotiationNeeded(_event: Event): void {
    console.debug('[WebRTC] [Session] Peer Connection is waiting for negotiation...')
  }

  /**
   * Defines the behavior for the RTCPeerConnection's 'oniceconnectionstatechange' event
   */
  private onIceConnectionStateChange(): void {
    const msg = `ICEConnection state changed to "${this.peerConnection.iceConnectionState}"`
    console.debug('[WebRTC] [Session] ' + msg)

    if (this.peerConnection.iceConnectionState === 'failed') {
      this.peerConnection.restartIce()
    }
  }

  /**
   * Defines the behavior for the RTCPeerConnection's 'onconnectionstatechange' event
   */
  private onConnectionStateChange(): void {
    const msg = `RTCPeerConnection state changed to "${this.peerConnection.connectionState}"`
    console.debug('[WebRTC] [Session] ' + msg)

    if (this.peerConnection.connectionState === 'failed') {
      this.onClose?.(this.id, 'PeerConnection failed')
      this.end()
    }
  }

  /**
   * Defines the behavior for the RTCPeerConnection's 'onsignalingstatechange' event
   */
  private onSignalingStateChange(): void {
    const msg = `Signalling state changed to "${this.peerConnection.iceConnectionState}"`
    console.debug('[WebRTC] [Session] ' + msg)
  }

  /**
   * Defines the behavior for the RTCPeerConnection's 'onicegatheringstatechange' event
   */
  private onIceGatheringStateChange(): void {
    if (this.peerConnection.iceGatheringState === 'complete') {
      console.debug(`[WebRTC] [Session] ICE gathering completed for session ${this.id}`)
    }
  }

  /**
   * Ends this Session, unregistering all its RTCPeerConnection and parents callbacks
   */
  public end(): void {
    this.endPeerConnection()

    // Unlink parent callbacks
    this.onTrackAdded = undefined
    this.onClose = undefined

    this.ended = true

    console.debug(`[WebRTC] [Session] Session ${this.id} ended.`)
  }

  /**
   * Helper method that takes care of everything necessary to nicely close our peerConnection
   */
  private endPeerConnection(): void {
    // Cleanup event listeners
    this.peerConnection.removeEventListener('negotiationneeded', this.onNegotiationNeeded.bind(this))
    this.peerConnection.removeEventListener('track', this.onTrackAddedCallback.bind(this))
    this.peerConnection.removeEventListener('icecandidate', this.onIceCandidate.bind(this))
    this.peerConnection.removeEventListener('icecandidateerror', this.onIceCandidateError.bind(this))
    this.peerConnection.removeEventListener('iceconnectionstatechange', this.onIceConnectionStateChange.bind(this))
    this.peerConnection.removeEventListener('connectionstatechange', this.onConnectionStateChange.bind(this))
    this.peerConnection.removeEventListener('signalingstatechange', this.onSignalingStateChange.bind(this))
    this.peerConnection.removeEventListener('icegatheringstatechange', this.onIceGatheringStateChange.bind(this))

    // Close peer connection
    this.peerConnection.close()
  }
}
