import '@/libs/cosmos'

import { useDebounceFn, useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'

import { widgetProfiles } from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from '@/libs/blueos'
import * as Words from '@/libs/funny-name/words'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { isEqual } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'
import type { MiniWidget, MiniWidgetContainer } from '@/types/miniWidgets'
import { type Profile, type View, type Widget, isProfile, isView, WidgetType } from '@/types/widgets'

import { useMainVehicleStore } from './mainVehicle'

const savedProfilesKey = 'cockpit-saved-profiles-v8'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const vehicleStore = useMainVehicleStore()
  const editingMode = ref(false)
  const showGrid = ref(true)
  const gridInterval = ref(0.01)
  const currentMiniWidgetsProfile = useStorage('cockpit-mini-widgets-profile-v4', miniWidgetsProfile)
  const savedProfiles = useStorage<Profile[]>(savedProfilesKey, [])
  const currentViewIndex = useStorage('cockpit-current-view-index', 0)
  const currentProfileIndex = useStorage('cockpit-current-profile-index', 0)

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
    return viewsOnShowOrder
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
      if (!isProfile(maybeProfile)) {
        Swal.fire({ icon: 'error', text: 'Invalid profile file.', timer: 3000 })
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
    if (!Array.isArray(newProfiles) || !newProfiles.every((profile) => isProfile(profile))) {
      Swal.fire({ icon: 'error', text: 'Could not import profiles from vehicle. Invalid data.', timer: 3000 })
      return
    }
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
      if (!isView(maybeView)) {
        Swal.fire({ icon: 'error', text: 'Invalid view file.', timer: 3000 })
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
      managerVars: {
        timesMounted: 0,
        configMenuOpen: false,
        allowMoving: true,
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
    importProfilesFromVehicle()
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

  const selectNextView = (): void => {
    const newIndex = currentViewIndex.value === currentProfile.value.views.length - 1 ? 0 : currentViewIndex.value + 1
    selectView(currentProfile.value.views[newIndex])
  }
  const debouncedSelectNextView = useDebounceFn(() => selectNextView(), 10)
  const selectNextViewCallbackId = registerActionCallback(
    availableCockpitActions.go_to_next_view,
    debouncedSelectNextView
  )
  onBeforeUnmount(() => unregisterActionCallback(selectNextViewCallbackId))

  const selectPreviousView = (): void => {
    const newIndex = currentViewIndex.value === 0 ? currentProfile.value.views.length - 1 : currentViewIndex.value - 1
    selectView(currentProfile.value.views[newIndex])
  }
  const debouncedSelectPreviousView = useDebounceFn(() => selectPreviousView(), 10)
  const selectPrevViewCBId = registerActionCallback(
    availableCockpitActions.go_to_previous_view,
    debouncedSelectPreviousView
  )
  onBeforeUnmount(() => unregisterActionCallback(selectPrevViewCBId))

  // Profile migrations
  // TODO: remove on first stable release
  onBeforeMount(() => {
    savedProfiles.value.forEach((p) =>
      p.views.forEach((v) => {
        v.showBottomBarOnBoot = v.showBottomBarOnBoot ?? true
        v.visible = v.visible ?? true
      })
    )
  })

  return {
    editingMode,
    showGrid,
    gridInterval,
    currentProfile,
    currentView,
    viewsToShow,
    miniWidgetContainersInCurrentView,
    currentMiniWidgetsProfile,
    savedProfiles,
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
    isWidgetVisible,
  }
})
