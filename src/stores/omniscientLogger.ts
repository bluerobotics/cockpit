import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { differenceInSeconds } from 'date-fns'
import { defineStore } from 'pinia'
import { watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { WebRTCStatsEvent, WebRTCVideoStat } from '@/types/video'

import { useVideoStore } from './video'

export const useOmniscientLoggerStore = defineStore('omniscient-logger', () => {
  const videoStore = useVideoStore()

  // Routine to log the memory usage of the application
  const cockpitMemoryUsageVariable = new DataLakeVariable(
    'cockpit-memory-usage',
    'Cockpit Memory Usage',
    'number',
    'The memory usage of the Cockpit application in MB. This value is updated every 100ms.'
  )
  createDataLakeVariable(cockpitMemoryUsageVariable)

  setInterval(() => {
    const currentMemoryUsage = window.performance.memory.usedJSHeapSize / 1024 / 1024
    setDataLakeVariableData(cockpitMemoryUsageVariable.id, currentMemoryUsage)
  }, 100)

  // Routine to log the framerate of the application rendering
  const appAverageFrameRateSampleDelay = 100
  const cockpitAppFrameRateVariable = new DataLakeVariable(
    'cockpit-app-frame-rate',
    'Cockpit App Frame Rate',
    'number',
    'The framerate of the Cockpit application rendering in fps. This value is updated every 100ms.'
  )
  createDataLakeVariable(cockpitAppFrameRateVariable)

  const fpsMeter = (): void => {
    let prevTime = performance.now()
    let frames = 0

    requestAnimationFrame(function loop() {
      const time = performance.now()
      frames++
      if (time > prevTime + appAverageFrameRateSampleDelay) {
        const currentFPS = Math.round((frames * 1000) / (time - prevTime))
        setDataLakeVariableData(cockpitAppFrameRateVariable.id, currentFPS)
        prevTime = time
        frames = 0
      }

      requestAnimationFrame(loop)
    })
  }
  fpsMeter()

  // Routine to log the WebRTC statistics
  const webrtcStreamStats: Record<string, ReturnType<typeof WebRTCStats>> = {}
  const streamsAlreadyTrackingWebRTCStats: string[] = []

  const streamRateVariableId = (streamName: string, statKeyName: string): string => {
    return `stream-${streamName}-${statKeyName}`
  }

  // Monitor the active streams to add the connections to the WebRTC statistics
  watch(videoStore.activeStreams, (streams) => {
    Object.keys(streams).forEach((streamName) => {
      const session = streams[streamName]?.webRtcManager.session
      if (!session || !session.peerConnection) return

      if (webrtcStreamStats[streamName] === undefined) {
        webrtcStreamStats[streamName] = new WebRTCStats({ getStatsInterval: 100 })
      }

      if (webrtcStreamStats[streamName].peersToMonitor[session.consumerId]) return

      webrtcStreamStats[streamName].addConnection({
        pc: session.peerConnection, // RTCPeerConnection instance
        peerId: session.consumerId, // any string that helps you identify this peer,
        connectionId: session.id, // optional, an id that you can use to keep track of this connection
        remote: false, // optional, override the global remote flag
      })

      storedKeys.forEach((key) => {
        if (getDataLakeVariableInfo(streamRateVariableId(streamName, key)) === undefined) {
          const streamVariable = new DataLakeVariable(
            streamRateVariableId(streamName, key),
            `Stream '${streamName}' - ${key}`,
            'number',
            `WebRTC stat '${key}' of the '${streamName}' video stream.`
          )
          createDataLakeVariable(streamVariable)
        }
      })

      if (streamsAlreadyTrackingWebRTCStats.includes(streamName)) return
      streamsAlreadyTrackingWebRTCStats.push(streamName)

      webrtcStreamStats[streamName].on('stats', (ev: WebRTCStatsEvent) => {
        try {
          const videoData = ev.data.video.inbound[0]
          if (videoData === undefined) return

          storedKeys.forEach((key) => {
            setDataLakeVariableData(streamRateVariableId(streamName, key), videoData[key])
          })
        } catch (error) {
          console.error('Error while logging WebRTC statistics:', error)
        }
      })
    })
  })

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

  // Routine to send a ping event to the event tracking system every 5 minutes
  const initialTimestamp = new Date()
  setInterval(() => {
    eventTracker.capture('Ping', { runningTimeInSeconds: differenceInSeconds(new Date(), initialTimestamp) })
  }, 1000 * 60 * 5)
})
