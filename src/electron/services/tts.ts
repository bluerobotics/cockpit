import { type ChildProcess, spawn } from 'child_process'
import { type IpcMainInvokeEvent, app, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { type FileHandle } from 'fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'path'

import { type PiperVoiceStatus, type TtsDownloadResult, defaultPiperVoiceKey, piperVoices } from '../../types/tts'
import { type VoiceModel, downloadedVoicesDir, getPiperRuntime, resolveVoiceModel } from './piper-tts-path'

const runningProcesses = new Set<ChildProcess>()

// A crashed or wedged Piper would otherwise never answer, and the renderer
// serializes alerts behind each other, so an unanswered request would silence
// every later alert.
const synthesisTimeoutMs = 20000

const huggingFaceBase = 'https://huggingface.co/rhasspy/piper-voices/resolve/main'

/**
 * Build the HuggingFace download URL for a Piper model file. The basename encodes
 * the location, e.g. `en_US-amy-medium` lives under `en/en_US/amy/medium/`.
 * @param {string} basename - Model basename without extension.
 * @param {string} extension - File extension, `.onnx` or `.onnx.json`.
 * @returns {string} The absolute download URL.
 */
const modelUrl = (basename: string, extension: string): string => {
  const [region, speaker, quality] = basename.split('-')
  const lang = region.split('_')[0]
  return `${huggingFaceBase}/${lang}/${region}/${speaker}/${quality}/${basename}${extension}?download=true`
}

const fileExists = (filePath: string): Promise<boolean> =>
  fs.access(filePath).then(
    () => true,
    () => false
  )

/**
 * Download a URL to a destination via a `.part` file that is renamed on success,
 * so an interrupted download never looks complete. `fetch` follows redirects.
 * @param {string} url - Source URL.
 * @param {string} dest - Destination path.
 * @param {(ratio: number) => void} onProgress - Called with the fraction received so far.
 * @param {AbortSignal} signal - Aborts the transfer when the user cancels.
 * @returns {Promise<void>} Resolves once the file is fully written.
 */
const downloadTo = async (
  url: string,
  dest: string,
  onProgress: (ratio: number) => void,
  signal: AbortSignal
): Promise<void> => {
  const partPath = `${dest}.part`
  let file: FileHandle | undefined
  try {
    const response = await fetch(url, { signal })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`)

    const total = Number(response.headers.get('content-length') ?? 0)
    let received = 0
    let reported = 0
    file = await fs.open(partPath, 'w')

    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await file.write(value)
      received += value.length
      // A model arrives in thousands of chunks, so the renderer only hears about
      // the ones that move a progress bar.
      const ratio = total > 0 ? received / total : 0
      if (ratio - reported >= 0.01) {
        reported = ratio
        onProgress(ratio)
      }
    }

    await file.close()
    file = undefined
    if (total > 0 && received !== total) throw new Error(`Truncated download: got ${received} of ${total} bytes`)
    await fs.rename(partPath, dest)
  } catch (error) {
    await file?.close().catch(() => undefined)
    await fs.unlink(partPath).catch(() => undefined)
    throw error
  }
}

/**
 * Synthesize speech for the given text with a curated Piper voice.
 * @param {string} text - Text to speak.
 * @param {string} voiceKey - The Piper speaker key to synthesize with.
 * @returns {Promise<Buffer | null>} WAV audio bytes, or null when the runtime/voice is unavailable or synthesis fails.
 */
const synthesize = async (text: string, voiceKey: string): Promise<Buffer | null> => {
  const runtime = getPiperRuntime()
  if (!runtime) return null

  const voice: VoiceModel | null = resolveVoiceModel(voiceKey)
  if (!voice) return null

  const spoken = text.replace(/\s+/g, ' ').trim()
  if (!spoken) return null

  const outputFile = path.join(app.getPath('temp'), `cockpit-tts-${randomUUID()}.wav`)

  return new Promise<Buffer | null>((resolve) => {
    const child = spawn(
      runtime.binary,
      [
        '--model',
        voice.model,
        '--config',
        voice.config,
        '--espeak_data',
        runtime.espeakData,
        '--output_file',
        outputFile,
      ],
      { cwd: runtime.baseDir, env: { ...process.env, LD_LIBRARY_PATH: runtime.baseDir } }
    )
    runningProcesses.add(child)

    const timeout = setTimeout(() => {
      console.error(`[tts] Piper took longer than ${synthesisTimeoutMs} ms to speak. Killing it.`)
      child.kill('SIGKILL')
    }, synthesisTimeoutMs)

    /**
     * Remove a temp WAV, ignoring the error when it was never created.
     * @returns {Promise<void>} Resolves once cleanup is attempted.
     */
    const cleanup = (): Promise<void> => fs.unlink(outputFile).catch(() => undefined)

    child.on('error', async (error) => {
      clearTimeout(timeout)
      runningProcesses.delete(child)
      console.error(`[tts] Failed to run Piper: ${error.message}`)
      await cleanup()
      resolve(null)
    })

    child.on('close', async (code, signal) => {
      clearTimeout(timeout)
      runningProcesses.delete(child)
      if (code !== 0) {
        console.error(`[tts] Piper exited with code ${code}${signal ? ` (signal ${signal})` : ''}`)
        await cleanup()
        resolve(null)
        return
      }
      try {
        const audio = await fs.readFile(outputFile)
        resolve(audio)
      } catch (error) {
        console.error(`[tts] Could not read synthesized audio: ${error}`)
        resolve(null)
      } finally {
        await cleanup()
      }
    })

    child.stdin.on('error', () => undefined)
    child.stdin.end(spoken)
  })
}

let synthesisProbe: Promise<boolean> | undefined

/**
 * Whether the bundled runtime can actually speak, probed once with a real
 * synthesis. Having the files on disk is not enough: the binary can still fail
 * to launch (missing system libraries, macOS refusing an unsigned dylib), and a
 * runtime that cannot speak must fall back to the host voices instead of
 * leaving the user with a silent picker.
 * @returns {Promise<boolean>} True when a test synthesis produced audio.
 */
const canSynthesize = (): Promise<boolean> => {
  synthesisProbe ??= synthesize('Cockpit', defaultPiperVoiceKey).then(
    (audio) => audio !== null,
    () => false
  )
  return synthesisProbe
}

/**
 * Availability of each curated voice on disk (bundled or downloaded).
 * @returns {Promise<PiperVoiceStatus[]>} One status entry per curated voice.
 */
const listVoices = async (): Promise<PiperVoiceStatus[]> => {
  const dir = downloadedVoicesDir()
  return Promise.all(
    piperVoices.map(async (voice) => ({
      key: voice.key,
      label: voice.label,
      available: resolveVoiceModel(voice.key) !== null,
      hd:
        (await fileExists(path.join(dir, `${voice.hdModel}.onnx`))) &&
        (await fileExists(path.join(dir, `${voice.hdModel}.onnx.json`))),
    }))
  )
}

let runningDownload: AbortController | undefined

/**
 * Download the higher-quality model for every curated voice, reporting progress.
 * Each model is ~63 MB, so progress is reported as bytes arrive rather than once
 * per finished voice. Voices already on disk are kept, making a retry resume.
 * @param {IpcMainInvokeEvent} event - Invoke event used to push progress to the renderer.
 * @returns {Promise<TtsDownloadResult>} How the download ended.
 */
const downloadHdVoices = async (event: IpcMainInvokeEvent): Promise<TtsDownloadResult> => {
  if (!getPiperRuntime()) return 'failed'
  // Single-flight here rather than in the renderer, whose state a window reload resets while this loop
  // keeps running: two loops would write the same `.part` file and rename interleaved bytes over a model.
  if (runningDownload) return 'busy'

  const dir = downloadedVoicesDir()
  await fs.mkdir(dir, { recursive: true })

  runningDownload = new AbortController()
  const { signal } = runningDownload

  const total = piperVoices.length
  let completed = 0
  const report = (voiceProgress: number): void => {
    event.sender.send('tts-download-progress', { completed, total, voiceProgress })
  }
  report(0)

  try {
    for (const voice of piperVoices) {
      const onnx = path.join(dir, `${voice.hdModel}.onnx`)
      const config = path.join(dir, `${voice.hdModel}.onnx.json`)
      if (!(await fileExists(onnx))) await downloadTo(modelUrl(voice.hdModel, '.onnx'), onnx, report, signal)
      // The config is a few kilobytes next to a ~63 MB model, so it does not move the bar.
      if (!(await fileExists(config))) {
        await downloadTo(modelUrl(voice.hdModel, '.onnx.json'), config, () => undefined, signal)
      }
      completed += 1
      report(0)
    }
    return 'ok'
  } catch (error) {
    if (signal.aborted) return 'cancelled'
    console.error(`[tts] Failed to download the higher-quality voices: ${error}`)
    return 'failed'
  } finally {
    runningDownload = undefined
  }
}

/**
 * Delete every downloaded higher-quality voice, reverting to the bundled model.
 * @returns {Promise<boolean>} True when the downloaded models were removed.
 */
const deleteHdVoices = async (): Promise<boolean> => {
  const dir = downloadedVoicesDir()
  try {
    await Promise.all(
      piperVoices.flatMap((voice) => [
        fs.rm(path.join(dir, `${voice.hdModel}.onnx`), { force: true }),
        fs.rm(path.join(dir, `${voice.hdModel}.onnx.json`), { force: true }),
      ])
    )
    // Remove the folder too when nothing else lives in it, best-effort.
    await fs.rmdir(dir).catch(() => undefined)
    return true
  } catch (error) {
    console.error(`[tts] Failed to delete downloaded voices: ${error}`)
    return false
  }
}

/**
 * Register the bundled-TTS IPC handlers and ensure Piper processes are stopped on exit.
 */
export const setupTTSService = (): void => {
  ipcMain.handle('tts-available', async () => {
    if (!getPiperRuntime() || !resolveVoiceModel(defaultPiperVoiceKey)) return false
    return canSynthesize()
  })

  ipcMain.handle('tts-list-voices', async () => {
    try {
      return await listVoices()
    } catch (error) {
      console.error('[tts] Error listing voices:', error)
      return []
    }
  })

  ipcMain.handle('tts-synthesize', async (_event, text: string, voiceKey: string) => {
    try {
      return await synthesize(text, voiceKey)
    } catch (error) {
      console.error('[tts] Error synthesizing speech:', error)
      return null
    }
  })

  ipcMain.handle('tts-download-voices', async (event) => {
    try {
      return await downloadHdVoices(event)
    } catch (error) {
      console.error('[tts] Error downloading voices:', error)
      return 'failed'
    }
  })

  ipcMain.handle('tts-cancel-download', () => runningDownload?.abort())

  ipcMain.handle('tts-delete-voices', () => deleteHdVoices())

  process.on('exit', () => {
    runningDownload?.abort()
    runningProcesses.forEach((child) => child.kill())
    runningProcesses.clear()
  })
}
