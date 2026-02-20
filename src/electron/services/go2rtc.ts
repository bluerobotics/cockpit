import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import http from 'http'
import { createServer } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'

import type { Go2RTCStreamInfo } from '@/types/video'

import { getGo2RTCPath } from './go2rtc-path'

let go2rtcProcess: ChildProcess | null = null
let go2rtcPort: number | null = null

/**
 * Find a free TCP port on localhost
 * @returns {Promise<number>} A free port number
 */
const getFreeTcpPort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate a free TCP port.')))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
  })
}

/**
 * Make an HTTP request and return the response body
 * @param {string} url - The URL to request
 * @param {string} method - HTTP method
 * @returns {Promise<string>} Response body
 */
const httpRequest = (url: string, method: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'))
    })
    req.end()
  })
}

/**
 * Wait for go2rtc's HTTP API to become available
 * @param {number} port - The port to check
 * @param {number} timeoutMs - Maximum wait time in milliseconds
 * @returns {Promise<void>}
 */
const waitForReady = async (port: number, timeoutMs = 10000): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await httpRequest(`http://127.0.0.1:${port}/api`, 'GET')
      return
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`go2rtc did not become ready within ${timeoutMs}ms`)
}

/**
 * Start the go2rtc sidecar process
 * @returns {Promise<number>} The port go2rtc is listening on
 */
const startGo2RTC = async (): Promise<number> => {
  if (go2rtcProcess && go2rtcPort) {
    return go2rtcPort
  }

  const port = await getFreeTcpPort()
  const configDir = join(tmpdir(), 'cockpit-go2rtc')
  await fs.mkdir(configDir, { recursive: true })

  const configPath = join(configDir, 'go2rtc.yaml')
  const config = `api:\n  listen: "127.0.0.1:${port}"\n  origin: "*"\n`
  await fs.writeFile(configPath, config, 'utf-8')

  const binaryPath = getGo2RTCPath()
  const proc = spawn(binaryPath, ['-config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  proc.stdout?.on('data', (data) => {
    const output = data.toString().trim()
    if (output) console.log(`[go2rtc] ${output}`)
  })

  proc.stderr?.on('data', (data) => {
    const output = data.toString().trim()
    if (output) console.log(`[go2rtc] ${output}`)
  })

  proc.on('error', (error) => {
    console.error('[go2rtc] Process error:', error)
    go2rtcProcess = null
    go2rtcPort = null
  })

  proc.on('close', (code, signal) => {
    console.log(`[go2rtc] Process exited: code=${code}, signal=${signal}`)
    go2rtcProcess = null
    go2rtcPort = null
  })

  go2rtcProcess = proc
  go2rtcPort = port

  await waitForReady(port)
  console.log(`[go2rtc] Running on port ${port}`)

  return port
}

/**
 * Stop the go2rtc sidecar process
 * @returns {Promise<void>}
 */
const stopGo2RTC = async (): Promise<void> => {
  if (!go2rtcProcess) return

  const proc = go2rtcProcess
  go2rtcProcess = null
  go2rtcPort = null

  await new Promise<void>((resolve) => {
    const killTimeout = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null) {
        proc.kill('SIGKILL')
      }
    }, 5000)
    proc.once('close', () => {
      clearTimeout(killTimeout)
      resolve()
    })
    proc.kill('SIGINT')
  })
}

/**
 * Register an RTSP stream with go2rtc so it can be consumed via WebRTC
 * @param {string} name - Unique stream name
 * @param {string} rtspUrl - Full RTSP URL
 * @returns {Promise<void>}
 */
const addStream = async (name: string, rtspUrl: string): Promise<void> => {
  if (!go2rtcPort) throw new Error('go2rtc is not running')
  const url = `http://127.0.0.1:${go2rtcPort}/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(
    rtspUrl
  )}`
  await httpRequest(url, 'PUT')
  console.log(`[go2rtc] Added stream '${name}' -> ${rtspUrl}`)
}

/**
 * Remove an RTSP stream from go2rtc
 * @param {string} name - Stream name to remove
 * @returns {Promise<void>}
 */
const removeStream = async (name: string): Promise<void> => {
  if (!go2rtcPort) return
  try {
    const url = `http://127.0.0.1:${go2rtcPort}/api/streams?name=${encodeURIComponent(name)}&src=`
    await httpRequest(url, 'PUT')
    console.log(`[go2rtc] Removed stream '${name}'`)
  } catch (error) {
    console.warn(`[go2rtc] Failed to remove stream '${name}':`, error)
  }
}

