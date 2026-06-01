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
      <div class="flex flex-col justify-between h-full">
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
          ref="contentBox"
          class="relative flex-1 min-h-0 w-full overflow-hidden"
          :class="expandsUpward ? 'order-1' : 'order-2'"
        >
          <iframe
            v-if="urlCheckStatus === 'ok'"
            v-show="iframe_loaded"
            ref="iframe"
            :src="toBeUsedURL"
            :style="collapsibleIframeStyle"
            :class="{ 'widget-dragging-self': widgetDragging }"
            frameborder="0"
            @load="loadFinished"
          />
          <div v-else class="iframe-status-overlay flex flex-col items-center justify-center text-center px-4 gap-2">
            <template v-if="urlCheckStatus === 'waiting'">
              <v-icon size="48" class="opacity-80">mdi-progress-clock</v-icon>
              <p class="text-base font-semibold">{{ waitingTitle }}</p>
              <p class="text-sm opacity-70">
                Trying again in {{ retryCountdownSeconds }}
                {{ retryCountdownSeconds === 1 ? 'second' : 'seconds' }}
              </p>
              <v-progress-linear
                :model-value="retryRemainingPercent"
                color="white"
                height="4"
                rounded
                reverse
                class="!max-w-[60%] mt-2"
              />
            </template>
            <template v-else-if="urlCheckStatus === 'retrying'">
              <v-progress-circular indeterminate color="white" size="48" width="3" />
              <p class="text-base font-semibold">Retrying...</p>
            </template>
            <template v-else>
              <v-progress-circular indeterminate color="white" size="32" width="3" />
            </template>
          </div>
        </div>
      </div>
    </div>
    <div v-else>
      <teleport to=".widgets-view">
        <div class="absolute overflow-hidden" :style="widgetRectStyle">
          <iframe
            v-if="urlCheckStatus === 'ok'"
            v-show="iframe_loaded"
            ref="iframe"
            :src="toBeUsedURL"
            :style="iframeStyle"
            :class="{ 'widget-dragging-self': widgetDragging }"
            frameborder="0"
            @load="loadFinished"
          />
          <div v-else class="iframe-status-overlay flex flex-col items-center justify-center text-center px-4 gap-2">
            <template v-if="urlCheckStatus === 'waiting'">
              <v-icon size="48" class="opacity-80">mdi-progress-clock</v-icon>
              <p class="text-base font-semibold">{{ waitingTitle }}</p>
              <p class="text-sm opacity-70">
                Trying again in {{ retryCountdownSeconds }}
                {{ retryCountdownSeconds === 1 ? 'second' : 'seconds' }}
              </p>
              <v-progress-linear
                :model-value="retryRemainingPercent"
                color="white"
                height="4"
                rounded
                reverse
                class="!max-w-[60%] mt-2"
              />
            </template>
            <template v-else-if="urlCheckStatus === 'retrying'">
              <v-progress-circular indeterminate color="white" size="48" width="3" />
              <p class="text-base font-semibold">Retrying...</p>
            </template>
            <template v-else>
              <v-progress-circular indeterminate color="white" size="32" width="3" />
            </template>
          </div>
        </div>
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
              <div class="ml-3 mt-4 mr-2">
                <v-slider
                  v-model="contentZoomPercent"
                  label="Content zoom"
                  color="white"
                  :min="minContentZoom * 100"
                  :max="maxContentZoom * 100"
                  :step="5"
                  thumb-label
                >
                  <template #append>
                    <span class="text-sm w-[48px] text-right">{{ contentZoomPercent }}%</span>
                  </template>
                </v-slider>
              </div>
              <v-switch
                v-model="widget.options.scaleContentWithWidget"
                label="Scale content when resizing widget"
                color="white"
                density="compact"
                hide-details
                class="ml-3 my-2"
                @update:model-value="handleScaleContentToggle"
              />
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
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, inject, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { defaultBlueOsAddress } from '@/assets/defaults'
import { openSnackbar } from '@/composables/snackbar'
import { widgetDraggingKey, widgetLivePositionKey, widgetLiveSizeKey } from '@/composables/useWidgetGeometry'
import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { isValidURL } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
import { widgetDefaultSizes, WidgetType } from '@/types/widgets'

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
const livePosition = inject(widgetLivePositionKey, null)
const liveSize = inject(widgetLiveSizeKey, null)
const widgetDragging = inject(widgetDraggingKey, null)

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

