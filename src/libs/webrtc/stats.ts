import { WebRTCStats } from '@peermetrics/webrtc-stats'

import { StreamPeerConnectionInfo, WebRTCVideoStat } from '@/types/video'

const maxVideoStatAge = 2000

/**
 * Data-lake variable id under which a stream's inbound-video stat is published
 * @param {string} streamName - Name of the stream the stat belongs to
 * @param {WebRTCVideoStat} statName - Stat published under the id
 * @returns {string} The data-lake variable id
 */
export const streamStatVariableId = (streamName: string, statName: WebRTCVideoStat): string => {
  return `stream-${streamName}-${statName}`
}

// Latest bytes received per stream, keyed by the external id its callers hold, so the watchdog follows every
// active stream whether or not it has a correspondency entry
const bytesReceivedByStream: Record<
  string,
  {
    /**
     * Bytes received so far by the stream's current session
     */
    bytesReceived: number
    /**
     * performance.now() when the stat was last reported
     */
    updatedAt: number
  }
> = {}

/**
 * Record the bytes a stream's stats report received, for its video-arrival watchdog
 * @param {string} streamName - External id of the stream
 * @param {number} bytesReceived - Bytes received so far by the stream's current session
 */
export const noteStreamBytesReceived = (streamName: string, bytesReceived: number): void => {
  bytesReceivedByStream[streamName] = { bytesReceived, updatedAt: performance.now() }
}

/**
 * Follow how long a stream's video has gone without arriving, going by the bytes its stats report received
 * @param {string} streamName - Name of the stream to follow
 * @param {string} missingStatConsequence - What goes unwatched without the stat, logged once when it is missing
 * @returns {() => number | undefined} Reads the seconds since the video last arrived, or undefined while the stat
 * is missing or stale
 */
export const trackVideoArrival = (streamName: string, missingStatConsequence: string): (() => number | undefined) => {
  let lastBytesReceived: number | undefined
  let lastChangeTime = performance.now()
  let missingStatReported = false

  return () => {
    const sample = bytesReceivedByStream[streamName]
    if (typeof sample?.bytesReceived !== 'number') {
      if (!missingStatReported) console.warn(`Without the bytes received stat, ${missingStatConsequence}.`)
      missingStatReported = true
      return undefined
    }

    // A stat nobody is publishing any more says nothing about the media, and it starves along with the main thread
    if (performance.now() - sample.updatedAt > maxVideoStatAge) return undefined

    // Any difference counts as traffic, a drop included, since a renewed session restarts the count from zero
    if (sample.bytesReceived !== lastBytesReceived) {
      lastBytesReceived = sample.bytesReceived
      lastChangeTime = performance.now()
    }
    return (performance.now() - lastChangeTime) / 1000
  }
}

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
