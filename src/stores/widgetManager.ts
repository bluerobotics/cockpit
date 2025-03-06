import '@/libs/cosmos'

import { useStorage, useWindowSize } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeMount, onBeforeUnmount, Ref, ref, watch } from 'vue'

import {
  defaultCustomWidgetContainers,
  defaultMiniWidgetManagerVars,
  defaultProfileVehicleCorrespondency,
  defaultWidgetManagerVars,
  widgetProfiles,
} from '@/assets/defaults'
import { miniWidgetsProfile } from '@/assets/defaults'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { resetJustMadeKey, useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import * as Words from '@/libs/funny-name/words'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { CurrentlyLoggedVariables } from '@/libs/sensors-logging'
import { isEqual, reloadCockpit, sequentialArray } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'
import {
  type MiniWidget,
  type MiniWidgetContainer,
  type Profile,
  type View,
  type Widget,
  CustomWidgetElement,
  CustomWidgetElementContainer,
  InternalWidgetSetupInfo,
  MiniWidgetManagerVars,
  validateProfile,
  validateView,
  WidgetManagerVars,
  WidgetType,
} from '@/types/widgets'

const { showDialog } = useInteractionDialog()

export const savedProfilesKey = 'cockpit-saved-profiles-v8'

export const useWidgetManagerStore = defineStore('widget-manager', () => {
  const editingMode = ref(false)
  const snapToGrid = ref(true)
  const gridInterval = ref(0.01)
  const currentMiniWidgetsProfile = useBlueOsStorage('cockpit-mini-widgets-profile-v4', miniWidgetsProfile)
  const savedProfiles = useBlueOsStorage<Profile[]>(savedProfilesKey, [])
  const currentViewIndex = useStorage('cockpit-current-view-index', 0)
  const currentProfileIndex = useStorage('cockpit-current-profile-index', 0)
  const desiredTopBarHeightPixels = ref(48)
  const desiredBottomBarHeightPixels = ref(48)
  const visibleAreaMinClearancePixels = ref(20)
  const vehicleTypeProfileCorrespondency = useBlueOsStorage<typeof defaultProfileVehicleCorrespondency>(
    'cockpit-default-vehicle-type-profiles',
    defaultProfileVehicleCorrespondency
  )
  const _widgetManagerVars: Ref<Record<string, WidgetManagerVars>> = ref({})
  const _miniWidgetManagerVars: Ref<Record<string, MiniWidgetManagerVars>> = ref({})
  const isElementsPropsDrawerVisible = ref(false)
  const elementToShowOnDrawer = ref<CustomWidgetElement>()
  const widgetToEdit = ref<Widget>()
  const miniWidgetLastValues = useBlueOsStorage<Record<string, any>>('cockpit-mini-widget-last-values', {})
  const floatingWidgetContainers = ref<MiniWidgetContainer[]>([])
  const currentContextMenu = ref<any | null>(null)

  const editWidgetByHash = (hash: string): Widget | undefined => {
    widgetToEdit.value = currentProfile.value.views
      .flatMap((view) => view.widgets)
      .find((widget) => widget.hash === hash)
    return widgetToEdit.value
  }

  const getElementByHash = (hash: string): CustomWidgetElement | undefined => {
    let customWidgetElement = currentProfile.value.views
      .flatMap((view) => view.widgets)
      .filter((widget) => widget.component === WidgetType.CollapsibleContainer)
      .flatMap((widget) => widget.options.elementContainers)
      .flatMap((container) => container.elements)
      .find((element) => element.hash === hash)

    if (customWidgetElement) {
      return customWidgetElement
    }

    customWidgetElement = currentProfile.value.views
      .flatMap((view) => view.miniWidgetContainers || [])
      .flatMap((container) => container.widgets)
      .find((miniWidget) => miniWidget.hash === hash)

    if (customWidgetElement) {
      return customWidgetElement
    }

    customWidgetElement = currentMiniWidgetsProfile.value.containers
      .flatMap((container) => container.widgets)
      .find((widget) => widget.hash === hash)

    return customWidgetElement
  }

  const showElementPropsDrawer = (customWidgetElementHash: string): void => {
    const customWidgetElement = getElementByHash(customWidgetElementHash)
    if (!customWidgetElement) {
      openSnackbar({ variant: 'error', message: 'Could not find element with the given hash.', duration: 3000 })
      return
    }
    elementToShowOnDrawer.value = customWidgetElement
    isElementsPropsDrawerVisible.value = true
  }

  const removeElementFromCustomWidget = (elementHash: string): void => {
    const customWidgetElement = getElementByHash(elementHash)
    if (!customWidgetElement) {
      throw new Error('Could not find element with the given hash.')
    }

    const customWidget = currentProfile.value.views
      .flatMap((view) => view.widgets)
      .filter((widget) => widget.component === WidgetType.CollapsibleContainer)
      .find((widget) =>
        widget.options.elementContainers.some((container: CustomWidgetElementContainer) =>
          container.elements.includes(customWidgetElement)
        )
      )

    if (!customWidget) {
      throw new Error('Could not find the custom widget containing the element.')
    }

    const customWidgetContainer = customWidget.options.elementContainers.find(
      (container: CustomWidgetElementContainer) => container.elements.includes(customWidgetElement)
    )
    if (!customWidgetContainer) {
      throw new Error('Could not find the container containing the element.')
    }

    customWidgetContainer.elements = customWidgetContainer.elements.filter(
      (element: CustomWidgetElement) => element.hash !== elementHash
    )
  }

  const loadWidgetFromFile = (widgetHash: string, loadedWidget: Widget): void => {
    const currentViewWidgets = currentProfile.value.views[currentViewIndex.value].widgets
    const widgetIndex = currentViewWidgets.findIndex((widget) => widget.hash === widgetHash)

    if (widgetIndex === -1) {
      openSnackbar({ variant: 'error', message: 'Widget not found with the given hash.', duration: 3000 })
      return
    }

    const currentPosition = currentViewWidgets[widgetIndex].position

    reassignHashesToWidget(loadedWidget)

    loadedWidget.position = currentPosition
    currentViewWidgets[widgetIndex] = loadedWidget

    openSnackbar({ variant: 'success', message: 'Widget loaded successfully with new hash.', duration: 3000 })
  }

  const reassignHashesToWidget = (widget: Widget): void => {
    const oldToNewHashMap = new Map<string, string>()

    const oldWidgetHash = widget.hash
    widget.hash = uuid4()
    oldToNewHashMap.set(oldWidgetHash, widget.hash)

    for (const container of widget.options.elementContainers) {
      for (const element of container.elements) {
        reassignHashesToElement(element, oldToNewHashMap)
      }
    }
  }

  const reassignHashesToElement = (element: CustomWidgetElement, hashMap: Map<string, string>): void => {
    const oldHash = element.hash
    element.hash = uuid4()
    hashMap.set(oldHash, element.hash)

    if (element.options && element.options.dataLakeVariable) {
      const dataLakeVariable = element.options.dataLakeVariable
      dataLakeVariable.id = `${dataLakeVariable.id}_new`
      dataLakeVariable.name = `${dataLakeVariable.name}_new`
    }
  }

  /**
   * Updates the options of a custom widget element by its hash.
   * @param {string} elementHash - The unique identifier of the element.
   * @param {Record<string, any>} newOptions - The new options to merge with the existing ones.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateElementOptions = (elementHash: string, newOptions: Record<string, any>): void => {
    const element = getElementByHash(elementHash)
    if (element) {
      element.options = {
        ...element.options,
        ...newOptions,
      }
    }
  }

  const allowMovingAndResizing = (widgetHash: string, forcedState: boolean): void => {
    currentProfile.value.views.forEach((view) => {
      view.widgets.forEach((widget) => {
        if (widget.hash === widgetHash) {
          widgetManagerVars(widgetHash).allowMoving = forcedState
        }
      })
    })
  }

  const widgetManagerVars = (widgetHash: string): WidgetManagerVars => {
    if (!_widgetManagerVars.value[widgetHash]) {
      _widgetManagerVars.value[widgetHash] = { ...defaultWidgetManagerVars }
    }
    return _widgetManagerVars.value[widgetHash]
  }

  const miniWidgetManagerVars = (miniWidgetHash: string): MiniWidgetManagerVars => {
    if (!isRealMiniWidget(miniWidgetHash)) {
      return { ...defaultMiniWidgetManagerVars }
    }
    if (!_miniWidgetManagerVars.value[miniWidgetHash]) {
      _miniWidgetManagerVars.value[miniWidgetHash] = { ...defaultMiniWidgetManagerVars }
    }
    return _miniWidgetManagerVars.value[miniWidgetHash]
  }

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
        showDialog({ variant: 'error', message: 'Could not find profile.', timer: 3000 })
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
    floatingWidgetContainers.value = currentView.value.widgets
      .filter((w) => w.component === WidgetType.MiniWidgetsBar)
      .filter((w) => w.options && w.options.miniWidgetsContainer)
      .map((w) => w.options.miniWidgetsContainer)
    return [...fixedBarContainers, ...viewBarContainers, ...floatingWidgetContainers.value]
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
      showDialog({ message: 'Could not find profile.', variant: 'error', timer: 3000 })
      return
    }
    currentProfileIndex.value = profileIndex
    currentViewIndex.value = 0
  }

  /**
   * Reset saved profiles to original state
   */
  function resetSavedProfiles(): void {
    localStorage.setItem(resetJustMadeKey, 'true')
    savedProfiles.value = widgetProfiles
    currentProfileIndex.value = 0
    currentViewIndex.value = 0
    reloadCockpit(3000)
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
        showDialog({ variant: 'error', message: `Invalid profile file. ${error}` })
        return
      }
      maybeProfile.hash = uuid4()
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
      showDialog({ variant: 'error', message: 'Could not find profile.', timer: 3000 })
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
      showDialog({
        variant: 'error',
        message: 'Cannot remove last view. Please create another before deleting this one.',
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
      showDialog({ variant: 'error', message: 'View name cannot be blank.', timer: 2000 })
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
      showDialog({ variant: 'error', message: 'Cannot select a view that is not visible.', timer: 5000 })
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
        showDialog({ variant: 'error', message: `Invalid view file. ${error}` })
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
   * @param { WidgetType } widget - Type of the widget
   * @param { View } view - View
   */
  function addWidget(widget: InternalWidgetSetupInfo, view: View): void {
    const widgetHash = uuid4()

    const newWidget = {
      hash: widgetHash,
      name: widget.name,
      component: widget.component,
      position: { x: 0.4, y: 0.32 },
      size: { width: 0.2, height: 0.36 },
      options: widget.options,
    }

    if (widget.component === WidgetType.CollapsibleContainer) {
      newWidget.options = {
        elementContainers: defaultCustomWidgetContainers,
        columns: 1,
        leftColumnWidth: 50,
        backgroundOpacity: 0.2,
        backgroundColor: '#FFFFFF',
        backgroundBlur: 25,
      }
    }

    view.widgets.unshift(newWidget)
    Object.assign(widgetManagerVars(newWidget.hash), {
      ...defaultWidgetManagerVars,
      ...{ allowMoving: true },
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
    elementToShowOnDrawer.value = undefined
  }

  /**
   * Delete mini-widget
   * @param { MiniWidget } miniWidget - Mini-widget
   */
  function deleteMiniWidget(miniWidget: MiniWidget): void {
    const container: MiniWidgetContainer | undefined = miniWidgetContainersInCurrentView.value.find((cont) => {
      return cont.widgets.includes(miniWidget)
    })
    const customWidgetContainer = getElementByHash(miniWidget.hash)
    if (container) {
      const index = container.widgets.indexOf(miniWidget)
      container.widgets.splice(index, 1)
      // Remove miniWidget variable from the list of currently logged variables
      CurrentlyLoggedVariables.removeVariable(miniWidget.options.displayName)
      return
    }
    if (customWidgetContainer) {
      removeElementFromCustomWidget(miniWidget.hash)
      CurrentlyLoggedVariables.removeVariable(miniWidget.options.displayName)
      return
    }

    showDialog({ variant: 'error', message: 'Mini-widget container not found.' })
  }

  const customWidgetContainers = computed<MiniWidgetContainer[]>(() =>
    currentProfile.value.views
      .flatMap((view) => view.widgets)
      .filter((widget) => widget.component === WidgetType.CollapsibleContainer)
      .flatMap((widget) => widget.options.elementContainers)
      .map((container) => ({
        name: '',
        widgets: container.elements as unknown as MiniWidget[],
      }))
  )

  /**
   * States whether the given mini-widget is a real mini-widget
   * Fake mini-widgets are those used as placeholders, in the edit-menu, for example
   * @param { string } miniWidgetHash - Hash of the mini-widget
   * @returns { boolean }
   */
  function isRealMiniWidget(miniWidgetHash: string): boolean {
    const allContainers = [
      ...savedProfiles.value.flatMap((profile) => profile.views.flatMap((view) => view.miniWidgetContainers)),
      ...currentMiniWidgetsProfile.value.containers,
      ...floatingWidgetContainers.value,
      ...customWidgetContainers.value,
    ]

    return allContainers.some((container) => container.widgets.some((widget) => widget.hash === miniWidgetHash))
  }

  const fullScreenPosition = { x: 0, y: 0 }
  const fullScreenSize = { width: 1, height: 1 }
  const defaultRestoredPosition: Point2D = { x: 0.15, y: 0.15 }
  const defaultRestoredSize: SizeRect2D = { width: 0.7, height: 0.7 }

  const toggleFullScreen = (widget: Widget): void => {
    if (!isFullScreen(widget)) {
      widgetManagerVars(widget.hash).lastNonMaximizedX = widget.position.x
      widgetManagerVars(widget.hash).lastNonMaximizedY = widget.position.y
      widgetManagerVars(widget.hash).lastNonMaximizedWidth = widget.size.width
      widgetManagerVars(widget.hash).lastNonMaximizedHeight = widget.size.height
      widget.position = fullScreenPosition
      widget.size = fullScreenSize
      return
    }

    if (widgetManagerVars(widget.hash).lastNonMaximizedX === 0) {
      widgetManagerVars(widget.hash).lastNonMaximizedX = defaultRestoredPosition.x
    }
    if (widgetManagerVars(widget.hash).lastNonMaximizedY === fullScreenPosition.y) {
      widgetManagerVars(widget.hash).lastNonMaximizedY = defaultRestoredPosition.y
    }
    if (widgetManagerVars(widget.hash).lastNonMaximizedWidth === fullScreenSize.width) {
      widgetManagerVars(widget.hash).lastNonMaximizedWidth = defaultRestoredSize.width
    }
    if (widgetManagerVars(widget.hash).lastNonMaximizedHeight === fullScreenSize.height) {
      widgetManagerVars(widget.hash).lastNonMaximizedHeight = defaultRestoredSize.height
    }
    widget.position = {
      x: widgetManagerVars(widget.hash).lastNonMaximizedX,
      y: widgetManagerVars(widget.hash).lastNonMaximizedY,
    }
    widget.size = {
      width: widgetManagerVars(widget.hash).lastNonMaximizedWidth,
      height: widgetManagerVars(widget.hash).lastNonMaximizedHeight,
    }
  }

  // If the user does not have it's own profiles yet, create default ones
  if (savedProfiles.value.isEmpty()) {
    widgetProfiles.forEach((profile) => {
      const userProfile = structuredClone(profile)
      userProfile.name = userProfile.name.replace('Default', 'User')
      userProfile.hash = uuid4()
      savedProfiles.value.push(userProfile)
    })
    loadProfile(savedProfiles.value[0])
    reloadCockpit()
  }

  // Make sure the interface is not booting with a profile or view that does not exist
  if (currentProfileIndex.value >= savedProfiles.value.length) currentProfileIndex.value = 0
  if (currentViewIndex.value >= currentProfile.value.views.length) currentViewIndex.value = 0

  const resetWidgetsEditingState = (forcedState?: boolean): void => {
    currentProfile.value.views.forEach((view) => {
      view.widgets.forEach((widget) => {
        widgetManagerVars(widget.hash).allowMoving = forcedState === undefined ? editingMode.value : forcedState
      })
    })
  }

  watch(editingMode, () => resetWidgetsEditingState())

  watch(
    savedProfiles,
    () => {
      if (currentProfileIndex.value < savedProfiles.value.length) return
      console.warn('Current profile index is out of bounds. Resetting to 0.')
      currentProfileIndex.value = 0
    },
    { deep: true }
  )

  // Closes the side config panel on view change and edit mode exit
  watch([editingMode, currentViewIndex], ([isInEditMode, newViewIdx], [, oldViewIdx]) => {
    if (!isInEditMode || newViewIdx !== oldViewIdx) {
      elementToShowOnDrawer.value = undefined
    }
  })

  const isFullScreen = (widget: Widget): boolean => {
    return isEqual(widget.position, fullScreenPosition) && isEqual(widget.size, fullScreenSize)
  }

  const selectNextView = (direction: 'forward' | 'backward' = 'forward'): void => {
    const currentViews = currentProfile.value.views
    const indexesOfVisibleViews = sequentialArray(currentViews.length).filter((i) => currentViews[i].visible)

    const numberOfVisibleViews = indexesOfVisibleViews.length
    if (numberOfVisibleViews === 1) {
      openSnackbar({
        variant: 'error',
        message: 'No visible views other the current one.',
        duration: 2500,
      })
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

  const selectNextViewCallbackId = registerActionCallback(availableCockpitActions.go_to_next_view, selectNextView)
  onBeforeUnmount(() => unregisterActionCallback(selectNextViewCallbackId))

  const selectPrevViewCBId = registerActionCallback(availableCockpitActions.go_to_previous_view, selectPreviousView)
  onBeforeUnmount(() => unregisterActionCallback(selectPrevViewCBId))

  // Profile migrations
  // TODO: remove on first stable release
  onBeforeMount(() => {
    if (currentMiniWidgetsProfile.value.containers.length < 3) {
      currentMiniWidgetsProfile.value = miniWidgetsProfile
    }

    const alreadyUsedProfileHashes: string[] = []
    const alreadyUsedViewHashes: string[] = []
    const alreadyUsedWidgetHashes: string[] = []
    const alreadyUsedMiniWidgetHashes: string[] = []
    savedProfiles.value.forEach((p) => {
      if (alreadyUsedProfileHashes.includes(p.hash)) {
        const newHash = uuid4()
        p.hash = newHash
      }
      alreadyUsedProfileHashes.push(p.hash)

      p.views.forEach((v) => {
        v.showBottomBarOnBoot = v.showBottomBarOnBoot ?? true
        v.visible = v.visible ?? true

        if (alreadyUsedViewHashes.includes(v.hash)) {
          const newHash = uuid4()
          v.hash = newHash
        }
        alreadyUsedViewHashes.push(v.hash)

        v.widgets.forEach((w) => {
          if (alreadyUsedWidgetHashes.includes(w.hash)) {
            const newHash = uuid4()
            w.hash = newHash
          }
          alreadyUsedWidgetHashes.push(w.hash)
        })

        v.miniWidgetContainers.forEach((c) => {
          c.widgets.forEach((w) => {
            if (alreadyUsedMiniWidgetHashes.includes(w.hash)) {
              const newHash = uuid4()
              w.hash = newHash
            }
            alreadyUsedMiniWidgetHashes.push(w.hash)
          })
        })
      })
    })

    currentMiniWidgetsProfile.value.containers.forEach((c) => {
      c.widgets.forEach((w) => {
        if (alreadyUsedMiniWidgetHashes.includes(w.hash)) {
          const newHash = uuid4()
          w.hash = newHash
        }
        alreadyUsedMiniWidgetHashes.push(w.hash)
      })
    })
  })

  const setMiniWidgetLastValue = (miniWidgetHash: string, lastValue: any): void => {
    miniWidgetLastValues.value[miniWidgetHash] = structuredClone(lastValue)
  }

  const getMiniWidgetLastValue = (miniWidgetHash: string): any => {
    const lastValue = miniWidgetLastValues.value[miniWidgetHash]
    return lastValue === undefined ? undefined : structuredClone(lastValue)
  }

  // Reassign hashes to profiles using old ones - TODO: Remove for 1.0.0 release
  Object.values(savedProfiles.value).forEach((profile) => {
    // If the profile is a correspondent of a cockpit default one, use the correspondent hash
    const corrDefault = widgetProfiles.find((defProfile) => defProfile.name === profile.name)
    profile.hash = corrDefault?.hash ?? profile.hash
  })

  const copyWidgetToView = (widget: Widget, viewName: string): void => {
    const targetView = currentProfile.value.views.find((view) => view.name === viewName)
    if (!targetView) {
      throw new Error(`View with name "${viewName}" not found.`)
    }
    const newWidget = JSON.parse(JSON.stringify(widget))
    newWidget.hash = uuid4()
    targetView.widgets.unshift(newWidget)
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
    allowMovingAndResizing,
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
    toggleFullScreen,
    isFullScreen,
    loadDefaultProfileForVehicle,
    isWidgetVisible,
    widgetClearanceForVisibleArea,
    isRealMiniWidget,
    widgetManagerVars,
    miniWidgetManagerVars,
    desiredTopBarHeightPixels,
    desiredBottomBarHeightPixels,
    visibleAreaMinClearancePixels,
    currentTopBarHeightPixels,
    currentBottomBarHeightPixels,
    showElementPropsDrawer,
    isElementsPropsDrawerVisible,
    elementToShowOnDrawer,
    updateElementOptions,
    removeElementFromCustomWidget,
    loadWidgetFromFile,
    widgetToEdit,
    editWidgetByHash,
    setMiniWidgetLastValue,
    getMiniWidgetLastValue,
    copyWidgetToView,
    currentContextMenu,
  }
})
