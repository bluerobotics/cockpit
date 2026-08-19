import { WebRTCStats } from '@peermetrics/webrtc-stats'

import { StreamPeerConnectionInfo } from '@/types/video'

/**
 * Register a stream's current peer connection for stats monitoring, dropping the monitors of the previous ones
 * Expects a stats instance dedicated to a single stream, as every other peer registered on it is dropped
 * @param {ReturnType<typeof WebRTCStats>} stats - Stats instance monitoring the stream
 * @param {StreamPeerConnectionInfo} pcInfo - The peer connection the stream is currently using, and its ids
 */
export const monitorStreamPeerConnection = (
  stats: ReturnType<typeof WebRTCStats>,
  pcInfo: StreamPeerConnectionInfo
): void => {
  const stalePeerIds = Object.keys(stats.peersToMonitor).filter((peerId) => peerId !== pcInfo.peerId)

  stats.addConnection({
    pc: pcInfo.peerConnection,
    peerId: pcInfo.peerId,
    connectionId: pcInfo.sessionId,
    remote: false,
  })

  // Dropped only once the new peer is in, as the library restarts its monitoring intervals whenever the peer
  // count rises from zero, leaking the interval it was already running
  stalePeerIds.forEach((peerId) => stats.removePeer(peerId))
}
