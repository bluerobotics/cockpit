import { saveAs } from 'file-saver'
import { t } from 'ttag'
import { v4 as uuid } from 'uuid'

import { app_version } from '@/libs/cosmos'
import { sanitizeFilenameComponent } from '@/libs/utils'
import { audioStorage } from '@/libs/videoStorage'
import { createZipBlob, ZipFileEntry } from '@/libs/zip'
import { AudioExtensionContainer, AudioLibraryFile, AudioRecordingMetadata } from '@/types/audio'
import { audioMetadataFilename, isAudioMetadataFilename } from '@/utils/audio'
import { videoFilename } from '@/utils/video'

/**
 * A microphone recording in progress.
 */
export interface AudioRecordingHandle {
  /**
   * Name the recording will be saved under
   */
  fileName: string
  /**
   * When the recording started
   */
  dateStart: Date
  /**
   * Stops the recording. The outcome arrives through `finished`.
   */
  stop: () => void
  /**
   * Resolves once the recording is on storage, or rejects if saving failed. Also settles when the recorder
   * stops on its own, e.g. when the microphone is unplugged.
   */
  finished: Promise<void>
}

// Tried in order; the first one the runtime supports is used.
const preferredAudioFormats: [string, AudioExtensionContainer][] = [
  ['audio/webm;codecs=opus', AudioExtensionContainer.WEBM],
  ['audio/webm', AudioExtensionContainer.WEBM],
  ['audio/ogg;codecs=opus', AudioExtensionContainer.OGG],
  ['audio/mp4', AudioExtensionContainer.MP4],
]

/**
 * Whether the runtime can capture the microphone. Browsers only expose it on HTTPS or localhost.
 * @returns {boolean} True if microphone capture and MediaRecorder are available.
 */
export const isAudioRecordingSupported = (): boolean => {
  return typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined
}

const saveRecording = async (fileName: string, chunks: Blob[], metadata: AudioRecordingMetadata): Promise<void> => {
  const audioBlob = new Blob(chunks, { type: metadata.mimeType })
  if (audioBlob.size === 0) throw new Error(t`The recording has no audio data.`)
  await audioStorage.setItem(fileName, audioBlob)
  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  await audioStorage.setItem(audioMetadataFilename(fileName), metadataBlob)
}

/**
 * Starts recording the local microphone. The recording is saved to the audio storage when it stops.
 * @param {string} missionName - Mission name used in the filename and metadata.
 * @returns {Promise<AudioRecordingHandle>} Handle to stop the recording and await its outcome.
 */
export const startAudioRecording = async (missionName: string): Promise<AudioRecordingHandle> => {
  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  const [mimeType, extension] = preferredAudioFormats.find(([type]) => MediaRecorder.isTypeSupported(type)) ?? [
    '',
    AudioExtensionContainer.WEBM,
  ]

  let mediaRecorder: MediaRecorder
  try {
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined)
  } catch (error) {
    mediaStream.getTracks().forEach((track) => track.stop())
    throw error
  }

  const dateStart = new Date()
  const hash = uuid().slice(0, 8)
  const safeMissionName = sanitizeFilenameComponent(missionName) || 'Cockpit'
  const fileName = videoFilename(hash, dateStart, safeMissionName, extension)
  // ponytail: the whole recording stays in memory until stop, so a crash loses it. Persist the chunks as they
  // arrive, the way video uses tempVideoStorage, if long notes need to survive that.
  const chunks: Blob[] = []

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const finished = new Promise<void>((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      mediaStream.getTracks().forEach((track) => track.stop())
      const dateFinish = new Date()
      const metadata: AudioRecordingMetadata = {
        dateStart,
        dateFinish,
        durationMs: dateFinish.getTime() - dateStart.getTime(),
        mimeType: mediaRecorder.mimeType || 'audio/webm',
        missionName: missionName || 'Cockpit',
        cockpitVersion: app_version.version,
      }
      try {
        await saveRecording(fileName, chunks, metadata)
        resolve()
      } catch (error) {
        reject(error)
      }
    }
  })

  mediaRecorder.start(1000)

  const stop = (): void => {
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  }
  return { fileName, dateStart, stop, finished }
}

/**
 * Counts the audio recordings on storage without reading them.
 * @returns {Promise<number>} The number of recordings.
 */
export const countAudioRecordings = async (): Promise<number> => {
  return (await audioStorage.keys()).filter((key) => !isAudioMetadataFilename(key)).length
}

const readAudioMetadata = async (fileName: string): Promise<AudioRecordingMetadata | undefined> => {
  try {
    const blob = await audioStorage.getItem(audioMetadataFilename(fileName))
    if (!blob) return undefined
    const metadata = JSON.parse(await blob.text()) as AudioRecordingMetadata
    return { ...metadata, dateStart: new Date(metadata.dateStart), dateFinish: new Date(metadata.dateFinish) }
  } catch (error) {
    console.warn(`Failed to read the metadata of the audio recording "${fileName}".`, error)
    return undefined
  }
}

/**
 * Lists the audio recordings on storage, with their metadata when available.
 * @returns {Promise<AudioLibraryFile[]>} Recordings sorted from most to least recent.
 */
export const listAudioRecordings = async (): Promise<AudioLibraryFile[]> => {
  const fileNames = (await audioStorage.keys()).filter((key) => !isAudioMetadataFilename(key))
  const recordings = await Promise.all(
    fileNames.map(async (fileName): Promise<AudioLibraryFile> => {
      const metadata = await readAudioMetadata(fileName)
      return { fileName, dateStart: metadata?.dateStart, durationMs: metadata?.durationMs }
    })
  )
  return recordings.sort((a, b) => (b.dateStart?.getTime() ?? 0) - (a.dateStart?.getTime() ?? 0))
}

/**
 * Deletes audio recordings and their metadata from storage.
 * @param {string[]} fileNames - Names of the recordings to delete.
 * @returns {Promise<void>} Resolves once every file is deleted.
 */
export const deleteAudioRecordings = async (fileNames: string[]): Promise<void> => {
  for (const fileName of fileNames) {
    await audioStorage.removeItem(fileName)
    await audioStorage.removeItem(audioMetadataFilename(fileName))
  }
}

/**
 * Downloads audio recordings and their metadata to the user's machine, zipped into a single download when
 * there is more than one file, so the browser does not prompt for each of them.
 * @param {string[]} fileNames - Names of the recordings to download.
 * @returns {Promise<number>} How many files were found and downloaded.
 */
export const downloadAudioRecordings = async (fileNames: string[]): Promise<number> => {
  const entries: ZipFileEntry[] = []
  for (const name of [...fileNames, ...fileNames.map(audioMetadataFilename)]) {
    const blob = await audioStorage.getItem(name)
    if (blob) entries.push({ name, blob })
  }
  if (entries.length === 1) saveAs(entries[0].blob, entries[0].name)
  if (entries.length > 1) saveAs(await createZipBlob(entries), 'Cockpit-Voice-Recordings.zip')
  return entries.length
}
