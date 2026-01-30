/**
 * UI utilities for consistent styling across components
 */

/**
 * Connection status type for WebSocket and other connections
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

/**
 * Standard status colors for Vuetify components
 * Used for connection status indicators, stream status, etc.
 */
export const LoadingStatusColors = {
  connected: 'green',
  connecting: 'orange',
  disconnected: 'red',
  unknown: 'grey',
} as const

/**
 * Standard status icons (Material Design Icons)
 */
export const LoadingStatusIcons = {
  connected: 'mdi-check-circle',
  connecting: 'mdi-loading mdi-spin',
  disconnected: 'mdi-close-circle',
  unknown: 'mdi-help-circle',
} as const

/**
 * Get the color for a given connection status
 * @param {string} status The connection status
 * @returns {string} The Vuetify color name
 */
export const getLoadingStatusColor = (status: string): string => {
  return LoadingStatusColors[status as keyof typeof LoadingStatusColors] ?? LoadingStatusColors.unknown
}

/**
 * Get the icon for a given connection status
 * @param {string} status The connection status
 * @returns {string} The Material Design Icon name
 */
export const getLoadingStatusIcon = (status: string): string => {
  return LoadingStatusIcons[status as keyof typeof LoadingStatusIcons] ?? LoadingStatusIcons.unknown
}
