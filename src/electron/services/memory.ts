import { app, ipcMain } from 'electron'

/**
 * Setup memory usage monitoring
 * Exposes IPC handler for getting real-time memory usage information
 */
export const setupMemoryService = (): void => {
  ipcMain.handle('get-resource-usage', async () => {
    try {
      const memoryInfo = await app.getAppMetrics()

      // Sum all process memory
      const totalMemory = memoryInfo.reduce((total, metric) => {
        return total + (metric.memory?.workingSetSize || 0)
      }, 0)

      return {
        totalMemoryMB: totalMemory / 1024, // Convert from KiloBytes to MegaBytes
      }
    } catch (error) {
      console.error('Failed to get memory usage:', error)
      return {
        totalMemoryMB: 0,
      }
    }
  })
}
