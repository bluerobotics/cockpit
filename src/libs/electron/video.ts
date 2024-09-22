import { app } from 'electron'
import fs from 'fs/promises'
import { dirname, join } from 'path'

import { isElectron } from '@/libs/utils'
import { StorageDB } from '@/types/video'

// Create a new storage interface for filesystem
const cockpitVideosDir = join(app.getPath('userData'), 'Cockpit', 'videos')
const filesystemOnlyInElectronErrorMsg = 'Filesystem storage is only available in Electron'

export const filesystemStorage: StorageDB = {
  async setItem(key: string, value: Blob): Promise<void> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    const filePath = join(cockpitVideosDir, key)
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(await value.arrayBuffer()))
  },
  async getItem(key: string): Promise<Blob | null> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    const filePath = join(cockpitVideosDir, key)
    try {
      const buffer = await fs.readFile(filePath)
      return new Blob([buffer])
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },
  async removeItem(key: string): Promise<void> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    const filePath = join(cockpitVideosDir, key)
    await fs.unlink(filePath)
  },
  async clear(): Promise<void> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    throw new Error(
      `Clear functionality is not available in the filesystem storage, so we don't risk losing important data. If you
        want to clear the video storage, please delete the "videos" folder inside the Cockpit folder in your user data
        directory manually.`
    )
  },
  async keys(): Promise<string[]> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    const dirPath = cockpitVideosDir
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  },
  async iterate(callback: (value: unknown, key: string, iterationNumber: number) => void): Promise<void> {
    if (!isElectron()) throw new Error(filesystemOnlyInElectronErrorMsg)
    const keys = await this.keys()
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = await this.getItem(key)
      callback(value, key, i)
    }
  },
}
