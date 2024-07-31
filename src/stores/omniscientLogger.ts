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
})
