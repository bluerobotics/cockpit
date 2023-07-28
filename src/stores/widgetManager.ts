import '@/libs/cosmos'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'
import { computed, ref } from 'vue'

import { widgetProfile, widgetProfiles } from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import * as Words from '@/libs/funny-name/words'
import type { Layer, Profile, Widget, WidgetType } from '@/types/widgets'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const editingMode = ref(false)
  const currentProfile = useStorage('cockpit-current-profile', widgetProfile)
  const currentMiniWidgetsProfile = useStorage('cockpit-mini-widgets-profile', miniWidgetsProfile)
  const savedProfiles = useStorage('cockpit-saved-profiles', widgetProfiles)

  const currentLayer = computed(() => currentProfile.value.layers[0])

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

  const exportCurrentProfile = (): void => {
    const blob = new Blob([JSON.stringify(currentProfile.value)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-widget-profile.json`)
  }

  const importProfile = (e: Event): void => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeProfile = JSON.parse(contents)
      if (!isProfile(maybeProfile)) {
        Swal.fire({ icon: 'error', text: 'Invalid profile file.', timer: 3000 })
        return
      }
      const newProfile = saveProfile(maybeProfile)
      loadProfile(newProfile)
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
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
   * Rename a layer
   * @param { Layer } layer - Layer
   * @param { string } name - New name of the layer
   */
  function renameLayer(layer: Layer, name: string): void {
    const index = currentProfile.value.layers.indexOf(layer)
    currentProfile.value.layers[index].name = name
  }

  /**
   * Select a layer to be used
   * @param { Layer } layer - Layer
   */
  const selectLayer = (layer: Layer): void => {
    const index = currentProfile.value.layers.indexOf(layer)
    currentProfile.value.layers.splice(index, 1)
    currentProfile.value.layers.unshift(layer)
  }

  const exportCurrentLayer = (): void => {
    const blob = new Blob([JSON.stringify(currentLayer.value)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-widget-layer.json`)
  }

  const importLayer = (e: Event): void => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeLayer = JSON.parse(contents)
      if (!isLayer(maybeLayer)) {
        Swal.fire({ icon: 'error', text: 'Invalid layer file.', timer: 3000 })
        return
      }
      currentProfile.value.layers.unshift(maybeLayer)
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
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
    currentLayer,
    currentMiniWidgetsProfile,
    savedProfiles,
    loadProfile,
    saveProfile,
    resetCurrentProfile,
    resetSavedProfiles,
    exportCurrentProfile,
    importProfile,
    addLayer,
    deleteLayer,
    renameLayer,
    selectLayer,
    exportCurrentLayer,
    importLayer,
    addWidget,
    deleteWidget,
    bringWidgetFront,
    sendWidgetBack,
  }
})
