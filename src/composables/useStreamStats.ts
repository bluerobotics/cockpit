import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { computed, effectScope, reactive, watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { isElectron } from '@/libs/utils'
import { buildGo2rtcStreamSample, Go2rtcIngestCounters, Go2rtcStreamSample } from '@/libs/video/stream-stats'
import { monitorStreamPeerConnection, noteStreamBytesReceived, streamStatVariableId } from '@/libs/webrtc/stats'
import { useVideoStore } from '@/stores/video'
import { type Go2RTCStreamInfo, WebRTCStatsEvent, WebRTCVideoStat, WebRTCVideoStats } from '@/types/video'

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

// Latest go2rtc ingest sample per stream, keyed by external stream id. Shared by the stats-for-nerds
// panel and any other live consumer.
const go2rtcStreamSamples = reactive<Record<string, Go2rtcStreamSample | undefined>>({})

// The sampler differences over its own fixed window, never over a caller-dependent shared one
const prevGo2rtcCounters: Record<string, Go2rtcIngestCounters> = {}
let go2rtcSamplerTimer: ReturnType<typeof setTimeout> | null = null
let go2rtcSamplerEnabled = false
let go2rtcSamplerRunning = false
let go2rtcPanelConsumers = 0
// 10 Hz while a panel consumes the samples; otherwise consume the video store's 5 s poll so idle
// Standalone does not query go2rtc twice
const go2rtcFastSampleIntervalMs = 100
// Set by initialize so a live consumer can restart an idle sampler at the fast cadence
let pokeGo2rtcSampler: () => void = () => undefined

let initialized = false
// Detached scope: the collector watch must live for the app's lifetime, not the first caller's
const collectorScope = effectScope(true)

const initialize = (): void => {
  const videoStore = useVideoStore()

  const applyGo2rtcStreamsInfo = (allInfo: Record<string, Go2RTCStreamInfo>): void => {
    // Drop counters and samples of streams that left, so a returning stream starts a fresh window
    // and consumers stop seeing the last sample of a departed one
    Object.keys(prevGo2rtcCounters).forEach((name) => {
      if (!(name in allInfo)) delete prevGo2rtcCounters[name]
    })
    Object.keys(go2rtcStreamSamples).forEach((name) => {
      if (!(name in allInfo)) delete go2rtcStreamSamples[name]
    })

    Object.entries(allInfo).forEach(([streamName, info]) => {
      go2rtcStreamSamples[streamName] = buildGo2rtcStreamSample(info, prevGo2rtcCounters[streamName])
      prevGo2rtcCounters[streamName] = { bytes: info.bytes, packets: info.packets, sampleEpoch: info.sampleEpoch }
    })
  }

  const sampleGo2rtcStreams = async (): Promise<void> => {
    if (!isElectron() || !window.electronAPI) return
    try {
      const allInfo = await window.electronAPI.go2rtcGetStreamsInfo()
      // A failed or not-yet-ready query is not "no streams" - skip the tick so counters and
      // rates stay at the last good sample instead of a fabricated stall
      if (allInfo === undefined) return

      applyGo2rtcStreamsInfo(allInfo)
    } catch {
      // go2rtc may not be running yet
    }
  }

  const isGo2rtcFastSampling = (): boolean => go2rtcPanelConsumers > 0

  const runGo2rtcSampler = async (): Promise<void> => {
    go2rtcSamplerTimer = null
    go2rtcSamplerRunning = true
    try {
      await sampleGo2rtcStreams()
    } finally {
      go2rtcSamplerRunning = false
    }
    if (!go2rtcSamplerEnabled) return
    // Idle consumes the video store's 5 s poll; only keep our own chain while something needs 10 Hz
    if (!isGo2rtcFastSampling()) return
    go2rtcSamplerTimer = setTimeout(() => void runGo2rtcSampler(), go2rtcFastSampleIntervalMs)
  }

  pokeGo2rtcSampler = (): void => {
    if (!go2rtcSamplerEnabled) return
    // An in-flight tick already has the updated consumer count; its reschedule will use it
    if (go2rtcSamplerRunning) return
    if (go2rtcSamplerTimer !== null) {
      clearTimeout(go2rtcSamplerTimer)
      go2rtcSamplerTimer = null
    }
    go2rtcSamplerTimer = setTimeout(() => void runGo2rtcSampler(), 0)
  }

  collectorScope.run(() => {
    // Monitor the active streams to add the connections to the WebRTC statistics
    watch(videoStore.activeStreams, (streams) => {
      // Drop samples of streams that are no longer active, so consumers don't see stale data
      Object.keys(go2rtcStreamSamples).forEach((name) => {
        if (streams[name]?.go2rtcManager === undefined) delete go2rtcStreamSamples[name]
      })
      Object.keys(webRtcStreamStatsSnapshots).forEach((name) => {
        if (streams[name] === undefined) delete webRtcStreamStatsSnapshots[name]
      })

      Object.keys(streams).forEach((streamName) => {
        const pcInfo = videoStore.getStreamPeerConnection(streamName)
        if (!pcInfo) return

        if (collectors[streamName] === undefined) {
          collectors[streamName] = new WebRTCStats({ getStatsInterval: 100 })
        }

        if (collectors[streamName].peersToMonitor[pcInfo.peerId]) return

        monitorStreamPeerConnection(collectors[streamName], pcInfo)

        // Persisted artifacts use the internal stream name; an unmapped stream gets no variables, so the
        // external id (an RTSP URL, credentials included) never reaches a variable name
        storedKeys.forEach((key) => {
          const internalName = videoStore.internalStreamNameFromExternal(streamName)
          if (internalName === undefined) return
          if (getDataLakeVariableInfo(streamStatVariableId(internalName, key)) === undefined) {
            const streamVariable = {
              id: streamStatVariableId(internalName, key),
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
            noteStreamBytesReceived(streamName, videoData.bytesReceived)
            const internalName = videoStore.internalStreamNameFromExternal(streamName)
            if (internalName === undefined) return
            storedKeys.forEach((key) => {
              setDataLakeVariableData(streamStatVariableId(internalName, key), videoData[key])
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
      () => videoStore.go2rtcStreamInfo,
      (allInfo) => {
        if (!go2rtcSamplerEnabled || isGo2rtcFastSampling()) return
        applyGo2rtcStreamsInfo(allInfo)
      }
    )
    watch(
      hasActiveRtspStreams,
      (hasActive) => {
        go2rtcSamplerEnabled = hasActive
        if (hasActive) {
          if (isGo2rtcFastSampling()) {
            if (go2rtcSamplerTimer === null && !go2rtcSamplerRunning) {
              go2rtcSamplerTimer = setTimeout(() => void runGo2rtcSampler(), 0)
            }
          } else {
            applyGo2rtcStreamsInfo(videoStore.go2rtcStreamInfo)
          }
        } else if (go2rtcSamplerTimer !== null) {
          clearTimeout(go2rtcSamplerTimer)
          go2rtcSamplerTimer = null
        }
      },
      { immediate: true }
    )
  })
}

const acquireGo2rtcSampling = (): void => {
  go2rtcPanelConsumers += 1
  pokeGo2rtcSampler()
}

const releaseGo2rtcSampling = (): void => {
  go2rtcPanelConsumers = Math.max(0, go2rtcPanelConsumers - 1)
}

/**
 * Access the shared per-stream stats collectors, starting them on first call
 * @returns {object} The latest stats sample per stream, keyed by external stream id, and the
 * acquire/release pair live consumers of go2rtc samples use to keep the sampler at its fast cadence
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
  /**
   * Register a live consumer of go2rtc samples (e.g. an open stats-for-nerds panel), switching the
   * sampler to its fast cadence immediately
   */
  acquireGo2rtcSampling: () => void
  /**
   * Unregister a live consumer of go2rtc samples
   */
  releaseGo2rtcSampling: () => void
} => {
  if (!initialized) {
    initialized = true
    initialize()
  }

  return { webRtcStreamStatsSnapshots, go2rtcStreamSamples, acquireGo2rtcSampling, releaseGo2rtcSampling }
}
