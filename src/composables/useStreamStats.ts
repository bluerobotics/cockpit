import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { effectScope, reactive, watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { monitorStreamPeerConnection } from '@/libs/webrtc/stats'
import { useVideoStore } from '@/stores/video'
import { WebRTCStatsEvent, WebRTCVideoStat, WebRTCVideoStats } from '@/types/video'

// Track the WebRTC statistics, warn about changes in cumulative values and log the average values
const cumulativeKeys: WebRTCVideoStat[] = [
  'bytesReceived',
  'firCount',
  'framesDecoded',
  'framesDropped',
  'framesReceived',
  'freezeCount',
  'headerBytesReceived',
  'jitterBufferEmittedCount',
  'keyFramesDecoded',
  'lastPacketReceivedTimestamp',
  'nackCount',
  'packetsLost',
  'packetsReceived',
  'pauseCount',
  'pliCount',
  'timestamp',
  'totalAssemblyTime',
  'totalDecodeTime',
  'totalFreezesDuration',
  'totalInterFrameDelay',
  'totalPausesDuration',
  'totalProcessingDelay',
  'totalSquaredInterFrameDelay',
] // Keys that have cumulative values
const averageKeys: WebRTCVideoStat[] = [
  'clockRate',
  'frameHeight',
  'framesAssembledFromMultiplePackets',
  'framesPerSecond',
  'jitter',
  'jitterBufferDelay',
  'jitterBufferMinimumDelay',
  'jitterBufferTargetDelay',
  'packetRate',
] // Keys that have average values
const storedKeys = [...cumulativeKeys, ...averageKeys] // Keys to store in the history

// Latest inbound video stats per stream, keyed by external stream id, updated at the collector's
// 100 ms cadence. Shared by the stats-for-nerds panel and any other live consumer.
const webRtcStreamStatsSnapshots = reactive<Record<string, WebRTCVideoStats | undefined>>({})

// One collector per stream, shared by every consumer so an open panel never doubles the sampling work
const collectors: Record<string, ReturnType<typeof WebRTCStats>> = {}
const streamsAlreadyTrackingWebRTCStats: string[] = []

let initialized = false
// Detached scope: the collector watch must live for the app's lifetime, not the first caller's
const collectorScope = effectScope(true)

const initializeCollectors = (): void => {
  const videoStore = useVideoStore()

  // Persisted artifacts use the internal stream name; the external id is only for display
  const streamStatVariableId = (streamName: string, statKeyName: string): string => {
    const internalName = videoStore.internalStreamNameFromExternal(streamName) ?? streamName
    return `stream-${internalName}-${statKeyName}`
  }

  collectorScope.run(() => {
    // Monitor the active streams to add the connections to the WebRTC statistics
    watch(videoStore.activeStreams, (streams) => {
      Object.keys(streams).forEach((streamName) => {
        const pcInfo = videoStore.getStreamPeerConnection(streamName)
        if (!pcInfo) return

        if (collectors[streamName] === undefined) {
          collectors[streamName] = new WebRTCStats({ getStatsInterval: 100 })
        }

        if (collectors[streamName].peersToMonitor[pcInfo.peerId]) return

        monitorStreamPeerConnection(collectors[streamName], pcInfo)

        storedKeys.forEach((key) => {
          // The external id of an RTSP stream is its URL, credentials included, so the user-facing
          // name and description use the internal name, like the persisted id
          const internalName = videoStore.internalStreamNameFromExternal(streamName) ?? streamName
          if (getDataLakeVariableInfo(streamStatVariableId(streamName, key)) === undefined) {
            const streamVariable = {
              id: streamStatVariableId(streamName, key),
              name: `Stream '${internalName}' - ${key}`,
              type: 'number',
              description: `WebRTC stat '${key}' of the '${internalName}' video stream.`,
            } as DataLakeVariable
            createDataLakeVariable(streamVariable)
          }
        })

        if (streamsAlreadyTrackingWebRTCStats.includes(streamName)) return
        streamsAlreadyTrackingWebRTCStats.push(streamName)

        collectors[streamName].on('stats', (ev: WebRTCStatsEvent) => {
          try {
            // Stats for a peer we no longer monitor describe a connection that has already been replaced
            if (!collectors[streamName].peersToMonitor[ev.peerId]) return

            const videoData = ev.data.video.inbound[0]
            if (videoData === undefined) return

            webRtcStreamStatsSnapshots[streamName] = videoData

            storedKeys.forEach((key) => {
              setDataLakeVariableData(streamStatVariableId(streamName, key), videoData[key])
            })
          } catch (error) {
            console.error('Error while logging WebRTC statistics:', error)
          }
        })
      })
    })
  })
}

/**
 * Access the shared per-stream stats collectors, starting them on first call
 * @returns {object} The latest WebRTC stats snapshot per stream, keyed by external stream id
 */
export const useStreamStats = (): {
  /**
   * Latest inbound video stats per stream, keyed by external stream id
   */
  webRtcStreamStatsSnapshots: Record<string, WebRTCVideoStats | undefined>
} => {
  if (!initialized) {
    initialized = true
    initializeCollectors()
  }

  return { webRtcStreamStatsSnapshots }
}
