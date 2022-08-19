import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'

import type {
  Layer,
  Point2D,
  SizeRect2D,
  Widget,
  WidgetType,
} from '@/types/general'

const widgetFromHash = (layers: Layer[], hash: string): Widget => {
  for (const layer of layers) {
    for (const widget of layer.widgets) {
      if (widget.hash === hash) {
        return widget
      }
    }
  }
  throw new Error(`No widget found with hash ${hash}`)
}

const layerFromHash = (layers: Layer[], hash: string): Layer => {
  const layer = layers.find((l: Layer) => l.hash === hash)
  if (layer === undefined) {
    throw new Error(`No layer found with hash ${hash}`)
  }
  return layer
}

const layerFromWidgetHash = (layers: Layer[], hash: string): Layer => {
  for (const layer of layers) {
    for (const widget of layer.widgets) {
      if (widget.hash === hash) {
        return layer
      }
    }
  }
  throw new Error(`Widget with hash ${hash} not found in any layer.`)
}

export const useWidgetManagerStore = defineStore({
  id: 'widget-manager',
  state: () => ({
    layers: useStorage('cockpit-widget-layers', [] as Layer[]),
  }),
  getters: {
    availableLayers: (state) => {
      return state.layers.slice().map((layer) => {
        return {
          title: layer.hash,
          value: layer,
        }
      })
    },
  },
  actions: {
    deleteLayer(hash: string) {
      const layer = layerFromHash(this.layers, hash)
      const index = this.layers.indexOf(layer)
      this.layers.splice(index, 1)
    },
    deleteWidget(hash: string) {
      const widget = widgetFromHash(this.layers, hash)
      const layer = layerFromWidgetHash(this.layers, hash)
      const index = layer.widgets.indexOf(widget)
      layer.widgets.splice(index, 1)
    },
    updatePosition(hash: string, position: Point2D) {
      const widget = widgetFromHash(this.layers, hash)
      widget.position = position
    },
    updateSize(hash: string, size: SizeRect2D) {
      const widget = widgetFromHash(this.layers, hash)
      widget.size = size
    },
    bringWidgetFront(hash: string) {
      const widget = widgetFromHash(this.layers, hash)
      const layer = layerFromWidgetHash(this.layers, hash)
      const index = layer.widgets.indexOf(widget)
      layer.widgets.splice(index, 1)
      layer.widgets.unshift(widget)
    },
    sendWidgetBack(hash: string) {
      const widget = widgetFromHash(this.layers, hash)
      const layer = layerFromWidgetHash(this.layers, hash)
      const index = layer.widgets.indexOf(widget)
      layer.widgets.splice(index, 1)
      layer.widgets.push(widget)
    },
    addLayer() {
      this.layers.unshift({ hash: uuid4(), widgets: [] })
    },
    addWidget(widgetType: WidgetType, layerHash: string) {
      const layer = layerFromHash(this.layers, layerHash)
      layer.widgets.unshift({
        hash: uuid4(),
        component: widgetType,
        position: { x: 10, y: 10 },
        size: { width: 200, height: 200 },
      })
    },
  },
})
