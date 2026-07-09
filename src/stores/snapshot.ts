import { useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import saveAs from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { buildExif, createThumbnail, maybeEmbedExif, snapshotFilename } from '@/libs/snapshot'
import { isElectron } from '@/libs/utils'
import { snapshotStorage, snapshotThumbStorage } from '@/libs/videoStorage'
import { useMissionStore } from '@/stores/mission'
import { StorageDB } from '@/types/general'
import { SnapshotFileDescriptor, SnapshotResult } from '@/types/snapshot'
import { DownloadProgressCallback, FileDescriptor } from '@/types/video'

import { useMainVehicleStore } from './mainVehicle'
import { useVideoStore } from './video'

export const useSnapshotStore = defineStore('snapshot', () => {
  const videoStore = useVideoStore()
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()
  const { showDialog } = useInteractionDialog()

  const zipMultipleFiles = useBlueOsStorage('cockpit-zip-multiple-video-files', false)

  const captureStreamFrame = async (streamName: string): Promise<Blob> => {
    if (!streamName) {
      return Promise.reject(new Error('Stream name is required to capture a snapshot.'))
    }
    const mediaStream = videoStore.getMediaStream(streamName)
    if (!mediaStream) return Promise.reject(new Error(`Media stream not found for stream name: ${streamName}`))

    const track = mediaStream.getVideoTracks()[0]
    if (!track) return Promise.reject(new Error(`No video track found for stream '${streamName}'`))
    if (track.readyState === 'ended') {
      return Promise.reject(new Error(`Video track for stream '${streamName}' has ended`))
    }
    if (track.muted) {
      return Promise.reject(new Error(`Video track for stream '${streamName}' is muted (no data flowing)`))
    }

    const video = document.createElement('video')
    video.srcObject = mediaStream
    video.playsInline = true
    video.muted = true
    video.style.display = 'none'
    document.body.appendChild(video)

    let playTimeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        video.play(),
        new Promise<never>((_, reject) => {
          playTimeout = setTimeout(
            () => reject(new Error(`Timed out starting playback for stream '${streamName}'`)),
            5000
          )
        }),
      ])
      const { width = video.videoWidth, height = video.videoHeight } = track.getSettings()
      video.width = width
      video.height = height

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get 2D context')
      ctx.drawImage(video, 0, 0, width, height)

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', 0.9)
      })
    } finally {
      clearTimeout(playTimeout)
      // Critical: detach the MediaStream and force the underlying WebMediaPlayer
      // to be released. Without this, Chromium accumulates WebMediaPlayers
      // (hard cap 1000/frame) and play() silently stalls after the limit.
      video.pause()
      video.srcObject = null
      video.load()
      video.remove()
    }
  }

  const captureWorkspaceElectron = async (): Promise<Blob> => {
    const workArea = document.querySelector<HTMLElement>('#app')
    if (!workArea) throw new Error('Work area element not found')
    const { x, y, width, height } = workArea.getBoundingClientRect()
    const rect: Electron.Rectangle = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.floor(width),
      height: Math.floor(height),
    }
    // @ts-ignore: ignore TypeScript error on next line
    const jpegBuffer = await window.electronAPI!.captureWorkspace(rect)
    return new Blob([jpegBuffer], { type: 'image/jpeg' })
  }

  /**
   * Captures snapshots from the given streams and optionally the workspace.
   * @param {string[]} streamNames - Names of the video streams to capture
   * @param {boolean} captureWorkspace - Whether to also capture the Cockpit workspace
   * @returns {{ succeeded: string[]; failed: string[] }} Per-source capture results
   */
  const takeSnapshot = async (streamNames: string[], captureWorkspace?: boolean): Promise<SnapshotResult> => {
    const { yaw, pitch, roll } = vehicleStore.attitude
    const { latitude, longitude } = vehicleStore.coordinates
    const missionName = missionStore.missionName || 'Cockpit'
    const capturedAt = new Date()

    const succeeded: string[] = []
    const failed: string[] = []

    if (captureWorkspace) {
      if (isElectron() && window.electronAPI) {
        try {
          let wsBlob = await captureWorkspaceElectron()
          const wsExif = buildExif({
            latitude,
            longitude,
            capturedAt,
            yaw,
            pitch,
            roll,
            width: window.innerWidth,
            height: window.innerHeight,
          })
          wsBlob = await maybeEmbedExif(wsBlob, wsExif)
          const thumbBlob = await createThumbnail(wsBlob, 200, 113)
          const filename = snapshotFilename('workspace', missionName, capturedAt)
          const thumbFilename = filename + '-thumb'
          await snapshotStorage.setItem(filename, wsBlob)
          await snapshotThumbStorage.setItem(thumbFilename, thumbBlob)
          succeeded.push('workspace')
        } catch (err) {
          console.error('Failed to capture workspace snapshot:', err)
          failed.push('workspace')
        }
      }
    }

    for (const streamName of streamNames) {
      // Register as a transient consumer for the whole capture so an ad-hoc snapshot of a stream no widget is
      // showing doesn't leave it (and its WebRTC session) active afterwards, while keeping it alive for both the
      // frame grab and the track-settings read below.
      const consumerId = uuid()
      videoStore.registerStreamConsumer(streamName, consumerId)
      try {
        let stBlob = await captureStreamFrame(streamName)
        const thumbBlob = await createThumbnail(stBlob, 200, 113)
        const { width, height } = videoStore.getMediaStream(streamName)?.getVideoTracks()[0].getSettings() || {}
        const stExif = buildExif({ latitude, longitude, capturedAt, yaw, pitch, roll, width, height })
        stBlob = await maybeEmbedExif(stBlob, stExif)
        const internalStreamName = videoStore.internalStreamNameFromExternal(streamName) ?? streamName
        const filename = snapshotFilename(internalStreamName, missionName, capturedAt)
        const thumbFilename = filename + '-thumb'

        await snapshotStorage.setItem(filename, stBlob)
        await snapshotThumbStorage.setItem(thumbFilename, thumbBlob)
        succeeded.push(streamName)
      } catch (err) {
        console.error(`Failed to capture snapshot for stream '${streamName}':`, err)
        failed.push(streamName)
      } finally {
        videoStore.unregisterStreamConsumer(streamName, consumerId)
      }
    }

    return { succeeded, failed }
  }

  const createZipAndDownload = async (
    files: FileDescriptor[],
    zipFilename: string,
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { level: 0 })
    const zipAddingPromises = files.map(({ filename, blob }) =>
      zipWriter.add(filename, new BlobReader(blob), { onprogress: progressCallback })
    )
    await Promise.all(zipAddingPromises)
    const blob = await zipWriter.close()
    saveAs(blob, zipFilename)
  }

  const downloadFiles = async (
    db: StorageDB | LocalForage,
    keys: string[],
    shouldZip = false,
    zipFilenamePrefix = 'Cockpit-Snapshot-Files',
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const maybeFiles = await Promise.all(
      keys.map(async (key) => {
        try {
          return { blob: await db.getItem(key), filename: key }
        } catch (err) {
          console.error(`Snapshot download: failed to read "${key}"`, err)
          return { blob: undefined, filename: key }
        }
      })
    )

    const files = maybeFiles.filter((file): file is SnapshotFileDescriptor => file.blob instanceof Blob)
    if (files.length === 0) {
      showDialog({ message: 'No files found.', variant: 'error' })
      return
    }
    if (shouldZip) {
      await createZipAndDownload(files, `${zipFilenamePrefix}.zip`, progressCallback)
    } else {
      files.forEach(({ blob, filename }) => saveAs(blob, filename))
    }
  }

  const downloadFilesFromSnapshotDB = async (
    fileNames: string[],
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    console.debug(`Downloading files from the snapshot database: ${fileNames.join(', ')}`)
    if (fileNames.length > 1 && zipMultipleFiles.value) {
      const ZipFilename = fileNames.length > 1 ? 'Cockpit-Snapshot-Capturing' : 'Cockpit-Snapshot-Capturing'
      await downloadFiles(snapshotStorage, fileNames, true, ZipFilename, progressCallback)
    } else {
      await downloadFiles(snapshotStorage, fileNames)
    }
  }

  const deleteSnapshotFiles = async (fileNames: string[]): Promise<void> => {
    await Promise.all(fileNames.map((fileName) => snapshotStorage.removeItem(fileName)))
    await Promise.all(fileNames.map((fileName) => snapshotThumbStorage.removeItem(fileName + '-thumb')))
  }

  const takeSnapshotAction = async (): Promise<void> => {
    const activeStreams = videoStore.namesAvailableStreams.filter(
      (name: string) => !videoStore.ignoredStreamExternalIds.includes(name)
    )
    const { succeeded, failed } = await takeSnapshot(activeStreams, isElectron())
    if (failed.length > 0) {
      console.error(`Snapshot action failed for: ${failed.join(', ')}`)
    }
    if (succeeded.length > 0) {
      console.log(`Snapshot taken successfully via action for: ${succeeded.join(', ')}`)
    }
  }

  // Register the snapshot action callback
  registerActionCallback(availableCockpitActions.take_snapshot, useThrottleFn(takeSnapshotAction, 300))

  return {
    snapshotStorage,
    snapshotThumbStorage,
    downloadFilesFromSnapshotDB,
    takeSnapshot,
    deleteSnapshotFiles,
    zipMultipleFiles,
  }
})
