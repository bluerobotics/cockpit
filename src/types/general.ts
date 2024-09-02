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
