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
import { isElectron } from '@/libs/utils'
import { WebRTCStatsEvent, WebRTCVideoStat } from '@/types/video'

import { useVideoStore } from './video'

export const useOmniscientLoggerStore = defineStore('omniscient-logger', () => {
  const videoStore = useVideoStore()

  // Routine to log the memory usage of the application
  const cockpitMemoryUsageVariable = {
    id: 'cockpit-memory-usage',
    name: 'Cockpit Memory Usage',
    type: 'number',
    description: 'The memory usage of the Cockpit application in MB. This value is updated every 100ms.',
  } as DataLakeVariable
  createDataLakeVariable(cockpitMemoryUsageVariable)

  // Electron-specific memory and CPU metrics (only available in Electron)
  let cockpitMainMemoryVariable: DataLakeVariable | undefined
  let cockpitRenderersMemoryVariable: DataLakeVariable | undefined
  let cockpitGpuMemoryVariable: DataLakeVariable | undefined
  let cockpitCpuUsageVariable: DataLakeVariable | undefined

  if (isElectron()) {
    // Separate memory metrics for different process types
    cockpitMainMemoryVariable = {
      id: 'cockpit-main-memory',
      name: 'Cockpit Main Memory (Electron)',
      type: 'number',
      description:
        'The memory usage of the main process in the standalone Cockpit application, in MB. This value is updated every 100ms. Only available in Electron.',
    } as DataLakeVariable
    createDataLakeVariable(cockpitMainMemoryVariable)

    cockpitRenderersMemoryVariable = {
      id: 'cockpit-renderers-memory',
      name: 'Cockpit Renderers Memory (Electron)',
      type: 'number',
      description:
        'The total memory usage of the renderer processes in the standalone Cockpit application, in MB. This value is updated every 100ms. Only available in Electron.',
    } as DataLakeVariable
    createDataLakeVariable(cockpitRenderersMemoryVariable)

    cockpitGpuMemoryVariable = {
      id: 'cockpit-gpu-memory',
      name: 'Cockpit GPU Memory (Electron)',
      type: 'number',
      description:
        'The memory usage of the GPU in the standalone Cockpit application, in MB. This value is updated every 100ms. Only available in Electron.',
    } as DataLakeVariable
    createDataLakeVariable(cockpitGpuMemoryVariable)

    // CPU usage tracking
    cockpitCpuUsageVariable = {
      id: 'cockpit-cpu-usage',
      name: 'Cockpit CPU Usage (Electron)',
      type: 'number',
      description:
        'The CPU usage of the standalone Cockpit application as a percentage. This value is updated every 100ms. Only available in Electron.',
    } as DataLakeVariable
    createDataLakeVariable(cockpitCpuUsageVariable)
  }

  // Function to get memory usage based on the environment
  const getMemoryUsage = async (): Promise<number> => {
    if (isElectron() && window.electronAPI?.getResourceUsage) {
      try {
        const resourceUsage = await window.electronAPI.getResourceUsage()
        return resourceUsage.totalMemoryMB
      } catch (error) {
        console.warn('Failed to get Electron memory usage, falling back to performance API:', error)
      }
    }

    // Fallback for browsers or when Electron API fails
    if (window.performance && (window.performance as any).memory) {
      return (window.performance as any).memory.usedJSHeapSize / 1024 / 1024
    }

    // If no memory API is available, return 0
    console.warn('No memory usage API available')
    return 0
  }

  // Function to get all resource usage metrics
  const getResourceUsage = async (): Promise<{
    /** Total memory usage in MB */
    totalMemoryMB: number
    /** Main process memory usage in MB */
    mainMemoryMB: number
    /** Renderer processes memory usage in MB */
    renderersMemoryMB: number
    /** GPU process memory usage in MB */
    gpuMemoryMB: number
    /** CPU usage percentage */
    cpuUsagePercent: number
  }> => {
    if (isElectron() && window.electronAPI?.getResourceUsage) {
      try {
        const resourceUsage = await window.electronAPI.getResourceUsage()
        return resourceUsage
      } catch (error) {
        console.warn('Failed to get Electron resource usage:', error)
      }
    }

    // Fallback for browsers or when Electron API fails
    const fallbackMemory = (window.performance as any)?.memory?.usedJSHeapSize / 1024 / 1024 || 0
    return {
      totalMemoryMB: fallbackMemory,
      mainMemoryMB: fallbackMemory,
      renderersMemoryMB: 0,
      gpuMemoryMB: 0,
      cpuUsagePercent: 0,
    }
  }

  setInterval(async () => {
    const currentMemoryUsage = await getMemoryUsage()
    setDataLakeVariableData(cockpitMemoryUsageVariable.id, currentMemoryUsage)

    // Get detailed resource usage for separate metrics (Electron only)
    if (
      isElectron() &&
      cockpitMainMemoryVariable &&
      cockpitRenderersMemoryVariable &&
      cockpitGpuMemoryVariable &&
      cockpitCpuUsageVariable
    ) {
      const resourceUsage = await getResourceUsage()
      setDataLakeVariableData(cockpitMainMemoryVariable.id, resourceUsage.mainMemoryMB)
      setDataLakeVariableData(cockpitRenderersMemoryVariable.id, resourceUsage.renderersMemoryMB)
      setDataLakeVariableData(cockpitGpuMemoryVariable.id, resourceUsage.gpuMemoryMB)
      setDataLakeVariableData(cockpitCpuUsageVariable.id, resourceUsage.cpuUsagePercent)
    }
  }, 100)

  // Routine to log the framerate of the application rendering
  const appAverageFrameRateSampleDelay = 100
  const cockpitAppFrameRateVariable = {
    id: 'cockpit-app-frame-rate',
    name: 'Cockpit App Frame Rate',
    type: 'number',
    description: 'The framerate of the Cockpit application rendering in fps. This value is updated every 100ms.',
  } as DataLakeVariable
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
          const streamVariable = {
            id: streamRateVariableId(streamName, key),
            name: `Stream '${streamName}' - ${key}`,
            type: 'number',
            description: `WebRTC stat '${key}' of the '${streamName}' video stream.`,
          } as DataLakeVariable
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
