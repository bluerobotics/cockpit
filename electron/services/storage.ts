import { ipcMain } from 'electron'
import { app } from 'electron'
import * as fs from 'fs/promises'
import { dirname, join } from 'path'

import { StorageDB } from '../../src/types/general'

// Create a new storage interface for filesystem
const cockpitFolderPath = join(app.getPath('home'), 'Cockpit')
fs.mkdir(cockpitFolderPath, { recursive: true })

export const filesystemStorage: StorageDB = {
  async setItem(key: string, value: ArrayBuffer): Promise<void> {
    const buffer = Buffer.from(value)
    const filePath = join(cockpitFolderPath, key)
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  },
  async getItem(key: string): Promise<ArrayBuffer | null> {
    const filePath = join(cockpitFolderPath, key)
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },
  async removeItem(key: string): Promise<void> {
    const filePath = join(cockpitFolderPath, key)
    await fs.unlink(filePath)
  },
  async clear(): Promise<void> {
    throw new Error(
      `Clear functionality is not available in the filesystem storage, so we don't risk losing important data. If you
        want to clear the storage, please delete the Cockpit folder in your user data directory manually.`
    )
  },
  async keys(): Promise<string[]> {
    const dirPath = cockpitFolderPath
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  },
  async iterate(callback: (value: unknown, key: string, iterationNumber: number) => void): Promise<void> {
    throw new Error('Iterate functionality is not available in the filesystem storage.')
  },
}

export const setupFilesystemStorage = (): void => {
  ipcMain.handle('setItem', async (_, data) => {
    await filesystemStorage.setItem(data.key, data.value)
  })
  ipcMain.handle('getItem', async (_, key) => {
    return await filesystemStorage.getItem(key)
  })
  ipcMain.handle('removeItem', async (_, key) => {
    await filesystemStorage.removeItem(key)
  })
  ipcMain.handle('clear', async () => {
    await filesystemStorage.clear()
  })
  ipcMain.handle('keys', async () => {
    return await filesystemStorage.keys()
  })
  ipcMain.handle('iterate', async (_, callback) => {
    await filesystemStorage.iterate(callback)
  })
}
