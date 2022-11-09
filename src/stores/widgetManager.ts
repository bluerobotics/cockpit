import '@/libs/cosmos'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'

import { widgetProfile, widgetProfiles } from '@/assets/defaults'
import * as Words from '@/libs/funny-name/words'
import type { Point2D, SizeRect2D } from '@/types/general'
import type { Layer, Profile, Widget, WidgetType } from '@/types/widgets'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const currentProfile = useStorage('cockpit-current-profile', widgetProfile)
  const savedProfiles = useStorage('cockpit-saved-profiles', widgetProfiles)

  /**
   * Get layer where given widget is at
   *
   * @returns { Layer }
   * @param { Widget } widget - Widget
   */
  function layerFromWidget(widget: Widget): Layer {
    for (const layer of currentProfile.value.layers) {
      for (const itWidget of layer.widgets) {
        if (itWidget === widget) {
          return layer
        }
      }
    }
    throw new Error(`No layer found for widget with hash ${widget.hash}`)
  }

  /**
   * Adds new profile to the store
   *
   * @param { string } name - Custom name for the profile
   * @param { Layer[] } profileLayers - Layers that define the profile
   * @returns { Profile } The profile object just created
   */
  function saveProfile(name: string, profileLayers: Layer[]): Profile {
    const newProfile = { name: name, layers: profileLayers }
    savedProfiles.value[uuid4()] = newProfile
    return newProfile
  }

  /**
   * Change current profile for given one
   *
   * @param { Profile } profile - Profile to be loaded
   */
  function loadProfile(profile: Profile): void {
    currentProfile.value = profile
  }

  /**
   * Reset current profile to original state
   */
  function resetCurrentProfile(): void {
    currentProfile.value = widgetProfile
  }

  /**
   * Reset saved profiles to original state
   */
  function resetSavedProfiles(): void {
    savedProfiles.value = widgetProfiles
  }

  /**
   * Adds new layer to the store, with a randomly generated hash with UUID4 pattern
   */
  function addLayer(): void {
    currentProfile.value.layers.unshift({
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
    const index = currentProfile.value.layers.indexOf(layer)
    currentProfile.value.layers.splice(index, 1)
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
      position: { x: 0.4, y: 0.32 },
      size: { width: 0.2, height: 0.36 },
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
    currentProfile,
    savedProfiles,
    loadProfile,
    saveProfile,
    resetCurrentProfile,
    resetSavedProfiles,
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
