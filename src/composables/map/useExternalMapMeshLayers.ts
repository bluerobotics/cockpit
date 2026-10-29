import type { Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { watch } from 'vue'

import { useExternalMapMeshes } from '@/composables/map/useExternalMapMeshes'
import { openSnackbar } from '@/composables/snackbar'
import type { MapMesh } from '@/libs/map/external-map-meshes'
import { mapMeshGlRenderer } from '@/libs/map/external-map-meshes-gl'
import { ExternalMapMeshesLayer } from '@/libs/map/external-map-meshes-layer'

const MESH_PANE = 'externalMeshPane'

// Shared by every map, so a mesh that cannot be drawn is reported once rather than once per map and redraw.
const reportedUndrawableMeshes = new Set<string>()
const reportUndrawableMesh = (mesh: MapMesh): void => {
  if (reportedUndrawableMeshes.has(mesh.id)) return
  reportedUndrawableMeshes.add(mesh.id)
  const problem = t`this browser or graphics driver does not support WebGL2. Try enabling hardware acceleration.`
  const message = t`Cannot draw the map mesh "${mesh.name}": ${problem}`
  openSnackbar({ message, variant: 'error' })
}

/**
 * Return type of {@link useExternalMapMeshLayers}.
 */
export interface UseExternalMapMeshLayersReturn {
  /**
   * Draws the received meshes on a Leaflet map, while `isShown` says the map is.
   */
  init: (map: LeafletMap, isShown?: () => boolean) => void
  /**
   * Removes the meshes from the map.
   */
  destroy: () => void
}

/**
 * Draws the map meshes received from external software on a single Leaflet map. Shared by the dashboard Map
 * widget, the MiniMap and the Mission Planning view.
 * @returns {UseExternalMapMeshLayersReturn} Methods to bind and tear down the meshes on a map.
 */
export const useExternalMapMeshLayers = (): UseExternalMapMeshLayersReturn => {
  const { meshes } = useExternalMapMeshes()

  let meshLayer: ExternalMapMeshesLayer | undefined
  let mapRef: LeafletMap | undefined
  let stopWatchingShown: (() => void) | undefined

  const init = (map: LeafletMap, isShown = (): boolean => true): void => {
    stopWatchingShown?.()
    mapRef = map
    // Above the GeoTIFF overlays (250), and below the mission and vehicle layers.
    if (!map.getPane(MESH_PANE)) map.createPane(MESH_PANE).style.zIndex = '255'
    const layer = new ExternalMapMeshesLayer({
      store: meshes,
      renderer: () => mapMeshGlRenderer(meshes),
      onUnsupported: reportUndrawableMesh,
      pane: MESH_PANE,
    })
    meshLayer = layer
    stopWatchingShown = watch(isShown, (shown) => layer.setShown(shown), { immediate: true })
    map.addLayer(layer)
  }

  const destroy = (): void => {
    stopWatchingShown?.()
    stopWatchingShown = undefined
    if (meshLayer) mapRef?.removeLayer(meshLayer)
    meshLayer = undefined
    mapRef = undefined
  }

  return { init, destroy }
}
