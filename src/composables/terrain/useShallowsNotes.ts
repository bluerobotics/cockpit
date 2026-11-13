import { t } from 'ttag'
import { type Ref, ref } from 'vue'

import { type ShallowsNote, fetchShallowsNotes } from '@/libs/terrain/shallows-osm'
import type { GeoBbox } from '@/types/general'

/**
 * What OpenStreetMap charts around a stretch of possibly shallow water, read on demand.
 */
export interface UseShallowsNotesReturn {
  /**
   * What is charted there, null until read.
   */
  notes: Ref<ShallowsNote[] | null>
  /**
   * Whether it is being read.
   */
  loading: Ref<boolean>
  /**
   * Why reading it failed, when it did.
   */
  error: Ref<string | null>
  /**
   * Reads it, unless it is already read or being read.
   */
  load: () => Promise<void>
}

// The same stretch shown again after a re-check, or by the next marker that covers it, is read once. Reads
// are shared, so none is cancelled with the marker that started it; the Overpass client has its own deadline.
// ponytail: answers are kept for the session, one small list per stretch opened; an LRU cap is the upgrade.
const requests = new Map<string, Promise<ShallowsNote[]>>()
const uncancelled = new AbortController().signal

const bboxKey = ({ south, west, north, east }: GeoBbox): string =>
  [south, west, north, east].map((value) => value.toFixed(4)).join(',')

/**
 * Reads what OpenStreetMap charts around a stretch of possibly shallow water, the first time it is asked.
 * @param {() => GeoBbox} bbox Area around the stretch.
 * @returns {UseShallowsNotesReturn} The notes and their loading state.
 */
export const useShallowsNotes = (bbox: () => GeoBbox): UseShallowsNotesReturn => {
  const notes = ref<ShallowsNote[] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    if (notes.value || loading.value) return
    const area = bbox()
    const key = bboxKey(area)
    let request = requests.get(key)
    if (!request) {
      request = fetchShallowsNotes(area, uncancelled)
      requests.set(key, request)
    }
    loading.value = true
    error.value = null
    try {
      notes.value = await request
    } catch (reason) {
      // A failed read is not kept, so the next open tries again.
      requests.delete(key)
      const message = (reason as Error)?.message ?? reason
      error.value = t`Could not read OpenStreetMap: ${message}`
    } finally {
      loading.value = false
    }
  }

  return { notes, loading, error, load }
}
