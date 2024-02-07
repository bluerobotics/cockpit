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
import { getIpsInformationFromVehicle } from '@/libs/blueos'
import { datalogger } from '@/libs/sensors-logging'
import { isEqual } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { StreamData } from '@/types/video'

export const useVideoStore = defineStore('video', () => {
  const { missionName } = useMissionStore()
  const { globalAddress, rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const allowedIceIps = useStorage<string[]>('cockpit-allowed-stream-ips', [])
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
  const { availableStreams } = mainWebRTCManager.startStream(ref(undefined), allowedIceIps)
  const availableIceIps = ref<string[]>([])
  const videoRecoveryWarningAlreadyShown = useStorage('video-recovery-warning-already-shown', false)

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
    let chunksCount = 0
    activeStreams.value[streamName]!.mediaRecorder!.ondataavailable = async (e) => {
      await tempVideoChunksDB.setItem(`${fileName}_${chunksCount}`, e.data)
      chunksCount++
    }

    activeStreams.value[streamName]!.mediaRecorder!.onstop = async () => {
      // eslint-disable-next-line jsdoc/require-jsdoc
      const chunks: { blob: Blob; name: string }[] = []

      await tempVideoChunksDB.iterate((videoChunk, chunkName) => {
        if (chunkName.includes(fileName)) {
          chunks.push({ blob: videoChunk as Blob, name: chunkName })
        }
      })

      if (chunks.length === 0) {
        Swal.fire({ text: 'No video recording data found.', icon: 'error' })
        return
      }

      // Make sure the chunks are sorted in the order they were created, not the order they are stored
      const sortedChunks = chunks
        .sort((a, b) => {
          const splitA = a.name.split('_')
          const splitB = b.name.split('_')
          return Number(splitA[splitA.length - 1]) - Number(splitB[splitB.length - 1])
        })
        .map((chunk) => chunk.blob)
      const mergedVideoBlob = (sortedChunks as Blob[]).reduce((a, b) => new Blob([a, b], { type: 'video/webm' }))
      const durFixedBlob = await fixWebmDuration(mergedVideoBlob, Date.now() - streamData.timeRecordingStart!.getTime())
      videoStoringDB.setItem(`${fileName}.webm`, durFixedBlob)

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
      videoStoringDB.setItem(`${fileName}.ass`, logBlob)

      activeStreams.value[streamName]!.mediaRecorder = undefined
    }
  }

  // Used to discard a file from the video recovery database
  const discardFileFromVideoDB = async (fileName: string): Promise<void> => {
    await videoStoringDB.removeItem(fileName)
  }

  // Used to download a file from the video recovery database
  const downloadFileFromVideoDB = async (fileName: string): Promise<void> => {
    const file = await videoStoringDB.getItem(fileName)
    if (!file) {
      Swal.fire({ text: 'File not found.', icon: 'error' })
      return
    }
    saveAs(file as Blob, fileName)
  }

  // Used to clear the temporary video database
  const clearTemporaryVideoDB = async (): Promise<void> => {
    await tempVideoChunksDB.iterate((_, chunkName) => {
      tempVideoChunksDB.removeItem(chunkName)
    })
  }

  // Used to store chunks of an ongoing recording, that will be merged into a video file when the recording is stopped
  const tempVideoChunksDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Temporary Video',
    storeName: 'cockpit-temp-video-db',
    version: 1.0,
    description: 'Database for storing the chunks of an ongoing recording, to be merged afterwards.',
  })

  // Offer download of backuped videos
  const videoStoringDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Video Recovery',
    storeName: 'cockpit-video-recovery-db',
    version: 1.0,
    description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
  })

  videoStoringDB.length().then((len) => {
    if (len === 0) return
    if (videoRecoveryWarningAlreadyShown.value) return

    Swal.fire({
      title: 'Download of video recordings',
      text: `Cockpit has video recordings waiting on the disk storage.
        To download or discard those, please go to the video page, in the configuration menu.
        Remember that those recordings are only available on the device you used to record the videos, and that
        they take disk space. If you don't need them anymore, you can discard them.
      `,
      icon: 'warning',
    })

    videoRecoveryWarningAlreadyShown.value = true
  })

  // Routine to make sure the user has chosen the allowed ICE candidate IPs, so the stream works as expected
  let warningTimeout: NodeJS.Timeout | undefined = undefined
  const iceIpCheckInterval = setInterval(async (): Promise<void> => {
    // Pass if there are no available IPs yet
    if (availableIceIps.value === undefined) return

    // Cancel the check if the user has already set the allowed ICE IPs
    if (!allowedIceIps.value.isEmpty()) {
      clearInterval(iceIpCheckInterval)
      clearTimeout(warningTimeout)
      return
    }

    // If there's more than one IP candidate available, try getting information about them from BlueOS. If not
    // available, send a warning an clear the check routine.
    if (availableIceIps.value.length >= 1) {
      try {
        const ipsInfo = await getIpsInformationFromVehicle(globalAddress)
        ipsInfo.forEach((ipInfo) => {
          const isIceIp = availableIceIps.value.includes(ipInfo.ipv4Address)
          const alreadyAllowedIp = allowedIceIps.value.includes(ipInfo.ipv4Address)
          if (ipInfo.interfaceType !== 'WIRED' || alreadyAllowedIp || !isIceIp) return
          console.info(`Adding the wired address '${ipInfo.ipv4Address}' to the list of allowed ICE IPs.`)
          allowedIceIps.value.push(ipInfo.ipv4Address)
        })
        if (!allowedIceIps.value.isEmpty()) {
          clearInterval(iceIpCheckInterval)
          clearTimeout(warningTimeout)
          return
        }
      } catch (error) {
        console.log(error)
      }

      if (warningTimeout) return
      warningTimeout = setTimeout(() => {
        console.info('No ICE IPs selected for the allowed list. Warning user.')
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
        return
      }, 5000)
    }
  }, 5000)

  return {
    availableIceIps,
    allowedIceIps,
    namesAvailableStreams,
    videoStoringDB,
    tempVideoChunksDB,
    discardFileFromVideoDB,
    downloadFileFromVideoDB,
    clearTemporaryVideoDB,
    getMediaStream,
    getStreamData,
    isRecording,
    stopRecording,
    startRecording,
  }
})
