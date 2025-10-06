import { dialog, ipcMain, shell } from 'electron'
import { app } from 'electron'
import * as fs from 'fs/promises'
import { dirname, join } from 'path'

import type { FileDialogOptions, FileStats } from '@/types/storage'

// Create a new storage interface for filesystem
export const cockpitFolderPath = join(app.getPath('home'), 'Cockpit')
fs.mkdir(cockpitFolderPath, { recursive: true })

export const filesystemStorage = {
  async setItem(key: string, value: ArrayBuffer, subFolders?: string[]): Promise<void> {
    const buffer = Buffer.from(value)
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  },
  async getItem(key: string, subFolders?: string[]): Promise<ArrayBuffer | null> {
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    try {
      const buffer = await fs.readFile(filePath)
      return new Uint8Array(buffer).buffer
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },
  async removeItem(key: string, subFolders?: string[]): Promise<void> {
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    try {
      await fs.unlink(filePath)
    } catch (error: any) {
      // File doesn't exist, which is fine - just ignore it
      if (error.code === 'ENOENT') return

      throw error
    }
  },
  async clear(subFolders?: string[]): Promise<void> {
    const dirPath = join(cockpitFolderPath, ...(subFolders ?? []))
    await fs.rm(dirPath, { recursive: true })
  },
  async keys(subFolders?: string[]): Promise<string[]> {
    const dirPath = join(cockpitFolderPath, ...(subFolders ?? []))
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  },
}

export const setupFilesystemStorage = (): void => {
  ipcMain.handle('setItem', async (_, data) => {
    await filesystemStorage.setItem(data.key, data.value, data.subFolders)
  })
  ipcMain.handle('getItem', async (_, data) => {
    return await filesystemStorage.getItem(data.key, data.subFolders)
  })
  ipcMain.handle('removeItem', async (_, data) => {
    await filesystemStorage.removeItem(data.key, data.subFolders)
  })
  ipcMain.handle('clear', async (_, data) => {
    await filesystemStorage.clear(data.subFolders)
  })
  ipcMain.handle('keys', async (_, data) => {
    return await filesystemStorage.keys(data.subFolders)
  })
  ipcMain.handle('open-cockpit-folder', async () => {
    await fs.mkdir(cockpitFolderPath, { recursive: true })
    await shell.openPath(cockpitFolderPath)
  })
  ipcMain.handle('open-video-folder', async () => {
    const videoFolderPath = join(cockpitFolderPath, 'videos')
    await fs.mkdir(videoFolderPath, { recursive: true })
    await shell.openPath(videoFolderPath)
  })
  ipcMain.handle('open-video-file', async (_, fileName: string) => {
    const videoFolderPath = join(cockpitFolderPath, 'videos')
    const videoFilePath = join(videoFolderPath, fileName)
    await shell.openPath(videoFilePath)
  })
  ipcMain.handle('open-temp-video-chunks-folder', async () => {
    const tempChunksFolderPath = join(cockpitFolderPath, 'videos', 'temporary-video-chunks')
    await fs.mkdir(tempChunksFolderPath, { recursive: true })
    await shell.openPath(tempChunksFolderPath)
  })

  /**
   * Get file stats for a file
   * @param pathOrKey - Either a full file path, or a key (filename) if subFolders is provided
   * @param subFolders - Optional subfolders under cockpit folder (if provided, pathOrKey is treated as a key)
   */
  ipcMain.handle('get-file-stats', async (_, pathOrKey: string, subFolders?: string[]): Promise<FileStats> => {
    try {
      // If subFolders is provided, construct path from cockpit folder
      // Otherwise, treat pathOrKey as a full path
      const filePath = subFolders ? join(cockpitFolderPath, ...(subFolders ?? []), pathOrKey) : pathOrKey
      const stats = await fs.stat(filePath)
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { exists: false }
      }
      console.error('Error getting file stats:', error)
      throw error
    }
  })

  /**
   * Show file dialog to select a file
   * @param options - Optional dialog configuration
   * @returns The selected file path, or null if cancelled
   */
  ipcMain.handle('get-path-of-selected-file', async (_, options?: FileDialogOptions) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters,
      title: options?.title,
      defaultPath: options?.defaultPath,
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })
}
