import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { app_version } from '@/libs/cosmos'
import { isElectron, sanitizeFilenameComponent } from '@/libs/utils'
import { audioStorage } from '@/libs/videoStorage'
import { Alert, AlertLevel } from '@/types/alert'
import { AudioExtensionContainer, AudioLibraryFile, AudioRecordingMetadata, CommonAudioInfo } from '@/types/audio'
import { audioFilename, audioMetadataFilename, isAudioMetadataFilename } from '@/utils/audio'

import { useAlertStore } from './alert'
import { useMissionStore } from './mission'

/**
 * Internal state of an active recording.
 */
interface ActiveAudioRecording extends CommonAudioInfo {
  /**
   * The full audio MediaStream backing the recording.
   */
  mediaStream: MediaStream
  /**
   * The MediaRecorder collecting audio chunks for the recording.
   */
  mediaRecorder: MediaRecorder
  /**
   * Audio chunks accumulated by the MediaRecorder while the recording is ongoing.
   */
  chunks: Blob[]
  /**
   * MIME type that the MediaRecorder is producing for this recording.
   */
  mimeType: string
  /**
   * Promise that resolves once the recording has been fully persisted to storage.
   */
  finalization: Promise<void>
  /**
   * Resolver for the finalization promise.
   */
  resolveFinalization: () => void
  /**
   * Rejector for the finalization promise.
   */
  rejectFinalization: (error: Error) => void
}

/**
 * MIME type candidates tried in order when configuring the MediaRecorder.
 * The first supported by the runtime is used to encode the recording.
 */
const PREFERRED_AUDIO_MIME_TYPES: {
  /**
cccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccc
   */
  mimeType: string
  /**
mmmmmmmmmmmmmmmmmm *
mmmmmmmmmmmmmmmmmm
   */
  extension: AudioExtensionContainer
}[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: AudioExtensionContainer.WEBM },
  { mimeType: 'audio/webm', extension: AudioExtensionContainer.WEBM },
  { mimeType: 'audio/ogg;codecs=opus', extension: AudioExtensionContainer.OGG },
  { mimeType: 'audio/mp4', extension: AudioExtensionContainer.MP4 },
]

const pickSupportedAudioMime = (): {
  /**
ccccccccccccccccccccccccccccccccccccc *
ccccccccccccccccccccccccccccccccccccc
   */
  mimeType: string
  /**
mmmmmmmmmmmmmmmmmm *
mmmmmmmmmmmmmmmmmm
   */
  extension: AudioExtensionContainer
} => {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not available in this environment.')
  }
  for (const candidate of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate
  }
  // Fall back to letting the runtime decide. Extension defaults to webm because that is what
  // Chromium-based browsers use when no MIME type is forced.
  return { mimeType: '', extension: AudioExtensionContainer.WEBM }
}

