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

export type ConfigComponent = DefineComponent<Record<string, never>, Record<string, never>, unknown> | null

export interface StorageDB {
  getItem: (key: string) => Promise<Blob | null | undefined>
  setItem: (key: string, value: Blob | ArrayBuffer) => Promise<Blob | void>
  removeItem: (key: string) => Promise<void>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
  iterate: (callback: (value: unknown, key: string, iterationNumber: number) => void) => Promise<void>
}
