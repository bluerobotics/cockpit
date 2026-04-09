/**
 * Platform types supported by the application
 */
export enum Platform {
  MACOS = 'darwin',
  WINDOWS = 'win32',
  LINUX = 'linux',
}

/**
 * Architecture types supported by the application
 */
export enum Architecture {
  X64 = 'x64',
  IA32 = 'ia32',
  ARM64 = 'arm64',
  ARM = 'arm',
  RISCV64 = 'riscv64',
}

/**
 * Display information
 */
export interface DisplayInfo {
  /**
   * The width of the display in pixels
   */
  width: number
  /**
   * The height of the display in pixels
   */
  height: number
  /**
   * The scale factor of the display (DPI scaling)
   */
  scaleFactor: number
}

/**
 * Basic system information from electron
 */
export interface BasicSystemInfo {
  /**
   * The platform of the system. Possibilities can be found in the Platform enum.
   */
  platform: string
  /**
   * The architecture of the system. Possibilities can be found in the Architecture enum.
   */
  arch: string
  /**
   * The architecture of the process. Possibilities can be found in the Architecture enum.
   */
  processArch: string
  /**
   * Information about all connected displays
   */
  displays: DisplayInfo[]
}

/**
 * Hardware-oriented fields collected in the Electron main process for usage telemetry (browser build omits this).
 */
export interface TelemetrySystemHardwareInfo {
  /**
   * Device / system manufacturer when reported by the OS
   */
  deviceManufacturer: string | null
  /**
   * Device / system model when reported by the OS
   */
  deviceModel: string | null
  /**
   * CPU vendor / manufacturer string
   */
  cpuManufacturer: string | null
  /**
   * CPU marketing model name (e.g. Core i7, Apple M1)
   */
  cpuModel: string | null
  /**
   * Number of physical CPU packages (sockets) when available
   */
  cpuPackageCount: number | null
  /**
   * Count of physical CPU cores
   */
  cpuPhysicalCoreCount: number | null
  /**
   * Count of logical CPUs (threads)
   */
  cpuLogicalCoreCount: number | null
  /**
   * Maximum advertised CPU clock speed in GHz when available
   */
  cpuSpeedMaxGHz: number | null
  /**
   * Installed RAM in bytes
   */
  totalPhysicalMemoryBytes: number | null
  /**
   * Sum of physical disk capacities reported by disk layout (bytes)
   */
  totalPhysicalStorageBytes: number | null
  /**
   * Primary GPU vendor string when available
   */
  gpuManufacturer: string | null
  /**
   * Primary GPU model name when available
   */
  gpuModel: string | null
}

/**
 * Utility functions for platform detection
 */
export class PlatformUtils {
  /**
   * Check if the platform is macOS
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the platform is macOS, false otherwise.
   */
  static isMac(platform: string): boolean {
    return platform === Platform.MACOS
  }

  /**
   * Check if the system is ARM64 Mac
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the system is ARM64 Mac, false otherwise.
   */
  static isArm64Mac(platform: string, arch: string): boolean {
    return PlatformUtils.isMac(platform) && arch === Architecture.ARM64
  }

  /**
   * Check if x64 version is running on ARM64 Mac (via Rosetta)
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @param {string} processArch - The architecture of the process. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the x64 version is running on ARM64 Mac (via Rosetta), false otherwise.
   */
  static isX64OnArm64Mac(platform: string, arch: string, processArch: string): boolean {
    return PlatformUtils.isArm64Mac(platform, arch) && processArch === Architecture.X64
  }

  /**
   * Check if the system is Windows
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the system is Windows, false otherwise.
   */
  static isWindows(platform: string): boolean {
    return platform === Platform.MACOS
  }

  /**
   * Check if the system is Linux
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the system is Linux, false otherwise.
   */
  static isLinux(platform: string): boolean {
    return platform === Platform.LINUX
  }
}
