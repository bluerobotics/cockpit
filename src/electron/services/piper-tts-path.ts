import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import { piperVoices } from '../../types/tts'
import { getCockpitFolderPath } from './storage'

/**
 * Filesystem paths to the bundled Piper runtime.
 */
export interface PiperRuntime {
  /** Piper executable. */
  binary: string
  /** espeak-ng phoneme data directory Piper needs for text processing. */
  espeakData: string
  /** Directory holding the binary and its shared libraries. */
  baseDir: string
}

/**
 * Resolved `.onnx` model and its `.onnx.json` config for a voice.
 */
export interface VoiceModel {
  /** Voice model (`.onnx`) file. */
  model: string
  /** Voice config (`.onnx.json`) file. */
  config: string
}

let cachedRuntime: PiperRuntime | null | undefined = undefined

const bundledBaseDir = (): string =>
  app.isPackaged ? path.join(process.resourcesPath, 'piper') : path.join(process.cwd(), 'binaries', 'piper')

/**
 * Writable directory where the higher-quality voices are downloaded at runtime,
 * kept next to the videos and snapshots under the Cockpit folder.
 * @returns {string} The absolute path to the downloaded-voices directory.
 */
export const downloadedVoicesDir = (): string => path.join(getCockpitFolderPath(), 'voices')

/**
 * Resolve the bundled Piper runtime for the current install, or null when it is
 * not present (a build without the bundle, or an unsupported architecture).
 * @returns {PiperRuntime | null} The resolved runtime, or null when unavailable.
 */
export const getPiperRuntime = (): PiperRuntime | null => {
  if (cachedRuntime !== undefined) {
    return cachedRuntime
  }

  const baseDir = bundledBaseDir()
  const runtime: PiperRuntime = {
    binary: path.join(baseDir, process.platform === 'win32' ? 'piper.exe' : 'piper'),
    espeakData: path.join(baseDir, 'espeak-ng-data'),
    baseDir,
  }

  if (!fs.existsSync(runtime.binary) || !fs.existsSync(runtime.espeakData)) {
    cachedRuntime = null
    return null
  }

  // The binary ships executable, but make it best-effort so a stripped
  // permission bit does not disable voice alerts.
  try {
    fs.chmodSync(runtime.binary, '755')
  } catch (error) {
    console.warn(`Could not set executable permission on Piper binary: ${error}`)
  }

  cachedRuntime = runtime
  return runtime
}

/**
 * Resolve a usable model for a curated voice, preferring the downloaded
 * higher-quality model over the bundled low-quality one.
 * @param {string} voiceKey - The Piper speaker key (e.g. `amy`).
 * @returns {VoiceModel | null} The model paths, or null when the voice has no model on disk.
 */
export const resolveVoiceModel = (voiceKey: string): VoiceModel | null => {
  const voice = piperVoices.find((v) => v.key === voiceKey)
  if (!voice) return null

  const bases = [path.join(downloadedVoicesDir(), voice.hdModel)]
  if (voice.bundledModel) bases.push(path.join(bundledBaseDir(), 'voices', voice.bundledModel))

  for (const base of bases) {
    const model = `${base}.onnx`
    const config = `${base}.onnx.json`
    if (fs.existsSync(model) && fs.existsSync(config)) return { model, config }
  }
  return null
}