type UrlCheckStatus = 'checking' | 'ok' | 'waiting' | 'retrying'

const urlCheckTimeoutMs = 10000
const urlCheckRetryDelayMs = 5000
const minRetryingDisplayMs = 1000
const countdownTickMs = 100

const urlCheckStatus = ref<UrlCheckStatus>('checking')
const retryCountdownMs = ref(0)

let countdownIntervalId: ReturnType<typeof setInterval> | undefined

const retryCountdownSeconds = computed(() => Math.ceil(retryCountdownMs.value / 1000))
const retryRemainingPercent = computed(() => (retryCountdownMs.value / urlCheckRetryDelayMs) * 100)
const waitingTitle = computed(() =>
  toBeUsedURL.value.includes('extensionv2') ? 'BlueOS extension not ready yet' : 'Page not ready yet'
)

const clearUrlCheckTimers = (): void => {
  if (countdownIntervalId !== undefined) {
    clearInterval(countdownIntervalId)
    countdownIntervalId = undefined
  }
}

/**
 * Probes a URL with `mode: 'no-cors'` to tell apart "server unreachable" from "server up but
 * CORS blocking the read". A no-cors GET only throws on actual network failures; when the
 * server replies (with any status), it resolves with an opaque response. This lets us decide
 * whether to retry the URL check or just let the iframe load directly.
 * @param {string} url URL to probe.
 * @returns {Promise<boolean>} True if the server responded at all; false on network failure.
 */
const isServerReachable = async (url: string): Promise<boolean> => {
  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(urlCheckTimeoutMs),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Schedules the next URL check after a fixed interval, animating a countdown so the user has
 * clear feedback about when the next attempt will happen.
 */
const startWaitingCountdown = (): void => {
  clearUrlCheckTimers()
  urlCheckStatus.value = 'waiting'
  retryCountdownMs.value = urlCheckRetryDelayMs

  const startTime = Date.now()
  countdownIntervalId = setInterval(() => {
    const remaining = Math.max(0, urlCheckRetryDelayMs - (Date.now() - startTime))
    retryCountdownMs.value = remaining
    if (remaining <= 0) {
      clearUrlCheckTimers()
      checkUrlStatus()
    }
  }, countdownTickMs)
}

/**
 * Pre-fetches the iframe URL to verify the page is reachable before mounting the iframe.
 *
 * On any 4xx/5xx response, or when the server is unreachable (e.g. the vehicle is rebooting),
 * we keep retrying every few seconds and show a "page not ready" overlay with a countdown to
 * the next attempt. CORS failures — detected via a no-cors probe that confirms the server is
 * alive — fall back to 'ok' so arbitrary external URLs still render as before.
 *
 * The 'retrying' state (active fetch on a non-initial attempt) is held for at least
 * `minRetryingDisplayMs` so the user always sees a clear "we are trying" indicator, even
 * when the fetch resolves quickly.
 * @returns {Promise<void>} Resolves once the URL check (and any retry scheduling) is settled.
 */
const checkUrlStatus = async (): Promise<void> => {
  clearUrlCheckTimers()

  const isInitialCheck = urlCheckStatus.value === 'checking'
  if (!isInitialCheck) {
    urlCheckStatus.value = 'retrying'
  }

  const urlAtCheckStart = toBeUsedURL.value
  const startTime = Date.now()

  let outcome: 'ok' | 'retry'
  try {
    const response = await fetch(urlAtCheckStart, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(urlCheckTimeoutMs),
    })
    outcome = response.ok ? 'ok' : 'retry'
  } catch {
    if (toBeUsedURL.value !== urlAtCheckStart) return
    outcome = (await isServerReachable(urlAtCheckStart)) ? 'ok' : 'retry'
  }

  if (!isInitialCheck) {
    const elapsed = Date.now() - startTime
    if (elapsed < minRetryingDisplayMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, minRetryingDisplayMs - elapsed))
    }
  }

  if (toBeUsedURL.value !== urlAtCheckStart) return

  if (outcome === 'ok') {
    urlCheckStatus.value = 'ok'
  } else {
    startWaitingCountdown()
  }
}

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

const minContentZoom = 0.25
const maxContentZoom = 3
// Reference width used when scaling content with the widget.
const referenceWidth = widgetDefaultSizes[WidgetType.IFrame]?.width ?? 0.4

