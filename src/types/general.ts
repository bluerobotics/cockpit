import { DefineComponent } from 'vue'

export type Point2D = {
  /**
   * Horizontal coordinate of the point
   */
  x: number
  /**
   * Vertical coordinate of the point
   */
  y: number
}

export type SizeRect2D = {
  /**
   * Width of the rectangle
   */
  width: number
  /**
   * Height of the rectangle
   */
  height: number
}

/* eslint-disable jsdoc/require-jsdoc */
export interface DialogActions {
  text: string
  action: () => void
  color?: string
  size?: string
  class?: string
  disabled?: boolean
}

export type SubMenuComponent = DefineComponent<Record<string, never>, Record<string, never>, unknown> | null

export interface StorageDB {
  getItem: (key: string) => Promise<Blob | null | undefined>
  setItem: (key: string, value: Blob) => Promise<void>
  removeItem: (key: string) => Promise<void>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
}

export interface ElectronStorageDB {
  /**
   * Set an item in the filesystem storage
   */
  setItem: (key: string, value: Blob, subFolders?: string[]) => Promise<void>
  /**
   * Get an item from the filesystem storage
   */
  getItem: (key: string, subFolders?: string[]) => Promise<Blob | null | undefined>
  /**
   * Remove an item from the filesystem storage
   */
  removeItem: (key: string, subFolders?: string[]) => Promise<void>
  /**
   * Clear the filesystem storage
   */
  clear: (subFolders?: string[]) => Promise<void>
  /**
   * Get all keys from the filesystem storage
   */
  keys: (subFolders?: string[]) => Promise<string[]>
}

/**
 * Return of a validation function
 */
export interface ValidationFunctionReturn {
  /**
   * Whether the input is valid
   */
  isValid: boolean
  /**
   * Error message in case the input is not valid
   */
  error?: string
}

/**
 * Cockpit settings object
 */
export interface Settings {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Config item for Cockpit settings
 */
export interface SettingItem {
  /**
   *
   */
  setting: string
  /**
   *
   */
  originalKey: string
  /**
   *
   */
  changed?: boolean
}
