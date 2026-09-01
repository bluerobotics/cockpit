import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { computed, effectScope, reactive, watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { isElectron } from '@/libs/utils'
import {
  differenceGo2rtcSamples,
  Go2rtcIngestCounters,
  Go2rtcStreamSample,
  Go2rtcStreamStatKey,
  go2rtcStreamStatKeys,
  go2rtcStreamStatVariableId,
  streamStatVariableId,
  webRtcStreamStatKeys,
} from '@/libs/video/stream-stats'
import { monitorStreamPeerConnection } from '@/libs/webrtc/stats'
import { useVideoStore } from '@/stores/video'
import { WebRTCStatsEvent, WebRTCVideoStats } from '@/types/video'

// Data lake variable types of the go2rtc ingest stats
const go2rtcStreamStatTypes: Record<Go2rtcStreamStatKey, 'number' | 'string'> = {
  bytes: 'number',
  packets: 'number',
  sampleEpoch: 'number',
  bitrateKbps: 'number',
  packetsPerSec: 'number',
  codec: 'string',
  width: 'number',
  height: 'number',
  fps: 'string',
  protocol: 'string',
}

// Latest inbound video stats per stream, keyed by external stream id, updated at the collector's
// 100 ms cadence. Shared by the stats-for-nerds panel and any other live consumer.
const webRtcStreamStatsSnapshots = reactive<Record<string, WebRTCVideoStats | undefined>>({})

// One collector per stream, shared by every consumer so an open panel never doubles the sampling work
const collectors: Record<string, ReturnType<typeof WebRTCStats>> = {}
const streamsAlreadyTrackingWebRTCStats: string[] = []

// Latest go2rtc ingest sample per stream, keyed by external stream id. Shared by the stats-for-nerds
// panel and any other live consumer.
const go2rtcStreamSamples = reactive<Record<string, Go2rtcStreamSample | undefined>>({})

// Last known internal name per external stream id, so a rename can carry the stream's recording
// over to the new variable ids
const lastInternalNames: Record<string, string> = {}

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
  const internalStreamName = (streamName: string): string =>
    videoStore.internalStreamNameFromExternal(streamName) ?? streamName

  // Publish one go2rtc sample to the data lake, creating the stream's variables on first sight. The
  // raw counters are exact, so any rate over any window is derivable offline; the derived rates are
  // published for live use (Plotter, overlay, widgets).
  const publishGo2rtcSample = (internalName: string, sample: Go2rtcStreamSample): void => {
    go2rtcStreamStatKeys.forEach((key) => {
      const variableId = go2rtcStreamStatVariableId(internalName, key)
      if (getDataLakeVariableInfo(variableId) === undefined) {
        createDataLakeVariable({
          id: variableId,
          name: `Stream '${internalName}' - RTSP ${key}`,
          type: go2rtcStreamStatTypes[key],
          description: `Incoming video stat '${key}' of the '${internalName}' RTSP stream.`,
        } as DataLakeVariable)
      }

      const value = sample[key]
      if (value !== undefined) setDataLakeVariableData(variableId, value)
    })
  }

  const sampleGo2rtcStreams = async (): Promise<void> => {
    if (!isElectron() || !window.electronAPI) return
    try {
      const allInfo = await window.electronAPI.go2rtcGetStreamsInfo()

      // Drop counters and samples of streams that left, so a returning stream starts a fresh window
      // and consumers stop seeing the last sample of a departed one
      Object.keys(prevGo2rtcCounters).forEach((name) => {
        if (!(name in allInfo)) delete prevGo2rtcCounters[name]
      })
      Object.keys(go2rtcStreamSamples).forEach((name) => {
        if (!(name in allInfo)) delete go2rtcStreamSamples[name]
      })

      Object.entries(allInfo).forEach(([streamName, info]) => {
        // A go2rtc stream Cockpit no longer maps is not one it can publish stats for - skipping it
        // also keeps the external id (an RTSP URL, credentials included) out of variable names
        const internalName = videoStore.internalStreamNameFromExternal(streamName)
        if (internalName === undefined) return

        const previousCounters = prevGo2rtcCounters[streamName]
        const rates = previousCounters ? differenceGo2rtcSamples(previousCounters, info) : undefined
        prevGo2rtcCounters[streamName] = { bytes: info.bytes, packets: info.packets, sampleEpoch: info.sampleEpoch }

        const sample: Go2rtcStreamSample = {
          ...info,
          bitrateKbps: rates?.bitrateKbps ?? 0,
          packetsPerSec: rates?.packetsPerSec ?? 0,
        }
        go2rtcStreamSamples[streamName] = sample
        publishGo2rtcSample(internalName, sample)
      })
    } catch {
      // go2rtc may not be running yet
    }
  }

  // Carry an armed stream's recording over a rename: swap the old ids for the new ones in the
  // recorded set and drop the dead old variables from the data lake
  const carryOverStreamStatRecording = (oldName: string, newName: string): void => {
    const statIds = (name: string): string[] => [
      ...webRtcStreamStatKeys.map((key) => streamStatVariableId(name, key)),
      ...go2rtcStreamStatKeys.map((key) => go2rtcStreamStatVariableId(name, key)),
    ]
    const oldIds = statIds(oldName)
    const newIds = statIds(newName)
    oldIds.forEach((oldId, index) => {
      if (!dataLakeLogger.recordedVariableIds.includes(oldId)) return
      dataLakeLogger.setVariableRecorded(oldId, false)
      dataLakeLogger.setVariableRecorded(newIds[index], true)
    })
    oldIds.forEach((oldId) => {
      if (getDataLakeVariableInfo(oldId) !== undefined) deleteDataLakeVariable(oldId)
    })
  }

  // Register a stream's WebRTC stat variables if missing. Called on every stats event, not only on
  // activation, so a rename (here or synced from another topside) re-registers under the new ids
  // instead of publishing into the void
  const ensureWebRtcStatVariables = (streamName: string): void => {
    webRtcStreamStatKeys.forEach((key) => {
      // The external id of an RTSP stream is its URL, credentials included, so the user-facing
      // name and description use the internal name, like the persisted id
      const internalName = internalStreamName(streamName)
      const variableId = streamStatVariableId(internalName, key)
      if (getDataLakeVariableInfo(variableId) === undefined) {
        const streamVariable = {
          id: variableId,
          name: `Stream '${internalName}' - ${key}`,
          type: 'number',
          description: `WebRTC stat '${key}' of the '${internalName}' video stream.`,
        } as DataLakeVariable
        createDataLakeVariable(streamVariable)
      }
    })
  }

  collectorScope.run(() => {
    // Monitor the active streams to add the connections to the WebRTC statistics
    watch(videoStore.activeStreams, (streams) => {
      // Drop samples of streams that are no longer active, so consumers don't see stale data
      Object.keys(go2rtcStreamSamples).forEach((name) => {
        if (streams[name]?.go2rtcManager === undefined) delete go2rtcStreamSamples[name]
      })

      Object.keys(streams).forEach((streamName) => {
        const pcInfo = videoStore.getStreamPeerConnection(streamName)
        if (!pcInfo) return

        if (collectors[streamName] === undefined) {
          collectors[streamName] = new WebRTCStats({ getStatsInterval: 100 })
        }

        if (collectors[streamName].peersToMonitor[pcInfo.peerId]) return

        monitorStreamPeerConnection(collectors[streamName], pcInfo)

        ensureWebRtcStatVariables(streamName)

        if (streamsAlreadyTrackingWebRTCStats.includes(streamName)) return
        streamsAlreadyTrackingWebRTCStats.push(streamName)

        collectors[streamName].on('stats', (ev: WebRTCStatsEvent) => {
          try {
            // Stats for a peer we no longer monitor describe a connection that has already been replaced
            if (!collectors[streamName].peersToMonitor[ev.peerId]) return

            const videoData = ev.data.video.inbound[0]
            if (videoData === undefined) return

            webRtcStreamStatsSnapshots[streamName] = videoData

            ensureWebRtcStatVariables(streamName)
            webRtcStreamStatKeys.forEach((key) => {
              setDataLakeVariableData(streamStatVariableId(internalStreamName(streamName), key), videoData[key])
            })
          } catch (error) {
            console.error('Error while logging WebRTC statistics:', error)
          }
        })
      })
    })

    // Seed the name map, then carry recording over renames, whether made here or synced from
    // another topside
    videoStore.streamsCorrespondency.forEach((corr) => {
      lastInternalNames[corr.externalId] = corr.name
    })
    watch(videoStore.streamsCorrespondency, (corrs) => {
      corrs.forEach((corr) => {
        const lastName = lastInternalNames[corr.externalId]
        if (lastName !== undefined && lastName !== corr.name) {
          carryOverStreamStatRecording(lastName, corr.name)
        }
        lastInternalNames[corr.externalId] = corr.name
      })
      // A deleted stream's name ends its lineage: a re-added stream starts unarmed
      Object.keys(lastInternalNames).forEach((externalId) => {
        if (!corrs.some((corr) => corr.externalId === externalId)) delete lastInternalNames[externalId]
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
