/**
 * Snapshot File descriptor
 */
export interface SnapshotFileDescriptor {
  /**
   * Snapshot content
   */
  blob: Blob
  /**
   * Filename of the snapshot
   */
  filename: string
}

/**
 * Snapshot file descriptor for library
 */
export interface SnapshotLibraryFile extends SnapshotFileDescriptor {
  /**
   * Name of the stream or workspace from which the snapshot was taken
   */
  streamName: string
  /**
   * Date when the snapshot was taken
   */
  date: Date
  /**
   * URL to access the snapshot file
   */
  url: string
  /**
   * Thumbnail of the snapshot
   */
  thumbnail: Blob // optional, used for displaying in the library
}

/**
 * EXIF data type for snapshots
 */
export interface EIXFType {
  /**
   * Latitude of the snapshot location
   */
  latitude: number
  /**
   * Longitude of the snapshot location
   */
  longitude: number
  /**
   * Instant the snapshot was captured
   */
  capturedAt: Date
  /**
   * Yaw angle of the vehicle during the snapshot
   */
  yaw?: number
  /**
   * Pitch angle of the vehicle during the snapshot
   */
  pitch?: number
  /**
   * Roll angle of the vehicle during the snapshot
   */
  roll?: number
  /**
   * Width of the image
   */
  width?: number
  /**
   * Height of the image
   */
  height?: number
}

/**
 * Result of a snapshot capture operation, reporting which sources succeeded and which failed
 */
export interface SnapshotResult {
  /**
   * Names of sources that were captured successfully
   */
  succeeded: string[]
  /**
   * Names of sources that failed to capture
   */
  failed: string[]
}

type ExifBlock = Record<number, string | number | number[][] | undefined>

/**
 * Snapshot EXIF data structure
 */
export interface SnapshotExif {
  /**
   * Camera version
   */
  '0th': ExifBlock
  /**
   * Image description
   */
  'Exif': ExifBlock
  /**
   * GPS data
   */
  'GPS': ExifBlock
}

/**
 *
 */
export interface Thumb {
  /**
   * Thumb filename
   */
  filename: string
  /**
   * Thumb blob
   */
  blob?: Blob // raw *only if it exists*
  /**
   * URL to the thumb
   */
  url?: string // object-url cached here
}
