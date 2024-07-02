import '@/libs/cosmos'

import { useDebounceFn, useWindowSize } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'

import { defaultProfileVehicleCorrespondency, defaultWidgetManagerVars, widgetProfiles } from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import * as Words from '@/libs/funny-name/words'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { CurrentlyLoggedVariables } from '@/libs/sensors-logging'
import { isEqual, sequentialArray } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'
import type { MiniWidget, MiniWidgetContainer } from '@/types/miniWidgets'
import { type Profile, type View, type Widget, validateProfile, validateView, WidgetType } from '@/types/widgets'

import { useMainVehicleStore } from './mainVehicle'

const savedProfilesKey = 'cockpit-saved-profiles-v8'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const vehicleStore = useMainVehicleStore()
  const editingMode = ref(false)
  const snapToGrid = ref(true)
  const gridInterval = ref(0.01)
  const currentMiniWidgetsProfile = useBlueOsStorage('cockpit-mini-widgets-profile-v4', miniWidgetsProfile)
  const savedProfiles = useBlueOsStorage<Profile[]>(savedProfilesKey, [])
  const currentViewIndex = useBlueOsStorage('cockpit-current-view-index', 0)
  const currentProfileIndex = useBlueOsStorage('cockpit-current-profile-index', 0)
  const desiredTopBarHeightPixels = ref(48)
  const desiredBottomBarHeightPixels = ref(48)
  const visibleAreaMinClearancePixels = ref(20)
  const vehicleTypeProfileCorrespondency = useBlueOsStorage<typeof defaultProfileVehicleCorrespondency>(
    'cockpit-default-vehicle-type-profiles',
    defaultProfileVehicleCorrespondency
  )

  const currentTopBarHeightPixels = computed(() => {
    return desiredTopBarHeightPixels.value
  })

  const currentBottomBarHeightPixels = computed(() => {
    return currentView.value.showBottomBarOnBoot ? desiredBottomBarHeightPixels.value : 0
  })

  const currentView = computed<View>({
    get() {
      return currentProfile.value.views[currentViewIndex.value]
    },
    set(newValue) {
      currentProfile.value.views[currentViewIndex.value] = newValue
    },
  })

  const currentProfile = computed<Profile>({
    get() {
      return savedProfiles.value[currentProfileIndex.value]
    },
    set(newValue) {
      const profilesHashes = savedProfiles.value.map((p) => p.hash)

      if (!profilesHashes.includes(newValue.hash)) {
        Swal.fire({ icon: 'error', text: 'Could not find profile.', timer: 3000 })
        return
      }

      currentViewIndex.value = 0
      const profileIndex = savedProfiles.value.findIndex((p) => p.hash === newValue.hash)
      savedProfiles.value[profileIndex] = newValue
    },
  })

  const viewsToShow = computed((): View[] => {
    const viewsOnShowOrder = currentProfile.value.views.slice()
    viewsOnShowOrder.splice(currentViewIndex.value, 1)
    viewsOnShowOrder.push(currentProfile.value.views[currentViewIndex.value])
    return viewsOnShowOrder.filter((v) => v.visible)
  })

  const miniWidgetContainersInCurrentView = computed(() => {
    const fixedBarContainers = currentMiniWidgetsProfile.value.containers
    const viewBarContainers = currentView.value.miniWidgetContainers
    const floatingWidgetContainers = currentView.value.widgets
      .filter((w) => w.component === WidgetType.MiniWidgetsBar)
      .filter((w) => w.options && w.options.miniWidgetsContainer)
      .map((w) => w.options.miniWidgetsContainer)
    return [...fixedBarContainers, ...viewBarContainers, ...floatingWidgetContainers]
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
   * Gets whether or not the widget is on the active view
   * @returns { boolean }
   * @param { Widget } widget - Widget
   */
  const isWidgetVisible = (widget: Widget): boolean => {
    return document.visibilityState === 'visible' && viewFromWidget(widget).hash === currentView.value.hash
  }

  /**
   * Gets whether or not the widget is on the active view
   * @returns { { top: number, bottom: number } } The top and bottom clearances, in pixels, a widget should add on it's content to ensure they are not under the top/bottom bar.
   * Positive clearances mean the widget is already under the bar, while negative clearances mean the widget is that amount away from the bar.
   * @param { Widget } widget - Widget
   */
  // eslint-disable-next-line jsdoc/require-jsdoc
  const widgetClearanceForVisibleArea = (widget: Widget): { top: number; bottom: number } => {
    const clearances = { top: 0, bottom: 0 }
    const { height: windowHeight } = useWindowSize()

    const widgetTopEdgePixels = windowHeight.value * widget.position.y
    const topBarStartPixels = currentTopBarHeightPixels.value
    clearances.top = widgetTopEdgePixels - topBarStartPixels

    const widgetBottomEdgePixels = windowHeight.value * (widget.position.y + widget.size.height)
    const bottomBarStartPixels = windowHeight.value - currentBottomBarHeightPixels.value
    clearances.bottom = bottomBarStartPixels - widgetBottomEdgePixels

    return clearances
  }

  /**
   * Adds new profile to the store
   * @param { Profile } profile - The profile to be saved
   * @returns { Profile } The profile object just created
   */
  function saveProfile(profile: Profile): Profile {
    const savedProfilesNames = savedProfiles.value.map((p: Profile) => p.name)
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
    savedProfiles.value.push(newProfile)
    return newProfile
  }

  /**
   * Change current profile for given one
   * @param { Profile } profile - Profile to be loaded
   */
  function loadProfile(profile: Profile): void {
    const profileIndex = savedProfiles.value.findIndex((p) => p.hash === profile.hash)
    if (profileIndex === -1) {
      Swal.fire({ icon: 'error', text: 'Could not find profile.', timer: 3000 })
      return
    }
    currentProfileIndex.value = profileIndex
    currentViewIndex.value = 0
  }

  /**
   * Reset saved profiles to original state
   */
  function resetSavedProfiles(): void {
    savedProfiles.value = widgetProfiles
    currentProfileIndex.value = 0
    currentViewIndex.value = 0
    location.reload()
  }

  const exportProfile = (profile: Profile): void => {
    const blob = new Blob([JSON.stringify(profile)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-widget-profile.json`)
  }

  const importProfile = (e: Event): void => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeProfile = JSON.parse(contents)
      try {
        validateProfile(maybeProfile)
      } catch (error) {
        Swal.fire({ icon: 'error', text: `Invalid profile file. ${error}` })
        return
      }
      maybeProfile.hash = uuid4()
      const newProfile = saveProfile(maybeProfile)
      loadProfile(newProfile)
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  const importProfilesFromVehicle = async (): Promise<void> => {
    const newProfiles = await getKeyDataFromCockpitVehicleStorage(vehicleStore.globalAddress, savedProfilesKey)
    if (!Array.isArray(newProfiles)) {
      Swal.fire({ icon: 'error', text: 'Could not import profiles from vehicle. Profiles do not form an array.' })
      return
    }

    newProfiles.every((profile) => {
      try {
        validateProfile(profile)
      } catch (error) {
        Swal.fire({ icon: 'error', text: `Invalid profile file. ${error}` })
        return
      }
    })

    savedProfiles.value = newProfiles
    Swal.fire({ icon: 'success', text: 'Cockpit profiles imported from vehicle.', timer: 3000 })
  }

  const exportProfilesToVehicle = async (): Promise<void> => {
    await setKeyDataOnCockpitVehicleStorage(vehicleStore.globalAddress, savedProfilesKey, savedProfiles.value)
    Swal.fire({ icon: 'success', text: 'Cockpit profiles exported to vehicle.', timer: 3000 })
  }

  /**
   * Adds new view to the store, with a randomly generated hash with UUID4 pattern
   */
  function addView(): void {
    currentProfile.value.views.unshift({
      hash: uuid4(),
      name: `${Words.animalsOcean.random()} view`,
      widgets: [],
      miniWidgetContainers: [
        { name: 'Bottom-left container', widgets: [] },
        { name: 'Bottom-center container', widgets: [] },
        { name: 'Bottom-right container', widgets: [] },
      ],
      showBottomBarOnBoot: true,
      visible: true,
    })
    currentViewIndex.value = 0
  }

  /**
   * Adds new profile to the store
   */
  function addProfile(): void {
    savedProfiles.value.unshift({
      hash: uuid4(),
      name: `${Words.animalsOcean.random()} profile`,
      views: [],
    })
    const profileIndex = savedProfiles.value.findIndex((p) => p.hash === savedProfiles.value[0].hash)
    currentProfileIndex.value = profileIndex
    addView()
  }

  const isUserProfile = (profile: Profile): boolean => {
    return savedProfiles.value.map((p) => p.hash).includes(profile.hash)
  }

  /**
   * Deletes a profile from the store
   * @param { Profile } profile - Profile
   */
  function deleteProfile(profile: Profile): void {
    if (!isUserProfile(profile)) {
      Swal.fire({ icon: 'error', text: 'Could not find profile.', timer: 3000 })
      return
    }

    const currentProfileHash = currentProfile.value.hash
    const savedProfileIndex = savedProfiles.value.findIndex((p) => p.hash === profile.hash)
    currentProfileIndex.value = 0
    savedProfiles.value.splice(savedProfileIndex, 1)
    if (currentProfileHash !== profile.hash) {
      currentProfileIndex.value = savedProfiles.value.findIndex((p) => p.hash === currentProfileHash)
    }
  }

  const duplicateProfile = (profile: Profile): void => {
    savedProfiles.value.unshift({
      hash: uuid4(),
      name: profile.name.concat('+'),
      views: profile.views,
    })
    currentProfileIndex.value = 0
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

    const hashCurrentView = currentView.value.hash
    const index = currentProfile.value.views.indexOf(view)
    currentProfile.value.views.splice(index, 1)
    const newIndexCurrentView = currentProfile.value.views.findIndex((v) => v.hash === hashCurrentView)
    if (newIndexCurrentView === -1 || index === currentViewIndex.value) {
      currentViewIndex.value = 0
      return
    }
    currentViewIndex.value = newIndexCurrentView
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
    if (!view.visible) {
      Swal.fire({ icon: 'error', text: 'Cannot select a view that is not visible.', timer: 5000 })
      return
    }
    const index = currentProfile.value.views.indexOf(view)
    currentViewIndex.value = index
  }

  const duplicateView = (view: View): void => {
    currentProfile.value.views.unshift({
      hash: uuid4(),
      name: view.name.concat('+'),
      widgets: view.widgets,
      miniWidgetContainers: view.miniWidgetContainers,
      showBottomBarOnBoot: view.showBottomBarOnBoot,
      visible: view.visible,
    })
    currentViewIndex.value = 0
  }

  const exportView = (view: View): void => {
    const blob = new Blob([JSON.stringify(view)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-widget-view.json`)
  }

  const importView = (e: Event): void => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeView = JSON.parse(contents)
      try {
        validateView(maybeView)
      } catch (error) {
        Swal.fire({ icon: 'error', text: `Invalid view file. ${error}` })
        return
      }
      maybeView.hash = uuid4()
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
      managerVars: { ...defaultWidgetManagerVars, ...{ allowMoving: true } },
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

  /**
   * Delete mini-widget
   * @param { MiniWidget } miniWidget - Mini-widget
   */
  function deleteMiniWidget(miniWidget: MiniWidget): void {
    const container: MiniWidgetContainer | undefined = miniWidgetContainersInCurrentView.value.find((cont) => {
      return cont.widgets.includes(miniWidget)
    })
    if (container === undefined) {
      Swal.fire({ icon: 'error', text: 'Mini-widget container not found.' })
      return
    }

    const index = container.widgets.indexOf(miniWidget)
    container.widgets.splice(index, 1)

    // Remove miniWidget variable from the list of currently logged variables
    CurrentlyLoggedVariables.removeVariable(miniWidget.options.displayName)
  }

  /**
   * States whether the given mini-widget is a real mini-widget
   * Fake mini-widgets are those used as placeholders, in the edit-menu, for example
   * @param { MiniWidget } miniWidget - Mini-widget
   * @returns { boolean }
   */
  function isRealMiniWidget(miniWidget: MiniWidget): boolean {
    return savedProfiles.value.some((profile) =>
      profile.views.some((view) =>
        view.miniWidgetContainers.some((container) =>
          container.widgets.some((widget) => widget.hash === miniWidget.hash)
        )
      )
    )
  }

  /**
   * Open widget configuration menu
   * @param { Widget } widget - Widget
   */
  const openWidgetConfigMenu = (widget: Widget): void => {
    widget.managerVars.configMenuOpen = true
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

  // If the user does not have it's own profiles yet, try to fetch them from the vehicle, and if it fails, create default ones
  if (savedProfiles.value.isEmpty()) {
    // We use a self invoked await function to avoid moving the entire store to async
    ;(async () => importProfilesFromVehicle())()
    widgetProfiles.forEach((profile) => {
      const userProfile = structuredClone(profile)
      userProfile.name = userProfile.name.replace('Default', 'User')
      userProfile.hash = uuid4()
      savedProfiles.value.push(userProfile)
    })
    loadProfile(savedProfiles.value[0])
    location.reload()
  }

  // Make sure the interface is not booting with a profile or view that does not exist
  if (currentProfileIndex.value >= savedProfiles.value.length) currentProfileIndex.value = 0
  if (currentViewIndex.value >= currentProfile.value.views.length) currentViewIndex.value = 0

  const resetWidgetsEditingState = (forcedState?: boolean): void => {
    currentProfile.value.views.forEach((view) => {
      view.widgets.forEach((widget) => {
        widget.managerVars.allowMoving = forcedState === undefined ? editingMode.value : forcedState
      })
    })
  }

  watch(editingMode, () => resetWidgetsEditingState())
  resetWidgetsEditingState(false)

  const isFullScreen = (widget: Widget): boolean => {
    return isEqual(widget.position, fullScreenPosition) && isEqual(widget.size, fullScreenSize)
  }

  const selectNextView = (direction: 'forward' | 'backward' = 'forward'): void => {
    const currentViews = currentProfile.value.views
    const indexesOfVisibleViews = sequentialArray(currentViews.length).filter((i) => currentViews[i].visible)

    const numberOfVisibleViews = indexesOfVisibleViews.length
    if (numberOfVisibleViews === 1) {
      Swal.fire({ icon: 'error', text: 'No visible views other the current one.', timer: 2500, timerProgressBar: true })
      return
    }

    const increment = direction === 'forward' ? 1 : -1
    let indexOfNewIndex = indexesOfVisibleViews.indexOf(currentViewIndex.value) + increment

    // Rotate indexes if out of bounds
    if (increment === 1 && indexOfNewIndex >= numberOfVisibleViews) {
      indexOfNewIndex = 0
    }
    if (increment === -1 && indexOfNewIndex < 0) {
      indexOfNewIndex = numberOfVisibleViews - 1
    }

    const realIndex = indexesOfVisibleViews[indexOfNewIndex]
    selectView(currentProfile.value.views[realIndex])
  }

  const selectPreviousView = (): void => selectNextView('backward')

  const loadDefaultProfileForVehicle = (vehicleType: MavType): void => {
    // @ts-ignore: We know that the value is a string
    const defaultProfileHash = vehicleTypeProfileCorrespondency.value[vehicleType]
    const defaultProfile = savedProfiles.value.find((profile) => profile.hash === defaultProfileHash)
    if (!defaultProfile) {
      throw new Error('Could not find default mapping for this vehicle.')
    }

    loadProfile(defaultProfile)
  }

  const debouncedSelectNextView = useDebounceFn(() => selectNextView(), 10)
  const selectNextViewCallbackId = registerActionCallback(
    availableCockpitActions.go_to_next_view,
    debouncedSelectNextView
  )
  onBeforeUnmount(() => unregisterActionCallback(selectNextViewCallbackId))

  const debouncedSelectPreviousView = useDebounceFn(() => selectPreviousView(), 10)
  const selectPrevViewCBId = registerActionCallback(
    availableCockpitActions.go_to_previous_view,
    debouncedSelectPreviousView
  )
  onBeforeUnmount(() => unregisterActionCallback(selectPrevViewCBId))

  // Profile migrations
  // TODO: remove on first stable release
  onBeforeMount(() => {
    const alreadyUsedProfileHashes: string[] = []
    savedProfiles.value.forEach((p) => {
      if (alreadyUsedProfileHashes.includes(p.hash)) {
        const newHash = uuid4()
        p.hash = newHash
      }
      alreadyUsedProfileHashes.push(p.hash)

      p.views.forEach((v) => {
        v.showBottomBarOnBoot = v.showBottomBarOnBoot ?? true
        v.visible = v.visible ?? true

        // If there's any configuration menu open, close it
        v.widgets.forEach((w) => {
          w.managerVars.configMenuOpen = false
          w.managerVars.everMounted = true
          // @ts-ignore: This is an old value that we are removing on those that still hold it
          w.managerVars.timesMounted = undefined
        })
        v.miniWidgetContainers.forEach((c) =>
          c.widgets.forEach((w) => {
            w.managerVars.configMenuOpen = false
            w.managerVars.everMounted = true
            // @ts-ignore: This is an old value that we are removing on those that still hold it
            w.managerVars.timesMounted = undefined
          })
        )
      })

      currentMiniWidgetsProfile.value.containers.forEach((c) =>
        c.widgets.forEach((w) => {
          w.managerVars.everMounted = true
          // @ts-ignore: This is an old value that we are removing on those that still hold it
          w.managerVars.timesMounted = undefined
        })
      )
    })
  })

  // Reassign hashes to profiles using old ones - TODO: Remove for 1.0.0 release
  Object.values(savedProfiles.value).forEach((profile) => {
    // If the profile is a correspondent of a cockpit default one, use the correspondent hash
    const corrDefault = widgetProfiles.find((defProfile) => defProfile.name === profile.name)
    profile.hash = corrDefault?.hash ?? profile.hash
  })

  onBeforeMount(() => {
    const filteredProfiles = filterUnconfiguredMiniWidgetsFromProfiles(savedProfiles.value)
    savedProfiles.value = filteredProfiles
  })

  const filterUnconfiguredMiniWidgetsFromProfiles = (profiles: Profile[]): Profile[] => {
    return profiles.map((profile) => ({
      ...profile,
      views: profile.views.map((view) => ({
        ...view,
        miniWidgetContainers: view.miniWidgetContainers.map((container) => ({
          ...container,
          widgets: container.widgets.filter(
            (widget) =>
              widget.component !== 'VeryGenericIndicator' || (widget.options && widget.options.variableName !== '')
          ),
        })),
      })),
    }))
  }

  return {
    editingMode,
    snapToGrid,
    gridInterval,
    currentProfile,
    currentView,
    viewsToShow,
    miniWidgetContainersInCurrentView,
    currentMiniWidgetsProfile,
    savedProfiles,
    vehicleTypeProfileCorrespondency,
    loadProfile,
    saveProfile,
    resetSavedProfiles,
    exportProfile,
    importProfile,
    addProfile,
    deleteProfile,
    duplicateProfile,
    addView,
    deleteView,
    renameView,
    selectView,
    duplicateView,
    exportView,
    importView,
    addWidget,
    deleteWidget,
    deleteMiniWidget,
    openWidgetConfigMenu,
    toggleFullScreen,
    isFullScreen,
    importProfilesFromVehicle,
    exportProfilesToVehicle,
    loadDefaultProfileForVehicle,
    isWidgetVisible,
    widgetClearanceForVisibleArea,
    isRealMiniWidget,
    desiredTopBarHeightPixels,
    desiredBottomBarHeightPixels,
    visibleAreaMinClearancePixels,
    currentTopBarHeightPixels,
    currentBottomBarHeightPixels,
  }
})
