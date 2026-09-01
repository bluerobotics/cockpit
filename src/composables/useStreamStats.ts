import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { computed, effectScope, reactive, watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { differenceGo2rtcSamples, Go2rtcIngestCounters, Go2rtcStreamSample } from '@/libs/video/stream-stats'
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

// Latest go2rtc ingest sample per stream, keyed by external stream id, updated at the sampler's
// 100 ms cadence. Shared by the stats-for-nerds panel and any other live consumer.
const go2rtcStreamSamples = reactive<Record<string, Go2rtcStreamSample | undefined>>({})

// The sampler differences over its own fixed window, never over a caller-dependent shared one
const prevGo2rtcCounters: Record<string, Go2rtcIngestCounters> = {}
let go2rtcSamplerTimer: ReturnType<typeof setInterval> | null = null
const go2rtcSampleIntervalMs = 100

let initialized = false
// Detached scope: the collector watch must live for the app's lifetime, not the first caller's
const collectorScope = effectScope(true)

const initialize = (): void => {
  const videoStore = useVideoStore()

  // Persisted artifacts use the internal stream name; the external id is only for display
  const streamStatVariableId = (streamName: string, statKeyName: string): string => {
    const internalName = videoStore.internalStreamNameFromExternal(streamName) ?? streamName
    return `stream-${internalName}-${statKeyName}`
  }

  const sampleGo2rtcStreams = async (): Promise<void> => {
    if (!window.electronAPI) return
    try {
      const allInfo = await window.electronAPI.go2rtcGetStreamsInfo()
      Object.entries(allInfo).forEach(([streamName, info]) => {
        const previousCounters = prevGo2rtcCounters[streamName]
        const rates = previousCounters ? differenceGo2rtcSamples(previousCounters, info) : undefined
        prevGo2rtcCounters[streamName] = { bytes: info.bytes, packets: info.packets, sampleEpoch: info.sampleEpoch }

        const previousSample = go2rtcStreamSamples[streamName]
        go2rtcStreamSamples[streamName] = {
          ...info,
          bitrateKbps: rates?.bitrateKbps ?? previousSample?.bitrateKbps ?? 0,
          packetsPerSec: rates?.packetsPerSec ?? previousSample?.packetsPerSec ?? 0,
        }
      })
    } catch {
      // go2rtc may not be running yet
    }
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

    // The go2rtc sampler runs only while at least one RTSP stream is active
    const hasActiveRtspStreams = computed(() =>
      Object.values(videoStore.activeStreams).some((data) => data?.go2rtcManager !== undefined)
    )
    watch(
      hasActiveRtspStreams,
      (hasActive) => {
        if (hasActive && go2rtcSamplerTimer === null) {
          void sampleGo2rtcStreams()
          go2rtcSamplerTimer = setInterval(() => void sampleGo2rtcStreams(), go2rtcSampleIntervalMs)
        } else if (!hasActive && go2rtcSamplerTimer !== null) {
          clearInterval(go2rtcSamplerTimer)
          go2rtcSamplerTimer = null
        }
      },
      { immediate: true }
    )
  })
}

/**
 * Access the shared per-stream stats collectors, starting them on first call
 * @returns {object} The latest stats sample per stream, keyed by external stream id
 */
export const useStreamStats = (): {
  /**
   * Latest inbound WebRTC video stats per stream
   */
  webRtcStreamStatsSnapshots: Record<string, WebRTCVideoStats | undefined>
  /**
   * Latest go2rtc ingest sample per stream, with rates derived over the sampler's own window
   */
  go2rtcStreamSamples: Record<string, Go2rtcStreamSample | undefined>
} => {
  if (!initialized) {
    initialized = true
    initialize()
  }

  return { webRtcStreamStatsSnapshots, go2rtcStreamSamples }
}
