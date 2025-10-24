import { useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { format } from 'date-fns'
import saveAs from 'file-saver'
import piexif from 'piexifjs'
import { defineStore } from 'pinia'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { app_version } from '@/libs/cosmos'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { isElectron } from '@/libs/utils'
import { snapshotStorage, snapshotThumbStorage } from '@/libs/videoStorage'
import { StorageDB } from '@/types/general'
import { EIXFType, SnapshotExif, SnapshotFileDescriptor } from '@/types/snapshot'
import { DownloadProgressCallback, FileDescriptor } from '@/types/video'

import { useMainVehicleStore } from './mainVehicle'
import { useVideoStore } from './video'

export const useSnapshotStore = defineStore('snapshot', () => {
  const videoStore = useVideoStore()
  const vehicleStore = useMainVehicleStore()
  const { showDialog } = useInteractionDialog()

  const zipMultipleFiles = useBlueOsStorage('cockpit-zip-multiple-video-files', false)

  const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(blob)
    })

  const dataURLToBlob = (dataURL: string): Blob => {
    const [meta, b64] = dataURL.split(',')
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const mime = /data:(.*);base64/.exec(meta)?.[1] ?? 'image/jpeg'
    return new Blob([arr], { type: mime })
  }

  const toDMS = (deg: number): [number, number][] => {
    const d = Math.floor(Math.abs(deg))
    const mFloat = (Math.abs(deg) - d) * 60
    const m = Math.floor(mFloat)
    const s = Math.round((mFloat - m) * 6000)
    return [
      [d, 1],
      [m, 1],
      [s, 100],
    ]
  }

  const buildExif = (opts: EIXFType): SnapshotExif => {
    const { latitude, longitude, yaw, pitch, roll, width, height } = opts

    const jsonComment = {
      vehicle_attitude: {
        yaw: yaw ?? 0,
        pitch: pitch ?? 0,
        roll: roll ?? 0,
      },
    }

    return {
      '0th': {
        [piexif.ImageIFD.Software]: `Cockpit ${app_version.version} - Blue Robotics`,
      },
      'Exif': {
        [piexif.ExifIFD.UserComment]: JSON.stringify(jsonComment),
        [piexif.ExifIFD.PixelXDimension]: width,
        [piexif.ExifIFD.PixelYDimension]: height,
      },
      'GPS': {
        [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
        [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
        [piexif.GPSIFD.GPSLatitude]: toDMS(Math.abs(latitude)),
        [piexif.GPSIFD.GPSLongitude]: toDMS(Math.abs(longitude)),
      },
    }
  }

  const embedExif = async (blob: Blob, exifObj: piexif.Ifd): Promise<Blob> => {
    const dataURL = await blobToDataURL(blob)
    const exifStr = piexif.dump(exifObj)
    const updated = piexif.insert(exifStr, dataURL)
    return dataURLToBlob(updated)
  }

  const maybeEmbedExif = async (b: Blob, exif: piexif.Ifd): Promise<Blob> => {
    if (b.type !== 'image/jpeg') return b
    try {
      return await embedExif(b, exif)
    } catch (err) {
      console.error('EXIF embed failed – storing image without metadata', err)
      return b
    }
  }

  const captureStreamFrame = async (streamName: string): Promise<Blob> => {
    if (!streamName) {
      return Promise.reject(new Error('Stream name is required to capture a snapshot.'))
    }
    const mediaStream = videoStore.getMediaStream(streamName)
    if (!mediaStream) return Promise.reject(new Error(`Media stream not found for stream name: ${streamName}`))

    const video = document.createElement('video')
    video.srcObject = mediaStream
    video.playsInline = true
    video.muted = true
    video.style.display = 'none'
    document.body.appendChild(video)

    await video.play()
    const track = mediaStream.getVideoTracks()[0]
    const { width = video.videoWidth, height = video.videoHeight } = track.getSettings()
    video.width = width
    video.height = height

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    ctx.drawImage(video, 0, 0, width, height)

    video.pause()
    document.body.removeChild(video)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', 0.9)
    })
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
    const pngBuffer = await window.electronAPI!.captureWorkspace(rect)
    return new Blob([pngBuffer], { type: 'image/png' })
  }

  const snapshotFilename = (streamName: string): string => {
    const timestamp = format(new Date(), 'LLL dd, yyyy - HH꞉mm꞉ss O')
    return `(${timestamp})_Cockpit_${streamName}.jpeg`
  }

  const createThumbnail = (blob: Blob, width: number, height: number): Promise<Blob> => {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(blob)
    img.width = width
    img.height = height

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')

    return new Promise<Blob>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (thumbnailBlob) => {
            if (thumbnailBlob) {
              resolve(thumbnailBlob)
            } else {
              reject(new Error('Canvas toBlob failed'))
            }
          },
          'image/jpeg',
          0.9
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
    })
  }

  const takeSnapshot = async (streamNames: string[], captureWorkspace?: boolean): Promise<void> => {
    const { yaw, pitch, roll } = vehicleStore.attitude
    const { latitude, longitude } = vehicleStore.coordinates

    if (captureWorkspace) {
      if (isElectron() && window.electronAPI) {
        try {
          let wsBlob = await captureWorkspaceElectron()
          const wsExif = buildExif({
            latitude,
            longitude,
            yaw,
            pitch,
            roll,
            width: window.innerWidth,
            height: window.innerHeight,
          })
          wsBlob = await maybeEmbedExif(wsBlob, wsExif)
          await snapshotStorage.setItem(snapshotFilename('workspace'), wsBlob)
        } catch (err) {
          throw err as Error
        }
      } else {
        throw new Error('Workspace capture requires Electron')
      }
    }

    if (streamNames.length > 0) {
      for (const streamName of streamNames) {
        try {
          let stBlob = await captureStreamFrame(streamName)
          const thumbBlob = await createThumbnail(stBlob, 200, 113)
          const { width, height } = videoStore.getMediaStream(streamName)?.getVideoTracks()[0].getSettings() || {}
          const stExif = buildExif({ latitude, longitude, yaw, pitch, roll, width, height })
          stBlob = await maybeEmbedExif(stBlob, stExif)
          const filename = snapshotFilename(streamName.replace(/[\\/]/g, '_') || 'workspace')
          const thumbFilename = snapshotFilename(streamName.replace(/[\\/]/g, '_') || 'workspace') + '-thumb'

          await snapshotStorage.setItem(filename, stBlob)
          await snapshotThumbStorage.setItem(thumbFilename, thumbBlob)
        } catch (err) {
          throw err as Error
        }
      }
    }
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
    try {
      // Take a snapshot of all available streams
      await takeSnapshot(videoStore.namesAvailableStreams, isElectron())
      console.log('Snapshot taken successfully via action')
    } catch (error) {
      console.error('Error taking snapshot via action:', error)
    }
  }

  // Register the snapshot action callback
  registerActionCallback(availableCockpitActions.take_snapshot, useThrottleFn(takeSnapshotAction, 300))

  return {
    snapshotStorage,
    snapshotThumbStorage,
    downloadFilesFromSnapshotDB,
    snapshotFilename,
    takeSnapshot,
    deleteSnapshotFiles,
    zipMultipleFiles,
  }
})
