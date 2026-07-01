/**
 * A single event rendered by the console viewer. Any source (system logs, serial streams, etc.) can feed
 * these; `level` is optional so sources without severity levels can be shown without the level column.
 */
export interface ConsoleViewerEvent {
  /** Stable key for virtualized rendering. */
  id: number | string
  /** Time the event occurred (epoch ms). */
  epoch: number
  /** The message to display. */
  msg: string
  /** Optional severity level (enables the level column and filter chips when levels are provided). */
  level?: string
}
