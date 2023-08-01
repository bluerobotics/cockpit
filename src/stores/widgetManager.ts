import '@/libs/cosmos'

import { useDebounceFn, useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeUnmount, ref } from 'vue'

import { widgetProfile, widgetProfiles } from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import * as Words from '@/libs/funny-name/words'
import { CockpitAction, registerActionCallback, unregisterActionCallback } from '@/libs/joystick/protocols'
import { isEqual } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'
import { type Profile, type View, type Widget, type WidgetType, isProfile, isView } from '@/types/widgets'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const editingMode = ref(false)
  const showGrid = ref(true)
  const gridInterval = ref(0.01)
  const currentProfile = useStorage('cockpit-current-profile-v2', widgetProfile)
  const currentMiniWidgetsProfile = useStorage('cockpit-mini-widgets-profile', miniWidgetsProfile)
  const savedProfiles = useStorage('cockpit-saved-profiles-v2', widgetProfiles)
  const currentViewIndex = useStorage('cockpit-current-view-index', 0)

  const currentView = computed<View>({
    get() {
      return currentProfile.value.views[currentViewIndex.value]
    },
    set(newValue) {
      currentProfile.value.views[currentViewIndex.value] = newValue
    },
  })

  const viewsToShow = computed((): View[] => {
    const viewsOnShowOrder = currentProfile.value.views.slice()
    viewsOnShowOrder.splice(currentViewIndex.value, 1)
    viewsOnShowOrder.push(currentProfile.value.views[currentViewIndex.value])
    return viewsOnShowOrder
  })

  /**
   * Get view where given widget is at
   * @returns { View }
   * @param { Widget } widget - Widget
   */
  function viewFromWidget(widget: Widget): View {
    for (const view of currentProfile.value.views) {
      for (const itWidget of view.widgets) {
        if (itWidget === widget) {
          return view
        }
      }
    }
    throw new Error(`No view found for widget with hash ${widget.hash}`)
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
   * Adds new view to the store, with a randomly generated hash with UUID4 pattern
   */
  function addView(): void {
    currentProfile.value.views.unshift({
      hash: uuid4(),
      name: `${Words.animalsOcean.random()} view`,
      widgets: [],
    })
  }

  /**
   * Deletes a view from the store
   * @param { View } view - View
   */
  function deleteView(view: View): void {
    if (currentProfile.value.views.length === 1) {
      Swal.fire({
        icon: 'error',
        text: 'Cannot remove last view. Please create another before deleting this one.',
        timer: 4000,
      })
      return
    }

    const index = currentProfile.value.views.indexOf(view)
    currentProfile.value.views.splice(index, 1)
  }

  /**
   * Rename a view
   * @param { View } view - View
   * @param { string } name - New name of the view
   */
  function renameView(view: View, name: string): void {
    const index = currentProfile.value.views.indexOf(view)
    if (name.length === 0) {
      Swal.fire({ icon: 'error', text: 'View name cannot be blank.', timer: 2000 })
      return
    }
    currentProfile.value.views[index].name = name
  }

  /**
   * Select a view to be used
   * @param { View } view - View
   */
  const selectView = (view: View): void => {
    const index = currentProfile.value.views.indexOf(view)
    currentViewIndex.value = index
  }

  const exportCurrentView = (): void => {
    const blob = new Blob([JSON.stringify(currentView.value)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-widget-view.json`)
  }

  const importView = (e: Event): void => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeView = JSON.parse(contents)
      if (!isView(maybeView)) {
        Swal.fire({ icon: 'error', text: 'Invalid view file.', timer: 3000 })
        return
      }
      currentProfile.value.views.unshift(maybeView)
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  /**
   * Add widget with given type to given view
   * @param { WidgetType } widgetType - Type of the widget
   * @param { View } view - View
   */
  function addWidget(widgetType: WidgetType, view: View): void {
    const widgetHash = uuid4()
    view.widgets.unshift({
      hash: widgetHash,
      name: widgetType,
      component: widgetType,
      position: { x: 0.4, y: 0.32 },
      size: { width: 0.2, height: 0.36 },
      options: {},
      managerVars: {
        timesMounted: 0,
        lastNonMaximizedX: 0.4,
        lastNonMaximizedY: 0.32,
        lastNonMaximizedWidth: 0.2,
        lastNonMaximizedHeight: 0.36,
      },
    })
  }

  /**
   * Delete widget
   * @param { Widget } widget - Widget
   */
  function deleteWidget(widget: Widget): void {
    const view = viewFromWidget(widget)
    const index = view.widgets.indexOf(widget)
    view.widgets.splice(index, 1)
  }

  const fullScreenPosition = { x: 0, y: 0 }
  const fullScreenSize = { width: 1, height: 1 }
  const defaultRestoredPosition: Point2D = { x: 0.15, y: 0.15 }
  const defaultRestoredSize: SizeRect2D = { width: 0.7, height: 0.7 }

  const toggleFullScreen = (widget: Widget): void => {
    if (!isFullScreen(widget)) {
      widget.managerVars.lastNonMaximizedX = widget.position.x
      widget.managerVars.lastNonMaximizedY = widget.position.y
      widget.managerVars.lastNonMaximizedWidth = widget.size.width
      widget.managerVars.lastNonMaximizedHeight = widget.size.height
      widget.position = fullScreenPosition
      widget.size = fullScreenSize
      return
    }

    if (widget.managerVars.lastNonMaximizedX === 0) {
      widget.managerVars.lastNonMaximizedX = defaultRestoredPosition.x
    }
    if (widget.managerVars.lastNonMaximizedY === fullScreenPosition.y) {
      widget.managerVars.lastNonMaximizedY = defaultRestoredPosition.y
    }
    if (widget.managerVars.lastNonMaximizedWidth === fullScreenSize.width) {
      widget.managerVars.lastNonMaximizedWidth = defaultRestoredSize.width
    }
    if (widget.managerVars.lastNonMaximizedHeight === fullScreenSize.height) {
      widget.managerVars.lastNonMaximizedHeight = defaultRestoredSize.height
    }
    widget.position = {
      x: widget.managerVars.lastNonMaximizedX,
      y: widget.managerVars.lastNonMaximizedY,
    }
    widget.size = {
      width: widget.managerVars.lastNonMaximizedWidth,
      height: widget.managerVars.lastNonMaximizedHeight,
    }
  }

  const isFullScreen = (widget: Widget): boolean => {
    return isEqual(widget.position, fullScreenPosition) && isEqual(widget.size, fullScreenSize)
  }

  const selectNextView = (): void => {
    const newIndex = currentViewIndex.value === currentProfile.value.views.length - 1 ? 0 : currentViewIndex.value + 1
    selectView(currentProfile.value.views[newIndex])
  }
  const debouncedSelectNextView = useDebounceFn(() => selectNextView(), 500)
  const selectNextViewCallbackId = registerActionCallback(CockpitAction.GO_TO_NEXT_VIEW, debouncedSelectNextView)
  onBeforeUnmount(() => unregisterActionCallback(selectNextViewCallbackId))

  const selectPreviousView = (): void => {
    const newIndex = currentViewIndex.value === 0 ? currentProfile.value.views.length - 1 : currentViewIndex.value - 1
    selectView(currentProfile.value.views[newIndex])
  }
  const debouncedSelectPreviousView = useDebounceFn(() => selectPreviousView(), 500)
  const selectPrevViewCBId = registerActionCallback(CockpitAction.GO_TO_PREVIOUS_VIEW, debouncedSelectPreviousView)
  onBeforeUnmount(() => unregisterActionCallback(selectPrevViewCBId))

  return {
    editingMode,
    showGrid,
    gridInterval,
    currentProfile,
    currentView,
    viewsToShow,
    currentMiniWidgetsProfile,
    savedProfiles,
    loadProfile,
    saveProfile,
    resetCurrentProfile,
    resetSavedProfiles,
    exportCurrentProfile,
    importProfile,
    addView,
    deleteView,
    renameView,
    selectView,
    exportCurrentView,
    importView,
    addWidget,
    deleteWidget,
    toggleFullScreen,
    isFullScreen,
  }
})
