import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { useDocumentVisibility } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { WebRTCStatsEvent, WebRTCVideoStat } from '@/types/video'

import { useVideoStore } from './video'

export const webrtcStats = new WebRTCStats({ getStatsInterval: 250 })

export const useOmniscientLoggerStore = defineStore('omniscient-logger', () => {
  const videoStore = useVideoStore()

  // Routine to log the framerate of the video streams
  const streamsFrameRateHistory = ref<{ [key in string]: number[] }>({})
  let lastStreamAverageFramerateLog = new Date()
  const streamAverageFramerateLogDelay = 10000
  setInterval(() => {
    Object.keys(videoStore.activeStreams).forEach((streamName) => {
      if (videoStore.activeStreams[streamName] === undefined) return
      videoStore.activeStreams[streamName]!.mediaStream?.getVideoTracks().forEach((track) => {
        if (streamsFrameRateHistory.value[streamName] === undefined) streamsFrameRateHistory.value[streamName] = []
        if (track.getSettings().frameRate === undefined) return

        const streamHistory = streamsFrameRateHistory.value[streamName]
        streamHistory.push(track.getSettings().frameRate as number)
        streamHistory.splice(0, streamHistory.length - 10)
        streamsFrameRateHistory.value[streamName] = streamHistory

        const average = streamHistory.reduce((a, b) => a + b, 0) / streamHistory.length
        const minThreshold = 0.9 * average
        const newFrameRate = track.getSettings().frameRate as number

        // Warn about drops in the framerate of the video stream
        if (newFrameRate < minThreshold) {
          console.warn(`Drop in the framerate detected for stream '${streamName}': ${newFrameRate.toFixed(2)} fps.`)
        }

        // Log the average framerate of the video stream recursively
        if (new Date().getTime() - lastStreamAverageFramerateLog.getTime() > streamAverageFramerateLogDelay) {
          console.debug(`Average frame rate for stream '${streamName}': ${average.toFixed(2)} fps.`)
          lastStreamAverageFramerateLog = new Date()
        }
      })
    })
  }, 250)

  // Routine to log the framerate of the application rendering
  const appFrameRateHistory = ref<number[]>([])
  const appAverageFrameRateSampleDelay = 100
  const appAverageFrameRateLogDelay = 10000
  let lastAppAverageFpsLog = new Date()

  // Log tab visibility changes so we don't warn about framerate drops when the tab was not visible in the last seconds
  const windowVisibility = useDocumentVisibility()
  let timeLastTabOpening = new Date()
  watch(windowVisibility, (newVisibility, oldVisibility) => {
    if (newVisibility === 'visible' && oldVisibility === 'hidden') {
      timeLastTabOpening = new Date()
    }
  })

  const fpsMeter = (): void => {
    let prevTime = performance.now()
    let frames = 0

    requestAnimationFrame(function loop() {
      const time = performance.now()
      frames++
      if (time > prevTime + appAverageFrameRateSampleDelay) {
        const currentFPS = Math.round((frames * 1000) / (time - prevTime))
        prevTime = time
        frames = 0

        appFrameRateHistory.value.push(currentFPS)
        appFrameRateHistory.value.splice(0, appFrameRateHistory.value.length - 10)

        const average = appFrameRateHistory.value.reduce((a, b) => a + b, 0) / appFrameRateHistory.value.length

        // Warn about drops in the framerate of the application rendering
        // The threshold is set to 80% of the average framerate by default
        // We don't warn if the framerate is above 60 because it's an already very high value, and we don't want to spam the console on high-end monitors
        // We also don't warn if the tab was not visible in the last second, since the application was not being rendered
        const minThreshold = Math.min(60, 0.8 * average)
        const msSinceLastTabOpening = new Date().getTime() - timeLastTabOpening.getTime()
        if (currentFPS < minThreshold && msSinceLastTabOpening > 1000) {
          console.warn(`Drop in the framerate detected for the application rendering: ${currentFPS.toFixed(2)} fps.`)
        }

        // Log the average framerate of the application rendering recursively
        if (new Date().getTime() - lastAppAverageFpsLog.getTime() > appAverageFrameRateLogDelay) {
          console.debug(`Average framerate for the application rendering: ${average.toFixed(2)} fps.`)
          lastAppAverageFpsLog = new Date()
        }
      }

      requestAnimationFrame(loop)
    })
  }
  fpsMeter()

  // Routine to log the WebRTC statistics

  // Monitor the active streams to add the connections to the WebRTC statistics
  watch(videoStore.activeStreams, (streams) => {
    Object.keys(streams).forEach((streamName) => {
      const session = streams[streamName]?.webRtcManager.session
      if (!session || !session.peerConnection) return
      if (webrtcStats.peersToMonitor[session.consumerId]) return
      webrtcStats.addConnection({
        pc: session.peerConnection, // RTCPeerConnection instance
        peerId: session.consumerId, // any string that helps you identify this peer,
        connectionId: session.id, // optional, an id that you can use to keep track of this connection
        remote: false, // optional, override the global remote flag
      })
    })
  })

  // Track the WebRTC statistics, warn about changes in cumulative values and log the average values
  const historyLength = 30 // Number of samples to keep in the history
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
  const cumulativeKeysThatShouldNotIncrease: WebRTCVideoStat[] = [
    'firCount',
    'framesDropped',
    'freezeCount',
    'nackCount',
    'packetsLost',
    'pauseCount',
    'pliCount',
    'totalFreezesDuration',
    'totalPausesDuration',
  ] // Keys that should not increase
  const averageKeysThatShouldNotDecrease: WebRTCVideoStat[] = [
    'clockRate',
    'framesAssembledFromMultiplePackets',
    'framesPerSecond',
    'packetRate',
  ] // Keys that should not decrease
  const averageKeysThatShouldNotIncrease: WebRTCVideoStat[] = [
    'jitter',
    'jitterBufferDelay',
    'jitterBufferMinimumDelay',
    'jitterBufferTargetDelay',
  ] // Keys that should not increase

  const webrtcStatsAverageLogDelay = 10000
  let lastWebrtcStatsAverageLog = new Date()
  const webRtcStatsHistory = ref<{ [id in string]: { [stat in string]: (number | string)[] } }>({})

  webrtcStats.on('stats', (ev: WebRTCStatsEvent) => {
    try {
      const videoData = ev.data.video.inbound[0]
      if (videoData === undefined) return

      // Initialize the peer's statistics if they do not exist
      if (webRtcStatsHistory.value[ev.peerId] === undefined) webRtcStatsHistory.value[ev.peerId] = {}

      storedKeys.forEach((key) => {
        // Initialize the key array if it does not exist
        if (webRtcStatsHistory.value[ev.peerId][key] === undefined) webRtcStatsHistory.value[ev.peerId][key] = []

        webRtcStatsHistory.value[ev.peerId][key].push(videoData[key])

        // Keep only the last 'historyLength' samples
        const keyArray = webRtcStatsHistory.value[ev.peerId][key]
        keyArray.splice(0, keyArray.length - historyLength)
        webRtcStatsHistory.value[ev.peerId][key] = keyArray
      })

      // Warn about changes in cumulative values that should not increase
      cumulativeKeysThatShouldNotIncrease.forEach((key) => {
        const keyArray = webRtcStatsHistory.value[ev.peerId][key]
        if (keyArray.length < 2) return

        const lastValue = keyArray[keyArray.length - 1]
        const prevValue = keyArray[keyArray.length - 2]

        if (typeof lastValue !== 'number' || typeof prevValue !== 'number') return

        if (lastValue > prevValue) {
          console.warn(`Cumulative value '${key}' increased for peer '${ev.peerId}': ${lastValue.toFixed(2)}.`)
        }
      })

      // Warn about changes in average values that should not change
      averageKeys.forEach((key) => {
        const keyArray = webRtcStatsHistory.value[ev.peerId][key]
        if (keyArray.length < historyLength) return

        const average = (keyArray as number[]).reduce((a, b) => a + b, 0) / keyArray.length
        const currentValue = keyArray[keyArray.length - 1] as number

        if (averageKeysThatShouldNotDecrease.includes(key)) {
          const minThreshold = 0.9 * average
          if (currentValue < minThreshold) {
            console.debug(`Drop in the value of key '${key}' for peer '${ev.peerId}': ${currentValue.toFixed(2)}.`)
          }
        }

        if (averageKeysThatShouldNotIncrease.includes(key)) {
          const minThreshold = 1.1 * average
          if (currentValue > minThreshold) {
            console.debug(`Increase in the value of key '${key}' for peer '${ev.peerId}': ${currentValue.toFixed(2)}.`)
          }
        }
      })

      // Log the average values recursively
      if (new Date().getTime() - lastWebrtcStatsAverageLog.getTime() > webrtcStatsAverageLogDelay) {
        averageKeys.forEach((key) => {
          const keyArray = webRtcStatsHistory.value[ev.peerId][key]
          if (keyArray.find((value) => typeof value !== 'number')) return
          const average = (keyArray as number[]).reduce((a, b) => a + b, 0) / keyArray.length
          console.debug(`Average value '${key}' for peer '${ev.peerId}': ${average.toFixed(4)}.`)
        })
        lastWebrtcStatsAverageLog = new Date()
      }
    } catch (error) {
      console.error('Error while logging WebRTC statistics:', error)
    }
  })

  return {
    streamsFrameRateHistory,
    appFrameRateHistory,
    webRtcStatsHistory,
  }
})