/**
 *
 */
interface VideoResolution {
  /**
   * The width of the video
   */
  width: number
  /**
   * The height of the video
   */
  height: number
}

/**
 * Parse H.264 SPS (Sequence Parameter Set) from base64-encoded sprop-parameter-sets to extract resolution.
 * @param {string} sps - Base64-encoded SPS NAL unit
 * @returns {{ width: number, height: number } | undefined}
 */
const parseH264SpsResolution = (sps: string): VideoResolution | undefined => {
  try {
    const buf = Buffer.from(sps, 'base64')
    if (buf.length < 4) return undefined

    let offset = 1
    const profileIdc = buf[offset++]

    // Skip constraint_set flags + level_idc
    offset += 2

    const readExpGolomb = (): number => {
      let leadingZeros = 0
      while (offset < buf.length * 8) {
        const byteIdx = Math.floor(offset / 8)
        const bitIdx = 7 - (offset % 8)
        if (byteIdx >= buf.length) return 0
        const bit = (buf[byteIdx] >> bitIdx) & 1
        offset++
        if (bit === 1) break
        leadingZeros++
      }
      let value = 0
      for (let i = 0; i < leadingZeros; i++) {
        const byteIdx = Math.floor(offset / 8)
        const bitIdx = 7 - (offset % 8)
        if (byteIdx >= buf.length) return 0
        const bit = (buf[byteIdx] >> bitIdx) & 1
        offset++
        value = (value << 1) | bit
      }
      return (1 << leadingZeros) - 1 + value
    }

    // Switch to bit-level parsing
    offset = 4 * 8

    readExpGolomb() // seq_parameter_set_id

    const highProfiles = [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134]
    if (highProfiles.includes(profileIdc)) {
      const chromaFormatIdc = readExpGolomb()
      if (chromaFormatIdc === 3) offset++ // separate_colour_plane_flag
      readExpGolomb() // bit_depth_luma_minus8
      readExpGolomb() // bit_depth_chroma_minus8
      offset++ // qpprime_y_zero_transform_bypass_flag
      const seqScalingMatrixPresent = (buf[Math.floor(offset / 8)] >> (7 - (offset % 8))) & 1
      offset++
      if (seqScalingMatrixPresent) {
        const limit = chromaFormatIdc !== 3 ? 8 : 12
        for (let i = 0; i < limit; i++) {
          const present = (buf[Math.floor(offset / 8)] >> (7 - (offset % 8))) & 1
          offset++
          if (present) {
            const size = i < 6 ? 16 : 64
            let lastScale = 8
            let nextScale = 8
            for (let j = 0; j < size; j++) {
              if (nextScale !== 0) {
                const deltaScale = readExpGolomb()
                nextScale = (lastScale + (deltaScale & 1 ? -((deltaScale + 1) >> 1) : deltaScale >> 1) + 256) % 256
              }
              lastScale = nextScale === 0 ? lastScale : nextScale
            }
          }
        }
      }
    }

    readExpGolomb() // log2_max_frame_num_minus4
    const picOrderCntType = readExpGolomb()
    if (picOrderCntType === 0) {
      readExpGolomb() // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      offset++ // delta_pic_order_always_zero_flag
      readExpGolomb() // offset_for_non_ref_pic
      readExpGolomb() // offset_for_top_to_bottom_field
      const numRefFrames = readExpGolomb()
      for (let i = 0; i < numRefFrames; i++) readExpGolomb()
    }

    readExpGolomb() // max_num_ref_frames
    offset++ // gaps_in_frame_num_value_allowed_flag
    const picWidthInMbsMinus1 = readExpGolomb()
    const picHeightInMapUnitsMinus1 = readExpGolomb()
    const frameMbsOnlyFlag = (buf[Math.floor(offset / 8)] >> (7 - (offset % 8))) & 1
    offset++

    const width = (picWidthInMbsMinus1 + 1) * 16
    const height = (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16

    return { width, height }
  } catch {
    return undefined
  }
}

/**
 * Extract resolution from an SDP string by parsing H.264 sprop-parameter-sets
 * @param {string} sdp - SDP content
 * @returns {{ width: number, height: number } | undefined}
 */
const parseResolutionFromSdp = (sdp: string): VideoResolution | undefined => {
  const spropMatch = sdp.match(/sprop-parameter-sets=([A-Za-z0-9+/=]+),/)
  if (!spropMatch) return undefined
  return parseH264SpsResolution(spropMatch[1])
}

/**
 * The stats of a stream
 */
interface StreamStatsSnapshot {
  /** Cumulative bytes received */
  bytes: number
  /** Cumulative packets received */
  packets: number
  /** Timestamp of this snapshot in ms */
  timestamp: number
}

/**
 * The rates of a stream
 */
interface StreamRates {
  /** Ingest bitrate in kbps */
  bitrateKbps: number
  /** Ingest packet rate in packets/sec */
  packetsPerSec: number
}

const prevStreamStats = new Map<string, StreamStatsSnapshot>()
const streamRates = new Map<string, StreamRates>()

/**
 * Query go2rtc for parsed info about all registered streams
 * @returns {Promise<Record<string, Go2RTCStreamInfo>>} Stream name to parsed info map
 */
const getStreamsInfo = async (): Promise<Record<string, Go2RTCStreamInfo>> => {
  if (!go2rtcPort) return {}
  try {
    const body = await httpRequest(`http://127.0.0.1:${go2rtcPort}/api/streams`, 'GET')
    const raw = JSON.parse(body) as Record<string, any>
    const result: Record<string, Go2RTCStreamInfo> = {}
    const now = Date.now()

    for (const [name, streamData] of Object.entries(raw)) {
      const producer = streamData?.producers?.[0]
      const codec = producer?.receivers?.[0]?.codec?.codec_name?.toUpperCase() ?? 'Unknown'
      const protocol = producer?.protocol ?? ''
      const sdp: string = producer?.sdp ?? ''
      const fpsMatch = sdp.match(/a=framerate:(\d+)/)
      const resolution = sdp ? parseResolutionFromSdp(sdp) : undefined

      const receiver = producer?.receivers?.[0]
      const bytes: number = receiver?.bytes ?? 0
      const packets: number = receiver?.packets ?? 0

      const prev = prevStreamStats.get(name)
      if (prev && prev.timestamp > 0) {
        const elapsed = (now - prev.timestamp) / 1000
        if (elapsed > 0) {
          streamRates.set(name, {
            bitrateKbps: ((bytes - prev.bytes) * 8) / 1000 / elapsed,
            packetsPerSec: (packets - prev.packets) / elapsed,
          })
        }
      }
      prevStreamStats.set(name, { bytes, packets, timestamp: now })

      const rates = streamRates.get(name) ?? { bitrateKbps: 0, packetsPerSec: 0 }
      result[name] = {
        codec,
        width: resolution?.width,
        height: resolution?.height,
        fps: fpsMatch?.[1] ?? '',
        protocol,
        bitrateKbps: Math.round(rates.bitrateKbps),
        packetsPerSec: Math.round(rates.packetsPerSec),
      }
    }

    return result
  } catch {
    return {}
  }
}

/**
 * Get the port go2rtc is listening on, starting it if necessary
 * @returns {Promise<number>} The port number
 */
const getPort = async (): Promise<number> => {
  if (go2rtcPort) return go2rtcPort
  return startGo2RTC()
}

/**
 * Setup go2rtc IPC handlers and start the sidecar process
 */
export const setupGo2RTCService = (): void => {
  ipcMain.handle('go2rtc-add-stream', async (_, name: string, rtspUrl: string) => {
    try {
      await addStream(name, rtspUrl)
    } catch (error) {
      console.error('[go2rtc] Error adding stream:', error)
      throw error
    }
  })

  ipcMain.handle('go2rtc-remove-stream', async (_, name: string) => {
    try {
      await removeStream(name)
    } catch (error) {
      console.error('[go2rtc] Error removing stream:', error)
      throw error
    }
  })

  ipcMain.handle('go2rtc-get-streams-info', async () => {
    try {
      return await getStreamsInfo()
    } catch (error) {
      console.error('[go2rtc] Error getting streams info:', error)
      throw error
    }
  })

  ipcMain.handle('go2rtc-get-port', async () => {
    try {
      return await getPort()
    } catch (error) {
      console.error('[go2rtc] Error getting port:', error)
      throw error
    }
  })

  process.on('exit', () => {
    void stopGo2RTC()
  })
}
