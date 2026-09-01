import { WebRTCStats } from '@peermetrics/webrtc-stats'

import { getDataLakeVariableData, getDataLakeVariableLastUpdateTimestamp } from '@/libs/actions/data-lake'
import { StreamPeerConnectionInfo, WebRTCVideoStat } from '@/types/video'

const maxVideoStatAge = 2000

// Callers hold the external id, and the video store registers the internal stream name used in persisted ids; a stream with no correspondency entry is not followed.
let publishedStreamName: (externalId: string) => string | undefined = () => undefined

/**
 * Choose the stream name persisted in data-lake stat ids
 * @param {(externalId: string) => string | undefined} resolve - Maps the caller's external id to the internal name
 */
export const setStreamStatPublishedName = (resolve: (externalId: string) => string | undefined): void => {
  publishedStreamName = resolve
}

/**
 * Data-lake variable id under which a stream's inbound-video stat is published
 * @param {string} streamName - Name of the stream the stat belongs to, as the caller holds it
 * @param {WebRTCVideoStat} statName - Stat published under the id
 * @returns {string | undefined} The data-lake variable id, or undefined when the stream has no internal name
 */
export const streamStatVariableId = (streamName: string, statName: WebRTCVideoStat): string | undefined => {
  const internalName = publishedStreamName(streamName)
  if (internalName === undefined) return undefined
  return `stream-${internalName}-${statName}`
}

/**
 * Follow how long a stream's video has gone without arriving, going by the bytes its stats report received
 * @param {string} streamName - Name of the stream to follow
 * @param {string} missingStatConsequence - What goes unwatched without the stat, logged once when it is missing
 * @returns {() => number | undefined} Reads the seconds since the video last arrived, or undefined while the stat
 * is missing or stale
 */
export const trackVideoArrival = (streamName: string, missingStatConsequence: string): (() => number | undefined) => {
  let statId = streamStatVariableId(streamName, 'bytesReceived')
  let lastBytesReceived: number | undefined
  let lastChangeTime = performance.now()
  let missingStatReported = false

  return () => {
    const nextStatId = streamStatVariableId(streamName, 'bytesReceived')
    // A renamed stream publishes under a new id; keep following the one being written
    if (nextStatId !== statId) {
      statId = nextStatId
      lastBytesReceived = undefined
      lastChangeTime = performance.now()
      missingStatReported = false
    }

    if (statId === undefined) {
      if (!missingStatReported) console.warn(`Without a correspondency entry, ${missingStatConsequence}.`)
      missingStatReported = true
      return undefined
    }

    const bytesReceived = getDataLakeVariableData(statId)
    if (typeof bytesReceived !== 'number') {
      if (!missingStatReported) console.warn(`Without '${statId}', ${missingStatConsequence}.`)
      missingStatReported = true
      return undefined
    }

    // A stat nobody is publishing any more says nothing about the media, and it starves along with the main thread
    const lastStatUpdate = getDataLakeVariableLastUpdateTimestamp(statId)
    if (lastStatUpdate === undefined || performance.now() - lastStatUpdate > maxVideoStatAge) return undefined

    // Any difference counts as traffic, a drop included, since a renewed session restarts the count from zero
    if (bytesReceived !== lastBytesReceived) {
      lastBytesReceived = bytesReceived
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
