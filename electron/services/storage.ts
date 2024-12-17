import { ipcMain, shell } from 'electron'
import { app } from 'electron'
import * as fs from 'fs/promises'
import { dirname, join } from 'path'

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
      return await fs.readFile(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },
  async removeItem(key: string, subFolders?: string[]): Promise<void> {
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    await fs.unlink(filePath)
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
}
