import type { HazardArea, HazardGridSourceId, TerrainGrid } from '@/types/hazards'
import type { TerrainTraceRequest, TerrainTraceResponse } from '@/workers/terrain-trace.worker'
// @ts-ignore: Worker imports
import TerrainTraceWorker from '@/workers/terrain-trace.worker?worker'

// One worker for the whole application, created on the first trace and kept: the grid each request
// carries is the expensive part, not the worker.
let worker: Worker | undefined
let nextRequestId = 0
const pendingRequests = new Map<string, (answer: TerrainTraceResponse) => void>()

const ensureWorker = (): Worker => {
  if (worker) return worker
  worker = new TerrainTraceWorker() as Worker
  worker.onmessage = (event: MessageEvent<TerrainTraceResponse>) => {
    pendingRequests.get(event.data.id)?.(event.data)
    pendingRequests.delete(event.data.id)
  }
  // A worker that fails to start answers nothing, so without this every trace waiting on it stays
  // pending forever. It never recovers either, so the next trace builds a new one.
  worker.onerror = (event: ErrorEvent) => {
    const error = event.message || 'The elevation tracer could not be started.'
    pendingRequests.forEach((settle, id) => settle({ id, error }))
    pendingRequests.clear()
    worker = undefined
  }
  return worker
}

/**
 * Traces one band of an elevation grid into closed areas, off the interface thread: ground above
 * `thresholdM` for `terrain`, water no deeper than it for `shallow-water`. A full grid is about a
 * million samples and takes seconds, which on the interface thread froze everything for as long.
 * @param {HazardGridSourceId} sourceId Band to trace.
 * @param {TerrainGrid} grid Sampled elevation grid.
 * @param {number} thresholdM Elevation or depth the band is bounded by, in meters.
 * @returns {Promise<HazardArea[]>} The traced areas, empty when the band marks nothing.
 */
export const traceGridAreas = (
  sourceId: HazardGridSourceId,
  grid: TerrainGrid,
  thresholdM: number
): Promise<HazardArea[]> => {
  const request: TerrainTraceRequest = { id: String(nextRequestId++), sourceId, grid, thresholdM }
  return new Promise<HazardArea[]>((resolve, reject) => {
    pendingRequests.set(request.id, (answer) => {
      if (answer.areas) resolve(answer.areas)
      else reject(new Error(answer.error ?? 'The elevation grid could not be traced.'))
    })
    ensureWorker().postMessage(request)
  })
}
