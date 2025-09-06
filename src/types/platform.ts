/**
 * Platform types supported by the application
 */
export enum Platform {
  DARWIN = 'darwin',
  WIN32 = 'win32',
  LINUX = 'linux',
  ANDROID = 'android',
  FREEBSD = 'freebsd',
  OPENBSD = 'openbsd',
  SUNOS = 'sunos',
  AIX = 'aix',
}

/**
 * Architecture types supported by the application
 */
export enum Architecture {
  ARM64 = 'arm64',
  X64 = 'x64',
  IA32 = 'ia32',
  ARM = 'arm',
  S390X = 's390x',
  PPC64 = 'ppc64',
  LOONG64 = 'loong64',
  RISCV64 = 'riscv64',
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
    return platform === Platform.DARWIN
  }

  /**
   * Check if the system is ARM64 Mac
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the system is ARM64 Mac, false otherwise.
   */
  static isArm64Mac(platform: string, arch: string): boolean {
    return platform === Platform.DARWIN && arch === Architecture.ARM64
  }

  /**
   * Check if x64 version is running on ARM64 Mac (via Rosetta)
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @param {string} processArch - The architecture of the process. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the x64 version is running on ARM64 Mac (via Rosetta), false otherwise.
   */
  static isX64OnArm64Mac(platform: string, arch: string, processArch: string): boolean {
    return platform === Platform.DARWIN && arch === Architecture.ARM64 && processArch === Architecture.X64
  }

  /**
   * Check if the system is Windows
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the system is Windows, false otherwise.
   */
  static isWindows(platform: string): boolean {
    return platform === Platform.WIN32
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
