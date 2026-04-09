import { ipcMain } from 'electron'
import type { Systeminformation } from 'systeminformation'
import { cpu, diskLayout, graphics, mem, system } from 'systeminformation'

import type { TelemetrySystemHardwareInfo } from '@/types/platform'

const emptyHardwareTelemetry = (): TelemetrySystemHardwareInfo => ({
  deviceManufacturer: null,
  deviceModel: null,
  cpuManufacturer: null,
  cpuModel: null,
  cpuPackageCount: null,
  cpuPhysicalCoreCount: null,
  cpuLogicalCoreCount: null,
  cpuSpeedMaxGHz: null,
  totalPhysicalMemoryBytes: null,
  totalPhysicalStorageBytes: null,
  gpuManufacturer: null,
  gpuModel: null,
})

/**
 * @param {string | null | undefined} value Raw string from systeminformation
 * @returns {string | null} Trimmed string or null when empty
 */
const normalizeText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

/**
 * @param {Systeminformation.GraphicsControllerData[]} controllers GPU entries from systeminformation
 * @returns {{ vendor: string | null; model: string | null }} Best-effort primary GPU identification
 */
const pickPrimaryGpu = (
  controllers: Systeminformation.GraphicsControllerData[]
): {
  /**
   * Primary GPU vendor string when available
   * e.g. "NVIDIA"
   */
  vendor: string | null
  /**
   * Primary GPU model name when available
   * e.g. "NVIDIA GeForce RTX 3060"
   */
  model: string | null
} => {
  if (!controllers?.length) {
    return { vendor: null, model: null }
  }
  const sorted = [...controllers].sort((a, b) => {
    const av = typeof a.vram === 'number' ? a.vram : 0
    const bv = typeof b.vram === 'number' ? b.vram : 0
    return bv - av
  })
  const primary = sorted[0]
  const model = normalizeText(primary.model) ?? normalizeText(primary.name)
  return {
    vendor: normalizeText(primary.vendor),
    model,
  }
}

/**
 * Collect hardware-oriented telemetry in the main process via systeminformation.
 * @returns {Promise<TelemetrySystemHardwareInfo>} Serializable hardware snapshot or null-filled object on failure
 */
export const collectTelemetryHardwareInfo = async (): Promise<TelemetrySystemHardwareInfo> => {
  try {
    const [systemData, cpuData, memData, diskLayoutData, graphicsData] = await Promise.all([
      system(),
      cpu(),
      mem(),
      diskLayout(),
      graphics(),
    ])

    const totalPhysicalStorageBytes = diskLayoutData.reduce((sum, disk) => {
      return disk.size > 0 ? sum + disk.size : sum
    }, 0)

    const { vendor: gpuManufacturer, model: gpuModel } = pickPrimaryGpu(graphicsData.controllers)

    const speedMax = cpuData.speedMax > 0 ? cpuData.speedMax : cpuData.speed > 0 ? cpuData.speed : null

    return {
      deviceManufacturer: normalizeText(systemData.manufacturer),
      deviceModel: normalizeText(systemData.model),
      cpuManufacturer: normalizeText(cpuData.manufacturer),
      cpuModel: normalizeText(cpuData.brand),
      cpuPackageCount: cpuData.processors > 0 ? cpuData.processors : null,
      cpuPhysicalCoreCount: cpuData.physicalCores > 0 ? cpuData.physicalCores : null,
      cpuLogicalCoreCount: cpuData.cores > 0 ? cpuData.cores : null,
      cpuSpeedMaxGHz: speedMax,
      totalPhysicalMemoryBytes: memData.total > 0 ? memData.total : null,
      totalPhysicalStorageBytes: totalPhysicalStorageBytes > 0 ? totalPhysicalStorageBytes : null,
      gpuManufacturer,
      gpuModel,
    }
  } catch {
    return emptyHardwareTelemetry()
  }
}

/**
 * Registers IPC to expose {@link collectTelemetryHardwareInfo} to the renderer.
 */
export const setupHardwareTelemetryService = (): void => {
  ipcMain.handle('get-hardware-telemetry-info', async (): Promise<TelemetrySystemHardwareInfo> => {
    return collectTelemetryHardwareInfo()
  })
}