const contentBox = ref<HTMLElement>()
const { width: contentBoxWidth, height: contentBoxHeight } = useElementSize(contentBox)

const clampZoom = (zoom: number): number => Math.min(maxContentZoom, Math.max(minContentZoom, zoom))

const contentZoom = computed<number>(() => clampZoom(widget.value.options.contentZoom ?? 1))

const contentZoomPercent = computed<number>({
  get: () => Math.round(contentZoom.value * 100),
  set: (percent: number) => {
    widget.value.options.contentZoom = clampZoom(percent / 100)
  },
})

/**
 * Effective scale applied to the iframe content. The manual content zoom is the base.
 * @returns {number} The scale factor applied to the iframe.
 */
const effectiveZoom = computed<number>(() => {
  const autoScale = widget.value.options.scaleContentWithWidget ? widget.value.size.width / referenceWidth : 1
  return contentZoom.value * autoScale
})

/**
 * Compensates the manual content zoom when toggling "scale content with widget" so the effective
 * zoom stays continuous across the toggle.
 * @param {boolean | null} enabled The new toggle state.
 */
const handleScaleContentToggle = (enabled: boolean | null): void => {
  const autoScale = widget.value.size.width / referenceWidth
  if (autoScale <= 0) return
  widget.value.options.contentZoom = clampZoom(enabled ? contentZoom.value / autoScale : contentZoom.value * autoScale)
}

/**
 * Builds the CSS that scales the iframe inside the given content-area box.
 * @param {number} areaWidth Content-area width in pixels.
 * @param {number} areaHeight Content-area height in pixels.
 * @returns {string} The CSS declarations positioning and scaling the iframe.
 */
const buildContentStyle = (areaWidth: number, areaHeight: number): string => {
  const zoom = effectiveZoom.value
  const width = areaWidth / zoom
  const height = areaHeight / zoom
  return `position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; transform: scale(${zoom}); transform-origin: top left;`
}

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
    iframe.value?.contentWindow?.postMessage({ type: 'cockpit:datalakeVariable', variable, value }, '*')
  })
}

// Re-run the URL check whenever the composed iframe URL changes (user-edited source, vehicle
// address change, or toggling the "use vehicle address as base" option). The iframe is kept
// hidden until the new URL passes the check and finishes loading.
watch(toBeUsedURL, () => {
  iframe_loaded.value = false
  urlCheckStatus.value = 'checking'
  checkUrlStatus()
})

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
    contentZoom: 1,
    scaleContentWithWidget: true,
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

  checkUrlStatus()
})

onBeforeUnmount((): void => {
  window.removeEventListener('message', apiEventCallback, true)
  if (vehicleAddressListenerId) {
    unlistenDataLakeVariable('vehicle-address', vehicleAddressListenerId)
  }
  clearUrlCheckTimers()
})

const collapsibleIframeStyle = computed<string>(() => {
  let newStyle = buildContentStyle(contentBoxWidth.value, contentBoxHeight.value)
  if (widgetStore.editingMode) {
    newStyle = newStyle.concat(' ', 'pointer-events:none; border:0;')
  }
  if (!widgetStore.isWidgetVisible(widget.value)) {
    newStyle = newStyle.concat(' ', 'display: none;')
  }
  return newStyle
})

// Full widget rect, used to position the teleported content box and its status overlay.
const widgetRectStyle = computed<string>(() => {
  const position = livePosition?.value ?? widget.value.position
  const size = liveSize?.value ?? widget.value.size
  let newStyle = ''
  newStyle = newStyle.concat(' ', `left: ${position.x * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `top: ${position.y * windowHeight.value}px;`)
  newStyle = newStyle.concat(' ', `width: ${size.width * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `height: ${size.height * windowHeight.value}px;`)

  if (widgetStore.editingMode) {
    newStyle = newStyle.concat(' ', 'pointer-events:none; border:0;')
  }
  if (!widgetStore.isWidgetVisible(widget.value)) {
    newStyle = newStyle.concat(' ', 'display: none;')
  }
  return newStyle
})

const iframeStyle = computed<string>(() => {
  const size = liveSize?.value ?? widget.value.size
  return buildContentStyle(size.width * windowWidth.value, size.height * windowHeight.value)
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
  () => widget.value.options,
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

.iframe-status-overlay {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
}
</style>
