import { useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import fixWebmDuration from 'fix-webm-duration'
import localforage from 'localforage'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { computed, ref, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { WebRTCManager } from '@/composables/webRTC'
import { datalogger } from '@/libs/sensors-logging'
import { isEqual } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { StreamData } from '@/types/video'

export const useVideoStore = defineStore('video', () => {
  const { missionName } = useMissionStore()
  const { rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const allowedIceIps = useStorage<string[]>('cockpit-allowed-stream-ips', [])
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
  const { availableStreams } = mainWebRTCManager.startStream(ref(undefined), allowedIceIps)
  const availableIceIps = ref<string[]>([])

  const namesAvailableStreams = computed(() => availableStreams.value.map((stream) => stream.name))

  // If the allowed ICE IPs are updated, all the streams should be reconnected
  watch(allowedIceIps, () => {
    Object.keys(activeStreams.value).forEach((streamName) => (activeStreams.value[streamName] = undefined))
  })

  // Streams update routine. Responsible for starting and updating the streams.
  setInterval(() => {
    Object.keys(activeStreams.value).forEach((streamName) => {
      if (activeStreams.value[streamName] === undefined) return
      // Update the list of available remote ICE Ips with those available for each stream
      // @ts-ignore: availableICEIPs is not reactive here, for some yet to know reason
      const newIps = activeStreams.value[streamName].webRtcManager.availableICEIPs.filter(
        (ip: string) => !availableIceIps.value.includes(ip)
      )
      availableIceIps.value = [...availableIceIps.value, ...newIps]

      const updatedStream = availableStreams.value.find((s) => s.name === streamName)
      if (isEqual(updatedStream, activeStreams.value[streamName]!.stream)) return

      // Whenever the stream is to be updated we first reset it's variables (activateStream method), so
      // consumers can be updated as well.
      console.log(`New stream for '${streamName}':`)
      console.log(JSON.stringify(updatedStream, null, 2))
      activateStream(streamName)
      activeStreams.value[streamName]!.stream = updatedStream
    })
  }, 300)

  /**
   * Activates a stream by starting it and storing it's variables inside a common object.
   * This way multiple consumers will always access the same resource, so we don't consume unnecessary
   * bandwith or stress the stream provider more than we need to.
   * @param {string} streamName - Unique name for the stream, common between the multiple consumers
   */
  const activateStream = (streamName: string): void => {
    const stream = ref()
    const webRtcManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
    const { mediaStream } = webRtcManager.startStream(stream, allowedIceIps)
    activeStreams.value[streamName] = {
      // @ts-ignore: This is actually not reactive
      stream: stream,
      webRtcManager: webRtcManager,
      // @ts-ignore: This is actually not reactive
      mediaStream: mediaStream,
      mediaRecorder: undefined,
      timeRecordingStart: undefined,
    }
  }

  /**
   * Get all data related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {StreamData | undefined} The StreamData object, if available
   */
  const getStreamData = (streamName: string): StreamData | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]
  }

  /**
   * Get the MediaStream object related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {MediaStream | undefined} MediaStream that is running, if available
   */
  const getMediaStream = (streamName: string): MediaStream | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]!.mediaStream
  }

  /**
   * Wether or not the stream is currently being recorded
   * @param {string} streamName - Name of the stream
   * @returns {boolean}
   */
  const isRecording = (streamName: string): boolean => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    return (
      activeStreams.value[streamName]!.mediaRecorder !== undefined &&
      activeStreams.value[streamName]!.mediaRecorder!.state === 'recording'
    )
  }

  /**
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    activeStreams.value[streamName]!.mediaRecorder!.stop()
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = (streamName: string): void => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    if (namesAvailableStreams.value.isEmpty()) {
      Swal.fire({ text: 'No streams available.', icon: 'error' })
      return
    }

    if (activeStreams.value[streamName]!.mediaStream === undefined) {
      Swal.fire({ text: 'Media stream not defined.', icon: 'error' })
      return
    }
    if (!activeStreams.value[streamName]!.mediaStream!.active) {
      Swal.fire({ text: 'Media stream not yet active. Wait a second and try again.', icon: 'error' })
      return
    }

    activeStreams.value[streamName]!.timeRecordingStart = new Date()
    const streamData = activeStreams.value[streamName] as StreamData
    const fileName = `${missionName || 'Cockpit'} (${format(
      streamData.timeRecordingStart!,
      'LLL dd, yyyy - HH꞉mm꞉ss O'
    )})`
    activeStreams.value[streamName]!.mediaRecorder = new MediaRecorder(streamData.mediaStream!)
    if (!datalogger.logging()) {
      datalogger.startLogging()
    }
    const videoTrack = streamData.mediaStream!.getVideoTracks()[0]
    const vWidth = videoTrack.getSettings().width || 1920
    const vHeight = videoTrack.getSettings().height || 1080
    activeStreams.value[streamName]!.mediaRecorder!.start(1000)
    let chunks: Blob[] = []
    activeStreams.value[streamName]!.mediaRecorder!.ondataavailable = async (e) => {
      chunks.push(e.data)
      await videoRecoveryDB.setItem(fileName, chunks)
    }

    activeStreams.value[streamName]!.mediaRecorder!.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const videoTelemetryLog = datalogger.getSlice(
        datalogger.currentCockpitLog,
        streamData.timeRecordingStart!,
        new Date()
      )
      const assLog = datalogger.toAssOverlay(
        videoTelemetryLog,
        vWidth,
        vHeight,
        streamData.timeRecordingStart!.getTime()
      )
      const logBlob = new Blob([assLog], { type: 'text/plain' })
      fixWebmDuration(blob, Date.now() - streamData.timeRecordingStart!.getTime()).then((fixedBlob) => {
        saveAs(fixedBlob, `${fileName}.webm`)
        saveAs(logBlob, `${fileName}.ass`)
        videoRecoveryDB.removeItem(fileName)
      })
      chunks = []
      activeStreams.value[streamName]!.mediaRecorder = undefined
    }
  }

  // Offer download of backuped videos
  const videoRecoveryDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Video Recovery',
    storeName: 'cockpit-video-recovery-db',
    version: 1.0,
    description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
  })

  videoRecoveryDB.length().then((len) => {
    if (len === 0) return

    Swal.fire({
      title: 'Video recording recovery',
      text: `Cockpit has pending backups for videos that you started recording but did not download.
        Click 'Discard' to remove the backuped files.
        Click 'Dismiss' to postpone this decision for the next boot.
        Click 'Download' to download the files. If you decide to download them, they will be removed afterwards.
      `,
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Download',
      denyButtonText: 'Discard',
      cancelButtonText: 'Dismiss',
    }).then((decision) => {
      if (decision.isDismissed) return
      if (decision.isDenied) {
        videoRecoveryDB.iterate((_, videoName) => videoRecoveryDB.removeItem(videoName))
      } else if (decision.isConfirmed) {
        videoRecoveryDB.iterate((videoFile, videoName) => {
          const blob = (videoFile as Blob[]).reduce((a, b) => new Blob([a, b], { type: 'video/webm' }))
          saveAs(blob, videoName)
        })
        videoRecoveryDB.iterate((_, videoName) => videoRecoveryDB.removeItem(videoName))
      }
    })
  })

  // Routine to make sure the user has chosen the allowed ICE candidate IPs, so the stream works as expected
  const iceIpCheckInterval = setInterval(() => {
    // Pass if there are no available IPs yet or if the user has already set the allowed ones
    if (availableIceIps.value === undefined || !allowedIceIps.value.isEmpty()) {
      return
    }
    // If there's more than one IP candidate available, send a warning an clear the check routine
    if (availableIceIps.value.length >= 1) {
      Swal.fire({
        html: `
          <p>Cockpit detected more than one IP address being used to route the video streaming. This often
          leads to video stuttering, especially if one of the IPs is from a non-wired connection.</p>
          </br>
          <p>To prevent issues and achieve an optimal streaming experience, please:</p>
          <ol>
            <li>1. Open the video configuration page (Main-menu > Configuration > Video).</li>
            <li>2. Select the IP address that should be used for the video streaming.</li>
          </ol>
        `,
        icon: 'warning',
        customClass: {
          htmlContainer: 'text-left',
        },
      })
      clearInterval(iceIpCheckInterval)
    }
  }, 5000)

  return {
    availableIceIps,
    allowedIceIps,
    namesAvailableStreams,
    videoRecoveryDB,
    getMediaStream,
    getStreamData,
    isRecording,
    stopRecording,
    startRecording,
  }
})
