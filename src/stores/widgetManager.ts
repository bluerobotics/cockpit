import '@/libs/cosmos'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'
import { ref } from 'vue'

import { widgetProfile, widgetProfiles } from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import * as Words from '@/libs/funny-name/words'
import type { Layer, Profile, Widget, WidgetType } from '@/types/widgets'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const editingMode = ref(false)
  const currentProfile = useStorage('cockpit-current-profile', widgetProfile)
  const currentMiniWidgetsProfile = useStorage('cockpit-mini-widgets-profile', miniWidgetsProfile)
  const savedProfiles = useStorage('cockpit-saved-profiles', widgetProfiles)

  /**
   * Get layer where given widget is at
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
   * @param { Profile } profile - The profile to be saved
   * @returns { Profile } The profile object just created
   */
  function saveProfile(profile: Profile): Profile {
    const savedProfilesNames = Object.values(savedProfiles.value).map((p: Profile) => p.name)
    let newName = profile.name
    let nameVersion = 0
    // Check if there's already a profile with this name
    while (savedProfilesNames.includes(newName)) {
      // Check if there's already a profile with this name and a versioning
      if (newName.length > 3 && newName.at(-3) === '(' && newName.at(-1) === ')' && !isNaN(Number(newName.at(-2)))) {
        // If so, increase the version number and remove the versioning part, so the new version can be applied
        nameVersion = parseInt(newName.at(-2) as string)
        newName = `${newName.substring(0, newName.length - 3)}`
      }
      newName = `${newName} (${nameVersion + 1})`
    }

    const newProfile = { ...profile, ...{ name: newName } }
    savedProfiles.value[uuid4()] = newProfile
    return newProfile
  }

  /**
   * Change current profile for given one
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
   * @param { Layer } layer - Layer
   */
  function deleteLayer(layer: Layer): void {
    const index = currentProfile.value.layers.indexOf(layer)
    currentProfile.value.layers.splice(index, 1)
  }

  /**
   * Add widget with given type to given layer
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
      managerVars: { timesMounted: 0 },
    })
  }

  /**
   * Delete widget
   * @param { Widget } widget - Widget
   */
  function deleteWidget(widget: Widget): void {
    const layer = layerFromWidget(widget)
    const index = layer.widgets.indexOf(widget)
    layer.widgets.splice(index, 1)
  }

  /**
   * Send widget to the beggining (front) of the widgets list
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
   * @param { Widget } widget - Widget
   */
  function sendWidgetBack(widget: Widget): void {
    const layer = layerFromWidget(widget)
    const index = layer.widgets.indexOf(widget)
    layer.widgets.splice(index, 1)
    layer.widgets.push(widget)
  }

  return {
    editingMode,
    currentProfile,
    currentMiniWidgetsProfile,
    savedProfiles,
    loadProfile,
    saveProfile,
    resetCurrentProfile,
    resetSavedProfiles,
    addLayer,
    deleteLayer,
    addWidget,
    deleteWidget,
    bringWidgetFront,
    sendWidgetBack,
  }
})
