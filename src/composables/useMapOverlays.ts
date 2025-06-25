import L from 'leaflet'
import { ref, type Ref } from 'vue'

interface Overlay {
  id: string
  title: string
  description: string
  url: string
}

export function useMapOverlays(map: Ref<L.Map | undefined>, layerControl: Ref<L.Control.Layers | undefined>) {
  const mapBounds = ref<L.LatLngBounds>()
  const dynamicOverlays = ref<Record<string, L.Layer>>({})
  const overlaysInView = ref<Overlay[]>([])
  const lastFetchTime = ref(0)

  const updateOverlays = (): void => {
    if (!map.value || !layerControl.value) return

    // Keep track of current overlay IDs
    const currentOverlayIds = new Set(Object.keys(dynamicOverlays.value))
    const newOverlayIds = new Set(overlaysInView.value.map((o) => o.id.toString()))

    // Remove overlays that are no longer in view
    currentOverlayIds.forEach((id) => {
      if (!newOverlayIds.has(id)) {
        const layer = dynamicOverlays.value[id]
        map.value?.removeLayer(layer)
        layerControl.value?.removeLayer(layer)
        delete dynamicOverlays.value[id]
      }
    })

    // Add new overlays
    overlaysInView.value.forEach((overlay) => {
      const id = overlay.id.toString()
      // Skip if we already have this overlay
      if (currentOverlayIds.has(id)) return

      const tileLayer = L.tileLayer(overlay.url, {
        maxZoom: 22,
        minZoom: 1,
        tileSize: 256,
        attribution: `© ${overlay.title}`,
      })

      // Add to map first (will be underneath existing layers)
      tileLayer.addTo(map.value!)
      // Then add to control
      layerControl.value?.addOverlay(tileLayer, overlay.title)
      dynamicOverlays.value[id] = tileLayer
    })
  }

  const fetchAndUpdateOverlays = async (): Promise<void> => {
    if (!mapBounds.value) return

    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTime.value

    if (timeSinceLastFetch < 1000) return

    const bounds = mapBounds.value
    const url = `https://map.galvanicloop.com/api/images/bounds/?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}`

    try {
      lastFetchTime.value = now
      const response = await fetch(url)
      const data = await response.json()
      overlaysInView.value = data.map((overlay: any) => ({
        id: overlay.id,
        title: overlay.title,
        description: overlay.description,
        url: `https://map.galvanicloop.com/api/images/${overlay.id}/tiles/{z}/{x}/{y}.png`,
      }))
      updateOverlays()
    } catch (error) {
      console.error('Failed to fetch overlays:', error)
    }
  }

  const setupMapOverlays = (leafletMap: L.Map): void => {
    // Create a custom pane for seamarks with highest z-index
    leafletMap.createPane('seamarks')
    const seamarksPane = leafletMap.getPane('seamarks')
    if (seamarksPane) {
      seamarksPane.style.zIndex = '650' // Above other overlays (default overlay pane is 400)
    }

    // Set up map event handlers for overlay updates
    leafletMap.on('moveend', () => {
      mapBounds.value = leafletMap.getBounds()
      fetchAndUpdateOverlays()
    })

    leafletMap.on('zoomend', () => {
      mapBounds.value = leafletMap.getBounds()
      fetchAndUpdateOverlays()
    })
  }

  return {
    setupMapOverlays,
    mapBounds,
    dynamicOverlays,
    overlaysInView,
  }
} 