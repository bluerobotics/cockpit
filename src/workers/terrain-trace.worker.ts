import { shallowWaterAreas, terrainAreasAbove } from '@/libs/hazards/terrain-areas'
import type { HazardArea, HazardGridSourceId, TerrainGrid } from '@/types/hazards'

/**
 * Request to trace one band of an elevation grid into closed areas.
 */
export interface TerrainTraceRequest {
  /**
   * Caller-chosen id, echoed back so concurrent requests can be told apart.
   */
  id: string
  /**
   * Which band to trace: ground above the threshold, or water no deeper than it.
   */
  sourceId: HazardGridSourceId
  /**
   * Sampled elevation grid to trace.
   */
  grid: TerrainGrid
  /**
   * Elevation above which ground is marked, or depth down to which water is, in meters.
   */
  thresholdM: number
}

/**
 * Answer to a trace request: either the traced areas or why they could not be produced.
 */
export interface TerrainTraceResponse {
  /**
   * Id of the request this answers.
   */
  id: string
  /**
   * The traced areas, when the trace succeeded. Empty when the band marks nothing.
   */
  areas?: HazardArea[]
  /**
   * Why the grid could not be traced, when it could not.
   */
  error?: string
}

/**
 * The bits of the worker's own global scope this file uses. Spelled out because the project is
 * typed against the DOM library, where the ambient `postMessage` is the window's.
 */
interface TerrainTraceWorkerScope {
  /**
   * Handler invoked with each trace request from the main thread.
   */
  onmessage: ((event: MessageEvent<TerrainTraceRequest>) => void) | null
  /**
   * Sends an answer back.
   */
  postMessage: (message: TerrainTraceResponse) => void
}

const scope = self as unknown as TerrainTraceWorkerScope

// The trace's own development self-check calls the global `assert` that application bootstrap
// installs, which never ran here.
const globals = globalThis as unknown as Record<string, unknown>
globals.assert ??= (result: boolean, message?: string): void => {
  if (!result) throw new Error(message ?? 'Assert failed')
}

// Tracing a full grid runs isobands over a million samples and takes seconds, which is the whole
// reason it happens here: on the interface thread it froze the map, the panel and the video.
scope.onmessage = (event: MessageEvent<TerrainTraceRequest>): void => {
  const { id, sourceId, grid, thresholdM } = event.data
  try {
    const areas = sourceId === 'terrain' ? terrainAreasAbove(grid, thresholdM) : shallowWaterAreas(grid, thresholdM)
    scope.postMessage({ id, areas })
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
