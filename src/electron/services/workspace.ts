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
    // JPEG encodes ~5x faster than PNG and yields a smaller payload, which keeps the main
    // process responsive during fast/timed captures (PNG encoding stalled the renderer).
    return image.toJPEG(90)
  })
}
