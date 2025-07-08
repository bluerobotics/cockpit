import { app, ipcMain } from 'electron'
import * as os from 'os'

/**
 * Setup memory usage monitoring
 * Exposes IPC handler for getting real-time memory usage information
 */
export const setupResourceMonitoringService = (): void => {
  ipcMain.handle('get-resource-usage', async () => {
    try {
      const memoryInfo = await app.getAppMetrics()

      // Separate memory by process type
      let mainMemory = 0
      let renderersMemory = 0
      let gpuMemory = 0

      memoryInfo.forEach((metric) => {
        const memory = metric.memory?.workingSetSize || 0

        switch (metric.type) {
          case 'Browser':
            mainMemory += memory
            break
          case 'Tab':
          case 'Utility':
            renderersMemory += memory
            break
          case 'GPU':
            gpuMemory += memory
            break
          default:
            // For any other process types, add to main
            mainMemory += memory
            break
        }
      })

      // Sum all process memory for backward compatibility
      const totalMemory = memoryInfo.reduce((total, metric) => {
        return total + (metric.memory?.workingSetSize || 0)
      }, 0)

      // Get CPU usage
      const cpus = os.cpus()
      let totalIdle = 0
      let totalTick = 0

      cpus.forEach((cpu) => {
        Object.entries(cpu.times).forEach(([, time]) => {
          totalTick += time
        })
        totalIdle += cpu.times.idle
      })

      const cpuUsagePercent = Math.max(0, Math.min(100, 100 - (totalIdle / totalTick) * 100))

      return {
        totalMemoryMB: totalMemory / 1024, // Convert from KiloBytes to MegaBytes (backward compatibility)
        mainMemoryMB: mainMemory / 1024, // Main process memory in MB
        renderersMemoryMB: renderersMemory / 1024, // Total renderer processes memory in MB
        gpuMemoryMB: gpuMemory / 1024, // GPU process memory in MB
        cpuUsagePercent: cpuUsagePercent, // CPU usage percentage
      }
    } catch (error) {
      console.error('Failed to get resource usage:', error)
      return {
        totalMemoryMB: 0,
        mainMemoryMB: 0,
        renderersMemoryMB: 0,
        gpuMemoryMB: 0,
        cpuUsagePercent: 0,
      }
    }
  })
}
