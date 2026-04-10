<template>
  <div class="w-full h-full">
    <div
      v-if="widget.options.isCollapsible"
      ref="iframe-container"
      class="w-full h-full rounded-lg overflow-hidden"
      :width="canvasSize.width"
      :height="canvasSize.height"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col justify-between h-full cursor-pointer">
        <div
          class="flex justify-between w-full h-[42px] shrink-0 items-center px-2"
          :class="expandsUpward ? 'order-2' : 'order-1'"
        >
          <div
            class="flex items-center gap-1 flex-1 min-w-0 cursor-grab select-none"
            @mousedown="enableMovingOnDrag"
            @mouseup="disableMovingOnDrag"
          >
            <v-icon class="opacity-40 flex-shrink-0">mdi-drag</v-icon>
            <span class="flex-1 text-center truncate">{{ widget.options.containerName }}</span>
          </div>
          <v-btn
            :icon="collapseToggleIcon"
            variant="text"
            size="36"
            class="opacity-60 flex-shrink-0"
            @click="toggleCollapse"
          />
        </div>
        <div
          v-show="!widget.options.startCollapsed"
          class="flex-1 min-h-0 w-full"
          :class="expandsUpward ? 'order-1' : 'order-2'"
        >
          <iframe
            v-show="iframe_loaded"
            ref="iframe"
            :src="toBeUsedURL"
            :style="collapsibleIframeStyle"
            frameborder="0"
            @load="loadFinished"
          />
        </div>
      </div>
    </div>
    <div v-else>
      <teleport to=".widgets-view">
        <iframe
          v-show="iframe_loaded"
          ref="iframe"
          :src="toBeUsedURL"
          :style="[iframeStyle, { position: 'absolute' }]"
          frameborder="0"
          @load="loadFinished"
        />
      </teleport>
    </div>
    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="600" max-width="45%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Settings</v-card-title>
        <v-card-text>
          <div>
            <p>Iframe Source</p>
            <div class="flex items-center justify-between mt-2 gap-1">
              <v-text-field
                v-model="inputURL"
                variant="outlined"
                :rules="[validateURL(composedURL(inputURL, widget.options.useVehicleAddressAsBase))]"
                :placeholder="widget.options.useVehicleAddressAsBase ? '/my-service' : 'http://example.com'"
                @keydown.enter="updateURL"
              >
                <template v-if="widget.options.useVehicleAddressAsBase" #prepend-inner>
                  <span class="-mr-3 text-base text-gray-400">{{ vehicleBaseUrl }}</span>
                </template>
              </v-text-field>
              <v-btn
                v-tooltip.bottom="'Set'"
                icon="mdi-check"
                class="mx-1 mb-5 bg-[#FFFFFF22]"
                rounded="lg"
                flat
                @click="updateURL"
              />
            </div>
          </div>
          <div class="mt-2 mb-2 w-[95%]">
            <v-slider v-model="transparency" label="Transparency" color="white" :min="0" :max="90" />
          </div>
          <ExpansiblePanel compact :is-expanded="true" no-bottom-divider no-top-divider>
            <template #title>Advanced options</template>
            <template #content>
              <v-switch
                v-model="widget.options.useVehicleAddressAsBase"
                label="Use vehicle address as base URL"
                color="white"
                density="compact"
                hide-details
                class="ml-3 my-2"
                @update:model-value="handleBaseUrlToggle"
              />
              <div class="flex items-center gap-2">
                <v-switch
                  v-model="widget.options.isCollapsible"
                  label="Collapsible"
                  color="white"
                  class="ml-2"
                  hide-details
                />
                <v-select
                  v-if="widget.options.isCollapsible"
                  v-model="widget.options.expandDirection"
                  :items="expandDirectionOptions"
                  item-title="label"
                  item-value="value"
                  label="Expand direction"
                  density="compact"
                  variant="outlined"
                  hide-details
                  theme="dark"
                  class="max-w-[120px] ml-4"
                />
                <v-text-field
                  v-if="widget.options.isCollapsible"
                  v-model="widget.options.containerName"
                  label="Container name"
                  item-title="name"
                  density="compact"
                  variant="outlined"
                  no-data-text="iframe"
                  hide-details
                  theme="dark"
                  class="ml-2"
                />
              </div>
            </template>
          </ExpansiblePanel>
        </v-card-text>
        <v-divider width="80%" inset />
        <v-card-actions class="flex justify-end mt-2">
          <v-btn color="white" @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { defaultBlueOsAddress } from '@/assets/defaults'
import { openSnackbar } from '@/composables/snackbar'
import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { isValidURL } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import ExpansiblePanel from '../ExpansiblePanel.vue'
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()
const iframe = ref()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const { width: windowWidth, height: windowHeight } = useWindowSize()
const collapsedHeaderHeightPx = 42
const expandDirectionOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'Down', value: 'down' },
  { label: 'Up', value: 'up' },
]

