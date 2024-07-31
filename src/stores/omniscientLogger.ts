import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useVideoStore } from './video'

export const useOmniscientLoggerStore = defineStore('omniscient-logger', () => {
  const videoStore = useVideoStore()

  // Routine to log the framerate of the video streams
  const streamsFrameRateHistory = ref<{ [key in string]: number[] }>({})
  let lastStreamAverageFramerateLog = new Date()
  const streamAverageFramerateLogDelay = 1000
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
  const appAverageFrameRateLogDelay = 1000
  let lastAppAverageFpsLog = new Date()
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
        const minThreshold = 0.9 * average

        // Warn about drops in the framerate of the application rendering
        if (currentFPS < minThreshold) {
          console.warn(`Drop in the framerate detected for the application rendering: ${currentFPS.toFixed(2)} fps.`)
        }

        // Log the average framerate of the application rendering recursively
        if (new Date().getTime() - lastAppAverageFpsLog.getTime() > appAverageFrameRateLogDelay) {
          console.debug(`Average framerate for the application rendering: ${currentFPS.toFixed(2)} fps.`)
          lastAppAverageFpsLog = new Date()
        }
      }

      requestAnimationFrame(loop)
    })
  }
  fpsMeter()
})
