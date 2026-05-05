import { saveAs } from 'file-saver'
import { t } from 'ttag'
import { v4 as uuid } from 'uuid'

import { app_version } from '@/libs/cosmos'
import { sanitizeFilenameComponent } from '@/libs/utils'
import { audioStorage, tempAudioStorage } from '@/libs/videoStorage'
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

const chunkIntervalMs = 1000

/**
 * What is known of a recording when it starts, backed up so an interrupted one can be recovered with its metadata.
 */
type PendingAudioMetadata = Omit<AudioRecordingMetadata, 'dateFinish' | 'durationMs'>

const backupChunkKey = (fileName: string, index: number): string => `${fileName}_${index}`
const backupMetadataKey = (fileName: string): string => `${fileName}_meta`
const backupFileName = (key: string): string => key.slice(0, key.lastIndexOf('_'))
const backupChunkIndex = (key: string): number => Number(key.slice(key.lastIndexOf('_') + 1))
const backupLockName = (fileName: string): string => `cockpit-voice-recording-${fileName}`

// A lock rather than module state, so recovery in another tab or window also leaves a live recording's backup alone.
// Without the Web Locks API the context is not secure, so no recording can run on this origin to begin with.
const lockBackup = (fileName: string, settled: () => Promise<unknown>): Promise<void> => {
  if (!navigator.locks) return Promise.resolve()
  return new Promise((resolve) => {
    navigator.locks
      .request(backupLockName(fileName), () => {
        resolve()
        return settled().catch(() => undefined)
      })
      .catch((error) => {
        console.warn(`Could not lock the backup of the voice recording "${fileName}".`, error)
        resolve()
      })
  })
}

const toJsonBlob = (value: unknown): Blob => new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })

const saveRecording = async (fileName: string, chunks: Blob[], metadata?: AudioRecordingMetadata): Promise<void> => {
  const audioBlob = new Blob(chunks, { type: metadata?.mimeType ?? chunks[0]?.type })
  if (audioBlob.size === 0) throw new Error(t`The recording has no audio data.`)
  await audioStorage.setItem(fileName, audioBlob)
  if (metadata) await audioStorage.setItem(audioMetadataFilename(fileName), toJsonBlob(metadata))
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
  const pendingMetadata: PendingAudioMetadata = {
    dateStart,
    mimeType: mediaRecorder.mimeType || 'audio/webm',
    missionName: missionName || 'Cockpit',
    cockpitVersion: app_version.version,
  }
  // Kept in memory for the final save, and backed up as they arrive so a crash or a forced close loses at most the
  // last chunk. A failed backup write only costs that protection, so it does not stop the recording.
  const chunks: Blob[] = []
  const backupKeys: string[] = []
  let backupWrites = lockBackup(fileName, () => finished)
  const backUp = (key: string, blob: Blob): void => {
    backupKeys.push(key)
    backupWrites = backupWrites
      .then(() => tempAudioStorage.setItem(key, blob))
      .catch((error) => console.warn(`Could not back up "${key}" of the ongoing voice recording.`, error))
  }
  backUp(backupMetadataKey(fileName), toJsonBlob(pendingMetadata))

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    chunks.push(event.data)
    backUp(backupChunkKey(fileName, chunks.length - 1), event.data)
  }

  const finished = new Promise<void>((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      mediaStream.getTracks().forEach((track) => track.stop())
      const dateFinish = new Date()
      const metadata: AudioRecordingMetadata = {
        ...pendingMetadata,
        mimeType: mediaRecorder.mimeType || pendingMetadata.mimeType,
        dateFinish,
        durationMs: dateFinish.getTime() - dateStart.getTime(),
      }
      await backupWrites
      try {
        await saveRecording(fileName, chunks, metadata)
      } catch (error) {
        // The backup stays, so the next recovery can still save the recording.
        reject(error)
        return
      }
      await Promise.all(backupKeys.map((key) => tempAudioStorage.removeItem(key))).catch((error) =>
        console.warn(`Could not remove the backup of the voice recording "${fileName}".`, error)
      )
      resolve()
    }
  })

  mediaRecorder.start(chunkIntervalMs)

  const stop = (): void => {
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  }
  return { fileName, dateStart, stop, finished }
}

const readPendingMetadata = async (key: string): Promise<PendingAudioMetadata | undefined> => {
  try {
    const blob = await tempAudioStorage.getItem(key)
    if (!blob) return undefined
    const metadata = JSON.parse(await blob.text()) as PendingAudioMetadata
    return { ...metadata, dateStart: new Date(metadata.dateStart) }
  } catch (error) {
    console.warn(`Failed to read the backed-up metadata "${key}".`, error)
    return undefined
  }
}

// The recording may already be saved if only the backup removal failed, so its exact metadata is kept then.
const recoverBackup = async (fileName: string, keys: string[], savedFileNames: string[]): Promise<boolean> => {
  const metadataKey = backupMetadataKey(fileName)
  const chunkKeys = keys.filter((key) => key !== metadataKey).sort((a, b) => backupChunkIndex(a) - backupChunkIndex(b))
  const chunks = (await Promise.all(chunkKeys.map((key) => tempAudioStorage.getItem(key)))).filter(
    (chunk): chunk is Blob => !!chunk
  )
  // The sidecar is written last, so only it proves the audio was saved in full.
  const recoverable = chunks.length > 0 && !savedFileNames.includes(audioMetadataFilename(fileName))
  if (recoverable) {
    const pendingMetadata = await readPendingMetadata(metadataKey)
    // The last chunk can be partial or lost, so the duration is an estimate.
    const durationMs = chunks.length * chunkIntervalMs
    const metadata = pendingMetadata && {
      ...pendingMetadata,
      dateFinish: new Date(pendingMetadata.dateStart.getTime() + durationMs),
      durationMs,
    }
    await saveRecording(fileName, chunks, metadata)
  }
  await Promise.all(keys.map((key) => tempAudioStorage.removeItem(key)))
  return recoverable
}

let recoveryInProgress: Promise<number> | undefined

const recoverBackups = async (): Promise<number> => {
  const backups = new Map<string, string[]>()
  for (const key of await tempAudioStorage.keys()) {
    const fileName = backupFileName(key)
    backups.set(fileName, [...(backups.get(fileName) ?? []), key])
  }
  // Queried after listing the keys, since a recording holds its lock before writing any of them.
  const heldLockNames = new Set(((await navigator.locks?.query())?.held ?? []).map((lock) => lock.name))
  for (const fileName of backups.keys()) {
    if (heldLockNames.has(backupLockName(fileName))) backups.delete(fileName)
  }
  if (backups.size === 0) return 0
  const savedFileNames = await audioStorage.keys()
  let recovered = 0
  for (const [fileName, keys] of backups) {
    try {
      if (await recoverBackup(fileName, keys, savedFileNames)) recovered++
    } catch (error) {
      console.warn(`Could not recover the interrupted voice recording "${fileName}".`, error)
    }
  }
  return recovered
}

/**
 * Saves the recordings that were interrupted, by a crash or by Cockpit closing, from their backed-up chunks.
 * @returns {Promise<number>} How many recordings this call recovered. A call made while another one is recovering
 * waits for it and returns 0, so only one caller reports the outcome.
 */
export const recoverInterruptedAudioRecordings = async (): Promise<number> => {
  if (recoveryInProgress) {
    await recoveryInProgress
    return 0
  }
  recoveryInProgress = recoverBackups()
  try {
    return await recoveryInProgress
  } finally {
    recoveryInProgress = undefined
  }
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