/**
 * Returns the widget's persistent internal state, initializing it if absent (e.g. for legacy widgets).
 * @returns {Record<string, any>} The persistent internal state object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getInternalState = (): Record<string, any> => {
  if (!widget.value.persistentInternalState) {
    widget.value.persistentInternalState = {}
  }
  return widget.value.persistentInternalState
}

const iframe_loaded = ref(false)
const transparency = ref(0)
const inputURL = ref(widget.value.options.source)
const vehicleAddressFromDataLake = ref<string>('')
const lastUsedURL = ref<Record<string, string>>({
  usingVehicleAddressAsBase: '',
  notUsingVehicleAddressAsBase: '',
})

const vehicleBaseUrl = computed(() => {
  const protocol = window.location.protocol.includes('file') ? 'http:' : window.location.protocol
  const vehicleAddress = vehicleAddressFromDataLake.value || defaultBlueOsAddress
  return `${protocol}//${vehicleAddress}`
})

const composedURL = (userInputURL: string, useVehicleAddressAsBase: boolean): string => {
  return useVehicleAddressAsBase ? `${vehicleBaseUrl.value}${userInputURL}` : userInputURL
}

const toBeUsedURL = computed(() => {
  return composedURL(widget.value.options.source, widget.value.options.useVehicleAddressAsBase)
})

const enableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, widgetStore.editingMode)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

const lockedExpandDirection = ref<'up' | 'down' | undefined>(undefined)

/**
 * Computes the expand direction from the widget's current position.
 * If the title bar center is below the viewport midpoint, returns 'up'.
 * @returns {'up' | 'down'} The direction based on position
 */
const computeDirectionFromPosition = (): 'up' | 'down' => {
  const collapsedHeightNormalized = collapsedHeaderHeightPx / windowHeight.value
  const titleBarCenter = widget.value.position.y + collapsedHeightNormalized / 2
  return titleBarCenter > 0.5 ? 'up' : 'down'
}

/**
 * The effective expand direction. When the user has chosen a fixed direction, that is used directly.
 * In 'auto' mode, while collapsed the direction is computed from the widget's position (title bar
 * in the bottom half -> up, otherwise down). While expanded, the direction is locked to the value
 * that was computed at expand time so it stays consistent until collapsed again.
 * @returns {'up' | 'down'} The resolved direction
 */
const effectiveExpandDirection = computed((): 'up' | 'down' => {
  const direction = widget.value.options.expandDirection ?? 'auto'
  if (direction !== 'auto') return direction

  if (lockedExpandDirection.value) return lockedExpandDirection.value

  return computeDirectionFromPosition()
})

/**
 * Whether the widget currently expands (or will expand) upward.
 * Used to flip the layout so the title bar stays at the bottom.
 * @returns {boolean} True if expanding upward
 */
const expandsUpward = computed((): boolean => effectiveExpandDirection.value === 'up')

/**
 * Icon for the collapse/expand button, reflecting the direction the content will move.
 * @returns {string} The MDI icon name
 */
const collapseToggleIcon = computed((): string => {
  const isCollapsed = widget.value.options.startCollapsed
  const direction = effectiveExpandDirection.value
  if (isCollapsed) {
    return direction === 'up' ? 'mdi-chevron-up' : 'mdi-chevron-down'
  }
  return direction === 'up' ? 'mdi-chevron-down' : 'mdi-chevron-up'
})

/**
 * Toggles the collapsible container between collapsed and expanded states.
 * Adjusts widget position and size so the container expands in the correct direction.
 */
const toggleCollapse = (): void => {
  const isCurrentlyCollapsed = widget.value.options.startCollapsed
  const collapsedHeightNormalized = collapsedHeaderHeightPx / windowHeight.value
  const direction = effectiveExpandDirection.value

  if (isCurrentlyCollapsed) {
    lockedExpandDirection.value = direction
    const expandedHeight = getInternalState().expandedHeight ?? widget.value.size.height

    if (direction === 'up') {
      const heightDelta = expandedHeight - collapsedHeightNormalized
      widget.value.position.y = Math.max(0, widget.value.position.y - heightDelta)
    }
    widget.value.size.height = expandedHeight
  } else {
    getInternalState().expandedHeight = widget.value.size.height

    if (direction === 'up') {
      const heightDelta = widget.value.size.height - collapsedHeightNormalized
      widget.value.position.y = Math.min(1 - collapsedHeightNormalized, widget.value.position.y + heightDelta)
    }
    widget.value.size.height = collapsedHeightNormalized
    lockedExpandDirection.value = undefined
  }

  widget.value.options.startCollapsed = !isCurrentlyCollapsed
}

const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: widget.value.size.height * windowWidth.value,
}))

const validateURL = (url: string): true | string => {
  return isValidURL(url) ? true : 'URL is not valid.'
}

