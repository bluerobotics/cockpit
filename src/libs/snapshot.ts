import { format } from 'date-fns'

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
