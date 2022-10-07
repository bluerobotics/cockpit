/**
 *
 */
export interface SignallingMessage {
  /**
   *
   */
  type: string
  /**
   *
   */
  peerType?: string
  /**
   *
   */
  peerId?: string
  /**
   *
   */
  displayName?: string
  /**
   *
   */
  producers?: RtcPeer[]
  /**
   *
   */
  ice?: RTCIceCandidateInit
  /**
   *
   */
  sdp?: RTCSessionDescriptionInit
}

/**
 *
 */
export interface RtcPeer {
  /**
   *
   */
  displayName: string
  /**
   *
   */
  id: string
  /**
   *
   */
  connection?: RTCPeerConnection
}