const updateURL = (): void => {
  const urlValidationResult = validateURL(composedURL(inputURL.value, widget.value.options.useVehicleAddressAsBase))
  if (urlValidationResult !== true) {
    openSnackbar({ message: `${urlValidationResult} Please enter a valid URL.`, variant: 'error' })
    return
  }
  widget.value.options.source = inputURL.value
  openSnackbar({ message: `IFrame URL sucessfully updated to '${toBeUsedURL.value}'.`, variant: 'success' })
}

const handleBaseUrlToggle = (useBaseUrl: boolean): void => {
  // Store the current URL in the history and use the previous one for each case
  if (useBaseUrl) {
    lastUsedURL.value.notUsingVehicleAddressAsBase = inputURL.value
    inputURL.value = lastUsedURL.value.usingVehicleAddressAsBase
  } else {
    lastUsedURL.value.usingVehicleAddressAsBase = inputURL.value
    inputURL.value = lastUsedURL.value.notUsingVehicleAddressAsBase
  }
  updateURL()
}

const apiEventCallback = (event: MessageEvent): void => {
  if (event.data.type !== 'cockpit:listenToDatalakeVariables') {
    return
  }
  const { variable } = event.data
  listenDataLakeVariable(variable, (value) => {
    iframe.value.contentWindow.postMessage({ type: 'cockpit:datalakeVariable', variable, value }, '*')
  })
}

// Watch for changes in vehicle address to reload iframe when necessary
watch(
  [vehicleAddressFromDataLake, () => widget.value.options.useVehicleAddressAsBase],
  () => {
    if (widget.value.options.useVehicleAddressAsBase) {
      // Force iframe reload by setting loaded to false
      iframe_loaded.value = false
      setTimeout(() => {
        iframe_loaded.value = true
      }, 100)
    }
  },
  { deep: true }
)

// Listen to vehicle address changes from data lake
let vehicleAddressListenerId: string | undefined

onBeforeMount((): void => {
  window.addEventListener('message', apiEventCallback, true)

  const defaultOptions = {
    source: 'http://' + defaultBlueOsAddress,
    useVehicleAddressAsBase: false,
    startCollapsed: false,
    containerName: 'iframe',
    expandDirection: 'auto' as 'auto' | 'up' | 'down',
  }
  widget.value.options = { ...defaultOptions, ...widget.value.options }

  if (widget.value.options.isCollapsible && widget.value.options.startCollapsed) {
    if (!getInternalState().expandedHeight) {
      getInternalState().expandedHeight = widget.value.size.height
    }
    widget.value.size.height = collapsedHeaderHeightPx / windowHeight.value
  } else if (widget.value.options.isCollapsible) {
    lockedExpandDirection.value = computeDirectionFromPosition()
  }

  // Get initial vehicle address from data lake
  const vehicleAddressData = getDataLakeVariableData('vehicle-address')
  if (typeof vehicleAddressData === 'string') {
    vehicleAddressFromDataLake.value = vehicleAddressData
  }

  // Listen to vehicle address changes
  vehicleAddressListenerId = listenDataLakeVariable('vehicle-address', (value) => {
    if (typeof value === 'string') {
      vehicleAddressFromDataLake.value = value
    }
  })
})

onBeforeUnmount((): void => {
  window.removeEventListener('message', apiEventCallback, true)
  if (vehicleAddressListenerId) {
    unlistenDataLakeVariable('vehicle-address', vehicleAddressListenerId)
  }
})

const collapsibleIframeStyle = computed<string>(() => {
  let newStyle = ''
  if (widgetStore.editingMode) {
    newStyle = newStyle.concat(' ', 'pointer-events:none; border:0;')
  }
  if (!widgetStore.isWidgetVisible(widget.value)) {
    newStyle = newStyle.concat(' ', 'display: none;')
  }
  return newStyle
})

const iframeStyle = computed<string>(() => {
  let newStyle = ''

  newStyle = newStyle.concat(' ', `left: ${widget.value.position.x * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `top: ${widget.value.position.y * windowHeight.value}px;`)
  newStyle = newStyle.concat(' ', `width: ${widget.value.size.width * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `height: ${widget.value.size.height * windowHeight.value}px;`)

  if (widgetStore.editingMode) {
    newStyle = newStyle.concat(' ', 'pointer-events:none; border:0;')
  }

  if (!widgetStore.isWidgetVisible(widget.value)) {
    newStyle = newStyle.concat(' ', 'display: none;')
  }

  return newStyle
})

const iframeOpacity = computed<number>(() => {
  return (100 - transparency.value) / 100
})

/**
 * Called when iframe finishes loading
 */
function loadFinished(): void {
  console.log('Finished loading')
  iframe_loaded.value = true
}

watch(
  widget,
  () => {
    if (widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen === false) {
      if (validateURL(toBeUsedURL.value) !== true) {
        inputURL.value = widget.value.options.source
      }
    }
  },
  { deep: true }
)
</script>

<style scoped>
iframe {
  width: 100%;
  height: 100%;
  border: none;
  flex-grow: 1;
  margin: 0;
  padding: 0;
  opacity: calc(v-bind('iframeOpacity'));
}
</style>
