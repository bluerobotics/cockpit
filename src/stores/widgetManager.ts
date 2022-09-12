import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'

import * as Words from '@/libs/funny-name/words'
import type { Point2D, SizeRect2D } from '@/types/general'
import type { Layer, Widget, WidgetType } from '@/types/widgets'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const layers = useStorage('cockpit-widget-layers', [] as Layer[])

  /**
   * Get layer where given widget is at
   *
   * @returns { Layer }
   * @param { Widget } widget - Widget
   */
  function layerFromWidget(widget: Widget): Layer {
    for (const layer of layers.value) {
      for (const itWidget of layer.widgets) {
        if (itWidget === widget) {
          return layer
        }
      }
    }
    throw new Error(`No layer found for widget with hash ${widget.hash}`)
  }

  /**
   * Adds new layer to the store, with a randomly generated hash with UUID4 pattern
   */
  function addLayer(): void {
    layers.value.unshift({
      hash: uuid4(),
      name: `Layer ${Words.animalsOcean.random()}`,
      widgets: [],
    })
  }

  /**
   * Deletes a layer from the store
   *
   * @param { Layer } layer - Layer
   */
  function deleteLayer(layer: Layer): void {
    const index = layers.value.indexOf(layer)
    layers.value.splice(index, 1)
  }

  /**
   * Add widget with given type to given layer
   *
   * @param { WidgetType } widgetType - Type of the widget
   * @param { Layer } layer - Layer
   */
  function addWidget(widgetType: WidgetType, layer: Layer): void {
    const widgetHash = uuid4()
    layer.widgets.unshift({
      hash: widgetHash,
      name: widgetHash,
      component: widgetType,
      position: { x: 10, y: 10 },
      size: { width: 200, height: 200 },
      options: {},
    })
  }

  /**
   * Delete widget
   *
   * @param { Widget } widget - Widget
   */
  function deleteWidget(widget: Widget): void {
    const layer = layerFromWidget(widget)
    const index = layer.widgets.indexOf(widget)
    layer.widgets.splice(index, 1)
  }

  /**
   * Updates the position of a given widget
   *
   * @param { Widget } widget - Widget
   * @param { Point2D } position - New desired position for the widget
   */
  function updatePosition(widget: Widget, position: Point2D): void {
    widget.position = position
  }

  /**
   * Updates the size of a given widget
   *
   * @param { Widget } widget - Hash of the widget
   * @param { SizeRect2D } size - New desired size for the widget
   */
  function updateSize(widget: Widget, size: SizeRect2D): void {
    widget.size = size
  }

  /**
   * Send widget to the beggining (front) of the widgets list
   *
   * @param { Widget } widget - Widget
   */
  function bringWidgetFront(widget: Widget): void {
    const layer = layerFromWidget(widget)
    const index = layer.widgets.indexOf(widget)
    layer.widgets.splice(index, 1)
    layer.widgets.unshift(widget)
  }

  /**
   * Send widget to the end (back) of the widgets list
   *
   * @param { Widget } widget - Widget
   */
  function sendWidgetBack(widget: Widget): void {
    const layer = layerFromWidget(widget)
    const index = layer.widgets.indexOf(widget)
    layer.widgets.splice(index, 1)
    layer.widgets.push(widget)
  }

  return {
    layers,
    addLayer,
    deleteLayer,
    addWidget,
    deleteWidget,
    updatePosition,
    updateSize,
    bringWidgetFront,
    sendWidgetBack,
  }
})
