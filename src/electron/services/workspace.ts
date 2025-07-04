import { BrowserWindow, ipcMain } from 'electron'

/**
 * Setup workspace service
 * Exposes Electron IPC handler for capturing the workspace
 */
export const setupWorkspaceService = (): void => {
  ipcMain.handle('capture-workspace', async (event, rect) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window')
    const image = await win.capturePage(rect)
    return image.toPNG()
  })
}
