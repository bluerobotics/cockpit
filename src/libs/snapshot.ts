import { format } from 'date-fns'
import piexif from 'piexifjs'

import { app_version } from '@/libs/cosmos'
import { sanitizeFilenameComponent } from '@/libs/utils'
import { EIXFType, SnapshotExif } from '@/types/snapshot'

/**
 * Formats a date as EXIF ASCII local DateTime (`YYYY:MM:DD HH:MM:SS`).
 * @param {Date} date
 * @returns {string}
 */
export const formatExifDateTime = (date: Date): string => format(date, 'yyyy:MM:dd HH:mm:ss')

/**
 * Formats a date as EXIF GPSDateStamp in UTC (`YYYY:MM:DD`).
 * @param {Date} date
 * @returns {string}
 */
export const formatExifGpsDateStamp = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}:${month}:${day}`
}

/**
 * Builds an EXIF GPSTimeStamp rational triplet from the UTC time of a date.
 * @param {Date} date
 * @returns {[number, number][]}
 */
export const toExifGpsTimeStamp = (date: Date): [number, number][] => {
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()
  return [
    [hours, 1],
    [minutes, 1],
    [seconds, 1],
  ]
}

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error ?? new Error('FileReader failed to read blob'))
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

/**
 * Builds the EXIF payload embedded into a captured snapshot JPEG.
 * @param {EIXFType} opts
 * @returns {SnapshotExif}
 */
export const buildExif = (opts: EIXFType): SnapshotExif => {
  const { latitude, longitude, capturedAt, yaw, pitch, roll, width, height } = opts
  const dateTime = formatExifDateTime(capturedAt)

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
      [piexif.ImageIFD.DateTime]: dateTime,
    },
    'Exif': {
      [piexif.ExifIFD.UserComment]: JSON.stringify(jsonComment),
      [piexif.ExifIFD.PixelXDimension]: width,
      [piexif.ExifIFD.PixelYDimension]: height,
      [piexif.ExifIFD.DateTimeOriginal]: dateTime,
      [piexif.ExifIFD.DateTimeDigitized]: dateTime,
    },
    'GPS': {
      [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLatitude]: toDMS(Math.abs(latitude)),
      [piexif.GPSIFD.GPSLongitude]: toDMS(Math.abs(longitude)),
      [piexif.GPSIFD.GPSDateStamp]: formatExifGpsDateStamp(capturedAt),
      [piexif.GPSIFD.GPSTimeStamp]: toExifGpsTimeStamp(capturedAt),
    },
  }
}

const embedExif = async (blob: Blob, exifObj: piexif.Ifd): Promise<Blob> => {
  const dataURL = await blobToDataURL(blob)
  const exifStr = piexif.dump(exifObj)
  const updated = piexif.insert(exifStr, dataURL)
  return dataURLToBlob(updated)
}

/**
 * Embeds EXIF into a JPEG blob, returning the original blob on failure or non-JPEG input.
 * @param {Blob} blob
 * @param {piexif.Ifd} exif
 * @returns {Promise<Blob>}
 */
export const maybeEmbedExif = async (blob: Blob, exif: piexif.Ifd): Promise<Blob> => {
  if (blob.type !== 'image/jpeg') return blob
  try {
    return await embedExif(blob, exif)
  } catch (err) {
    console.error('EXIF embed failed – storing image without metadata', err)
    return blob
  }
}

/**
 * Builds a sanitized snapshot filename for the given stream and mission.
 * @param {string} streamName
 * @param {string} missionName
 * @param {Date} capturedAt
 * @returns {string}
 */
export const snapshotFilename = (streamName: string, missionName = 'Cockpit', capturedAt: Date): string => {
  // Sanitize because the `O` timezone token emits a real colon for non-integer UTC offsets (e.g. `GMT+5:30`), which is illegal on Windows and yields a 0KB file.
  const timeString = sanitizeFilenameComponent(format(capturedAt, 'LLL dd, yyyy - HH꞉mm꞉ss.SSS O'))
  const safeMissionName = sanitizeFilenameComponent(missionName) || 'Cockpit'
  const safeStreamName = sanitizeFilenameComponent(streamName) || 'workspace'
  return `${safeMissionName} (${timeString}) #${safeStreamName}.jpeg`
}

/**
 * Creates a JPEG thumbnail of the given image blob.
 * @param {Blob} blob
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Blob>}
 */
export const createThumbnail = (blob: Blob, width: number, height: number): Promise<Blob> => {
  const img = document.createElement('img')
  const objectUrl = URL.createObjectURL(blob)
  img.src = objectUrl
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
          URL.revokeObjectURL(objectUrl)
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
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image load failed'))
    }
  })
}