export const useAudioStore = defineStore('audio', () => {
  const missionStore = useMissionStore()
  const alertStore = useAlertStore()
  const { showDialog } = useInteractionDialog()

  const activeRecording = ref<ActiveAudioRecording | undefined>()

  const isRecording = computed(() => activeRecording.value !== undefined)

  const buildMetadata = (recording: ActiveAudioRecording): AudioRecordingMetadata => {
    const dateStart = recording.dateStart ?? new Date()
    const dateFinish = recording.dateFinish ?? new Date()
    return {
      fileName: recording.fileName,
      hash: recording.hash,
      dateStart,
      dateFinish,
      durationMs: Math.max(0, dateFinish.getTime() - dateStart.getTime()),
      mimeType: recording.mimeType,
      missionName: missionStore.missionName || 'Cockpit',
      cockpitVersion: app_version.version,
    }
  }

  const persistRecording = async (recording: ActiveAudioRecording): Promise<void> => {
    const metadata = buildMetadata(recording)

    const audioBlob = new Blob(recording.chunks, { type: recording.mimeType || 'audio/webm' })
    if (audioBlob.size === 0) {
      throw new Error('Recording produced no audio data.')
    }

    await audioStorage.setItem(recording.fileName, audioBlob)

    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
    await audioStorage.setItem(audioMetadataFilename(recording.fileName), metadataBlob)
  }

  const requestMicrophoneStream = async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this environment (insecure context?).')
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  }

  /**
   * Start a new audio recording from the local microphone.
   * @returns {Promise<void>} Promise that resolves when the recording has effectively started.
   */
  const startRecording = async (): Promise<void> => {
    if (activeRecording.value !== undefined) {
      showDialog({ message: 'A voice recording is already ongoing.', variant: 'warning' })
      return
    }

    let mediaStream: MediaStream
    try {
      mediaStream = await requestMicrophoneStream()
    } catch (error) {
      const errorMsg = `Could not access the microphone: ${(error as Error).message ?? error!.toString()}`
      console.error(errorMsg)
      showDialog({ title: 'Cannot start voice recording.', message: errorMsg, variant: 'error' })
      return
    }

    const { mimeType, extension } = pickSupportedAudioMime()

    let mediaRecorder: MediaRecorder
    try {
      mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream)
    } catch (error) {
      mediaStream.getTracks().forEach((track) => track.stop())
      const errorMsg = `Failed to start the audio recorder: ${(error as Error).message ?? error!.toString()}`
      console.error(errorMsg)
      showDialog({ title: 'Cannot start voice recording.', message: errorMsg, variant: 'error' })
      return
    }

    const dateStart = new Date()
    const recordingHash = uuid().slice(0, 8)
    const safeMissionName = sanitizeFilenameComponent(missionStore.missionName) || 'Cockpit'
    const fileName = audioFilename(recordingHash, dateStart, safeMissionName, extension)

    let resolveFinalization: () => void = () => undefined
    let rejectFinalization: (error: Error) => void = () => undefined
    const finalization = new Promise<void>((resolve, reject) => {
      resolveFinalization = resolve
      rejectFinalization = reject
    })

    const recording: ActiveAudioRecording = {
      hash: recordingHash,
      fileName,
      dateStart,
      mediaStream,
      mediaRecorder,
      chunks: [],
      mimeType: mediaRecorder.mimeType || mimeType || 'audio/webm',
      finalization,
      resolveFinalization,
      rejectFinalization,
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recording.chunks.push(event.data)
      }
    }

    mediaRecorder.onerror = (event) => {
      const errorMsg = `Audio recorder error: ${
        (
          event as unknown as {
            /**
             *
             */
            error?: Error
          }
        ).error?.message ?? 'unknown'
      }`
      console.error(errorMsg)
      alertStore.pushAlert(new Alert(AlertLevel.Error, errorMsg))
    }

    mediaRecorder.onstop = async () => {
      recording.dateFinish = new Date()
      mediaStream.getTracks().forEach((track) => track.stop())
      try {
        await persistRecording(recording)
        alertStore.pushAlert(new Alert(AlertLevel.Success, `Saved voice recording '${recording.fileName}'.`))
        resolveFinalization()
      } catch (error) {
        const errorMsg = `Failed to save voice recording: ${(error as Error).message ?? error!.toString()}`
        console.error(errorMsg)
        showDialog({ title: 'Voice recording failed to save.', message: errorMsg, variant: 'error' })
        rejectFinalization(error as Error)
      } finally {
        if (activeRecording.value?.hash === recording.hash) {
          activeRecording.value = undefined
        }
      }
    }

    // 1s timeslice keeps memory pressure bounded for long recordings without forcing chunked storage.
    mediaRecorder.start(1000)
    activeRecording.value = recording

    alertStore.pushAlert(new Alert(AlertLevel.Success, 'Started voice recording.'))
  }

  /**
   * Stop the ongoing audio recording, if any, and persist it to storage.
   * @returns {Promise<void>} Promise that resolves once the recording has been written to storage.
   */
  const stopRecording = async (): Promise<void> => {
    const recording = activeRecording.value
    if (recording === undefined) return

    if (recording.mediaRecorder.state !== 'inactive') {
      recording.mediaRecorder.stop()
    }

    try {
      await recording.finalization
    } catch {
      // Errors are already surfaced through the dialog/alert in onstop.
    }
  }

  /**
   * Discard the given audio files (and any matching metadata sidecars) from the audio storage.
   * @param {string[]} fileNames - Names of the audio files to delete.
   * @returns {Promise<void>} Promise that resolves once the deletions are complete.
   */
  const deleteAudioFiles = async (fileNames: string[]): Promise<void> => {
    for (const fileName of fileNames) {
      await audioStorage.removeItem(fileName)
      const metadataName = audioMetadataFilename(fileName)
      if (metadataName !== fileName) {
        await audioStorage.removeItem(metadataName)
      }
    }
  }

  /**
   * Download the given audio files (and any matching metadata sidecars) directly to the user's machine.
   * On Electron the files already live on disk, so this is mainly useful in the browser version.
   * @param {string[]} fileNames - Names of the audio files to download.
   * @returns {Promise<void>} Promise that resolves once all download triggers have been issued.
   */
  const downloadAudioFiles = async (fileNames: string[]): Promise<void> => {
    for (const fileName of fileNames) {
      const blob = await audioStorage.getItem(fileName)
      if (blob) saveAs(blob, fileName)
      const metadataName = audioMetadataFilename(fileName)
      if (metadataName === fileName) continue
      const metadataBlob = await audioStorage.getItem(metadataName)
      if (metadataBlob) saveAs(metadataBlob, metadataName)
    }
  }

  /**
   * Read the metadata sidecar for the given audio file, if it exists.
   * @param {string} fileName - The audio filename.
   * @returns {Promise<AudioRecordingMetadata | undefined>} Parsed metadata, or undefined if absent/invalid.
   */
  const getAudioMetadata = async (fileName: string): Promise<AudioRecordingMetadata | undefined> => {
    try {
      const blob = await audioStorage.getItem(audioMetadataFilename(fileName))
      if (!blob) return undefined
      const text = await blob.text()
      const parsed = JSON.parse(text) as AudioRecordingMetadata
      if (parsed.dateStart) parsed.dateStart = new Date(parsed.dateStart)
      if (parsed.dateFinish) parsed.dateFinish = new Date(parsed.dateFinish)
      return parsed
    } catch (error) {
      console.warn(`Failed to read audio metadata for "${fileName}":`, error)
      return undefined
    }
  }

  /**
   * List the audio recordings currently persisted in the audio storage, including metadata when available.
   * @returns {Promise<AudioLibraryFile[]>} Library entries sorted from most to least recent.
   */
  const listAudioRecordings = async (): Promise<AudioLibraryFile[]> => {
    const keys = await audioStorage.keys()
    const audioKeys = keys.filter((key) => !isAudioMetadataFilename(key))

    const entries = await Promise.all(
      audioKeys.map(async (fileName): Promise<AudioLibraryFile> => {
        const metadata = await getAudioMetadata(fileName)
        const hashMatch = fileName.match(/#([a-z0-9]+)\./)
        return {
          fileName,
          hash: metadata?.hash ?? hashMatch?.[1] ?? '',
          dateStart: metadata?.dateStart,
          dateFinish: metadata?.dateFinish,
          durationMs: metadata?.durationMs,
          mimeType: metadata?.mimeType,
        }
      })
    )

    return entries.sort((a, b) => b.fileName.localeCompare(a.fileName))
  }

  /**
   * Whether audio recording is supported in the current runtime.
   * @returns {boolean} True if microphone capture and MediaRecorder are available.
   */
  const isAudioRecordingSupported = (): boolean => {
    if (typeof MediaRecorder === 'undefined') return false
    if (typeof navigator === 'undefined') return false
    return Boolean(navigator.mediaDevices?.getUserMedia)
  }

  return {
    audioStorage,
    activeRecording,
    isRecording,
    isAudioRecordingSupported,
    startRecording,
    stopRecording,
    listAudioRecordings,
    getAudioMetadata,
    deleteAudioFiles,
    downloadAudioFiles,
    isElectron,
  }
})
