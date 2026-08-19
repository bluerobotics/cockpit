/**
 * Sets the RTP receiver jitter buffer target of every video receiver of a peer connection.
 * When left unset the browser uses its own adaptive buffer, which grows on CPU or network starvation and does not
 * shrink back afterwards, so any low-resource event leaves a permanent latency increase behind.
 * @param {RTCPeerConnection} peerConnection - Connection whose video receivers should be configured
 * @param {number} jitterBufferTarget - Target buffer time in milliseconds
 */
export const setJitterBufferTarget = (peerConnection: RTCPeerConnection, jitterBufferTarget: number): void => {
  peerConnection.getReceivers().forEach((receiver: RTCRtpReceiver) => {
    if (receiver.track.kind !== 'video') {
      return
    }

    let playoutDelayHint = null
    if (jitterBufferTarget) {
      if (jitterBufferTarget > 4000) {
        jitterBufferTarget = 4000
      } else if (jitterBufferTarget < 0) {
        jitterBufferTarget = 0
      }

      playoutDelayHint = jitterBufferTarget / 1000 // in seconds, legacy Chrome API
    }

    console.debug(
      `RTCRtpReceiver jitterBufferTarget attribute set from ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (receiver as any).jitterBufferTarget
      } to ${jitterBufferTarget}`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(receiver as any).jitterBufferTarget = jitterBufferTarget // in milliseconds (DOMHighResTimeStamp)

    console.debug(
      `RTCRtpReceiver playoutDelayHint attribute set from ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (receiver as any).playoutDelayHint
      } to ${playoutDelayHint}`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(receiver as any).playoutDelayHint = playoutDelayHint
  })
}
