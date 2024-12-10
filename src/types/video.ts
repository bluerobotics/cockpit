import { WebRTCManager } from '@/composables/webRTC'
import type { Stream } from '@/libs/webrtc/signalling_protocol'

/**
 * Everything needed for every stream
 */
export interface StreamData {
  /**
   * The actual WebRTC stream
   */
  stream: Stream | undefined
  /**
   * The responsible for its management
   */
  webRtcManager: WebRTCManager
  /**
   * MediaStream object, if WebRTC stream is chosen
   */
  mediaStream: MediaStream | undefined
  /**
   * Connection state of the stream
   * Used to identify when to use the stream or not
   */
  connected: boolean
  /**
   * MediaRecorder object for that stream
   */
  mediaRecorder: MediaRecorder | undefined
  /**
   * Date object with info on when a recording was started, if so
   */
  timeRecordingStart: Date | undefined
}

/**
 *
 */
export interface CommonVideoInfo {
  /**
   * The name of the file
   */
  fileName: string
  /**
   * The date the recording started
   */
  dateStart?: Date
  /**
   * The last date in which the recording was updated.
   * This is updated as the recording goes on. If there's no update for a long time, it's an indication that the recording finished or failed.
   */
  dateLastRecordingUpdate?: Date
  /**
   * This date is explicitly set when the recording finishes.
   * This is undefined while the recording is ongoing.
   * If there's no update on the 'dateLastRecordingUpdate' for a long time, and this is undefined, it's an indication that the recording failed.
   */
  dateFinish?: Date
  /**
   *  The width of the video
   */
  vWidth?: number
  /**
   *  The height of the video
   */
  vHeight?: number
  /**
   *  Screen capture from first chunk of the video
   */
  thumbnail?: string
}

/* eslint-disable jsdoc/require-jsdoc  */
export interface UnprocessedVideoInfo extends CommonVideoInfo {
  dateFinish: Date | undefined
  /**
   * The last date in which the processing was updated.
   * This is updated as the processing goes on. If there's no update for a long time and the processing didn't finish, it's an indication that the processing failed.
   * This is undefined when the processing didn't start yet.
   */
  dateLastProcessingUpdate: Date | undefined
}

export interface VideoLibraryFile extends CommonVideoInfo {
  size?: number
  url: string
  hash?: string
  isProcessed: boolean
}

export interface VideoLibraryLogFile extends CommonVideoInfo {
  size?: number
  url?: string
  hash?: string
}

export interface VideoProgress {
  filename: string
  progress: number
  message: string
}

export interface VideoProcessingDetails {
  [fileName: string]: VideoProgress
}

export interface FileDescriptor {
  blob: Blob
  filename: string
}

export type DownloadProgressCallback = (progress: number, total: number) => Promise<void>

export enum VideoExtensionContainer {
  MKV = 'mkv',
  MP4 = 'mp4',
  WEBM = 'webm',
}

export const getBlobExtensionContainer = (blob: Blob): VideoExtensionContainer | undefined => {
  if (blob.type.includes('matroska')) {
    return VideoExtensionContainer.MKV
  } else if (blob.type.includes('mp4')) {
    return VideoExtensionContainer.MP4
  } else if (blob.type.includes('webm')) {
    return VideoExtensionContainer.WEBM
  }
  return undefined
}

export type WebRTCVideoStats = {
  id: string
  timestamp: number
  type: string
  codecId: string
  kind: string
  mediaType: string
  ssrc: number
  transportId: string
  jitter: number
  packetsLost: number
  packetsReceived: number
  bytesReceived: number
  firCount: number
  frameHeight: number
  frameWidth: number
  framesAssembledFromMultiplePackets: number
  framesDecoded: number
  framesDropped: number
  framesPerSecond: number
  framesReceived: number
  freezeCount: number
  headerBytesReceived: number
  jitterBufferDelay: number
  jitterBufferEmittedCount: number
  jitterBufferMinimumDelay: number
  jitterBufferTargetDelay: number
  keyFramesDecoded: number
  lastPacketReceivedTimestamp: number
  mid: string
  nackCount: number
  pauseCount: number
  pliCount: number
  remoteId: string
  totalAssemblyTime: number
  totalDecodeTime: number
  totalFreezesDuration: number
  totalInterFrameDelay: number
  totalPausesDuration: number
  totalProcessingDelay: number
  totalSquaredInterFrameDelay: number
  trackIdentifier: string
  clockRate: number
  mimeType: string
  payloadType: number
  bitrate: number
  packetRate: number
}
export type WebRTCVideoStat = keyof WebRTCVideoStats

export type WebRTCStatsEvent = {
  peerId: string
  data: {
    video: {
      inbound: {
        [index: number]: WebRTCVideoStats
      }
    }
  }
}

export type VideoStreamCorrespondency = {
  name: string
  externalId: string
}
