<template>
  <div class="w-full h-full">
    <div
      v-if="widget.options.isCollapsible"
      ref="iframe-container"
      class="w-full rounded-lg overflow-hidden -mt-2"
      :class="[isWrapped ? 'h-[42px]' : 'h-full']"
      :width="canvasSize.width"
      :height="canvasSize.height"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col justify-start items-center h-auto pt-2 cursor-pointer">
        <div class="flex justify-between w-full h-[25px] px-2">
          <v-icon class="cursor-grab opacity-40" @mousedown="enableMovingOnDrag" @mouseup="disableMovingOnDrag">
            mdi-drag
          </v-icon>
          <div class="select-none">
            {{ widget.options.containerName || 'iframe' }}
          </div>
          <v-btn
            :icon="isWrapped ? 'mdi-chevron-down' : 'mdi-chevron-up'"
            variant="text"
            size="36"
            class="mt-[-6px] opacity-60"
            @click="toggleWrapContainer"
          />
        </div>
        <div v-show="!isWrapped" class="pt-2">
          <iframe
            v-show="iframe_loaded"
            ref="iframe"
            :src="widget.options.source"
            :style="iframeStyle"
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
          :src="widget.options.source"
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
            <div class="flex items-center justify-between">
              <v-text-field
                v-model="inputURL"
                variant="filled"
                outlined
                :rules="[validateURL]"
                @keydown.enter="updateURL"
              />
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
              <div class="flex justify-between">
                <v-switch
                  v-model="widget.options.isCollapsible"
                  label="Collapsible container"
                  color="white"
                  class="ml-2"
                />
                <div v-if="widget.options.isCollapsible">
                  <v-text-field
                    v-model="widget.options.containerName"
                    label="Container name"
                    item-title="name"
                    density="compact"
                    variant="outlined"
                    no-data-text="iframe"
                    hide-details
                    theme="dark"
                    class="w-[300px] mt-2"
                  />
                </div>
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
  <Snackbar
    :open-snackbar="openSnackbar"
    :message="snackbarMessage"
    :duration="3000"
    :close-button="false"
    @update:open-snackbar="openSnackbar = $event"
  />
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, defineProps, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { defaultBlueOsAddress } from '@/assets/defaults'
import Snackbar from '@/components/Snackbar.vue'
import { listenDataLakeVariable } from '@/libs/actions/data-lake'
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

const iframe_loaded = ref(false)
const transparency = ref(0)
const inputURL = ref(widget.value.options.source)
const openSnackbar = ref(false)
const snackbarMessage = ref('')
const isWrapped = ref(false)

const toggleWrapContainer = (): void => {
  isWrapped.value = !isWrapped.value
}

const enableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, false)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: widget.value.size.height * windowWidth.value,
}))

const validateURL = (url: string): true | string => {
  return isValidURL(url) ? true : 'URL is not valid.'
}

const updateURL = (): void => {
  const urlValidationResult = validateURL(inputURL.value)
  if (urlValidationResult !== true) {
    snackbarMessage.value = `${urlValidationResult} Please enter a valid URL.`
    openSnackbar.value = true
    return
  }
  widget.value.options.source = inputURL.value
  snackbarMessage.value = `IFrame URL sucessfully updated to '${inputURL.value}'.`
  openSnackbar.value = true
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

onBeforeMount((): void => {
  window.addEventListener('message', apiEventCallback, true)

  if (Object.keys(widget.value.options).length !== 0) {
    return
  }
  widget.value.options = {
    source: 'http://' + defaultBlueOsAddress,
  }
  inputURL.value = defaultBlueOsAddress
})

onBeforeUnmount((): void => {
  window.removeEventListener('message', apiEventCallback, true)
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

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
      if (validateURL(inputURL.value) !== true) {
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
