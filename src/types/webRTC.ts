/**
 * Message to be exchanged (from and to) the webRTC signalling server
 */
export interface SignallingMessage {
  /**
   * Type of the message.
   * The type allows for easy parsing of the message content.
   * Can be 'startSession', 'endSession', 'register', 'list', 'registered', etc.
   */
  type: string
  /**
   * Type of the peer communicating.
   * Can be 'listener', 'consumer', etc.
   */
  peerType?: string
  /**
   * Unique identification of the peer.
   * Changes between server cycles.
   */
  peerId?: string
  /**
   * Human-readable name of the device being streamed.
   * Does not change between server cycles.
   * Used for extra-cycle persistency
   */
  displayName?: string
  /**
   * List of RTC sessions available.
   */
  producers?: RtcPeer[]
  /**
   * Initial RTC Interactive Connectivity Establishment candidate message.
   */
  ice?: RTCIceCandidateInit
  /**
   * Initial RTC session description message.
   */
  sdp?: RTCSessionDescriptionInit
}

/**
 * Member of a webRTC signalling exchange.
 */
export interface RtcPeer {
  /**
   * Human-readable name of the device being streamed.
   * Does not change between server cycles.
   * Used for extra-cycle persistency
   */
  displayName: string
  /**
   * Unique identification of the RTC peer.
   * Changes between server cycles.
   */
  id: string
  /**
   * RTC connection information.
   * Undefined if the connection is not yet established.
   * Contains RTC stream information once stablished.
   */
  connection?: RTCPeerConnection
}
