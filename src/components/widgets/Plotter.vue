<template>
  <p
    v-if="!widget.options.dataLakeVariableId"
    class="w-full h-full flex items-center justify-center text-center text-white text-h5 font-weight-bold p-4 overflow-hidden"
  >
    Please open the Plotter widget configuration menu to select a variable to be plotted.
  </p>
  <div v-else class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
  </div>
  <InteractionDialog
    v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
    :title="`Plotter config`"
    variant="text-only"
  >
    <template #content>
      <!-- Data source section -->
      <v-row>
        <v-col cols="12">
          <div class="text-subtitle-1 font-weight-medium mb-4">Data Source</div>
          <div class="ml-2">
            <v-text-field
              v-model="searchTerm"
              density="compact"
              variant="filled"
              theme="dark"
              type="text"
              placeholder="Search variables..."
              class="mb-4"
              clearable
              @update:model-value="menuOpen = true"
              @click:clear="menuOpen = false"
              @update:focused="(isFocused: boolean) => (menuOpen = isFocused)"
            />
            <v-select
              v-model="widget.options.dataLakeVariableId"
              :items="filteredDataLakeNumberVariables"
              item-title="name"
              item-value="id"
              label="Data Lake variable"
              hint="Select a variable to be plotted"
              persistent-hint
              theme="dark"
              variant="outlined"
              density="comfortable"
              :menu-props="{ modelValue: menuOpen }"
              @click="menuOpen = !menuOpen"
            />
          </div>
        </v-col>
      </v-row>

      <!-- Appearance section -->
      <v-row>
        <v-col cols="12">
          <div class="text-subtitle-1 font-weight-medium mb-2">Appearance</div>
          <div class="ml-2 flex gap-x-8">
            <v-checkbox v-model="widget.options.showTitle" label="Show title" hide-details class="-mt-1" />
            <v-menu :close-on-content-click="false">
              <template #activator="{ props: colorPickerActivatorProps }">
                <div v-bind="colorPickerActivatorProps" class="flex cursor-pointer">
                  <span class="mt-3">Background color</span>
                  <div
                    class="w-[30px] h-[30px] border-2 border-slate-700 rounded-lg cursor-pointer ml-2 mt-2"
                    :style="{ backgroundColor: widget.options.backgroundColor }"
                  ></div>
                </div>
              </template>
              <v-color-picker v-model="widget.options.backgroundColor" label="Background" hide-inputs theme="dark" />
            </v-menu>
            <v-menu :close-on-content-click="false">
              <template #activator="{ props: colorPickerActivatorProps }">
                <div v-bind="colorPickerActivatorProps" class="flex cursor-pointer">
                  <span class="mt-3">Line color</span>
                  <div
                    class="w-[30px] h-[30px] border-2 border-slate-700 rounded-lg cursor-pointer ml-2 mt-2"
                    :style="{ backgroundColor: widget.options.lineColor }"
                  ></div>
                </div>
              </template>
              <v-color-picker v-model="widget.options.lineColor" label="Line" hide-inputs theme="dark" />
            </v-menu>
            <v-text-field
              v-model.number="widget.options.lineThickness"
              type="number"
              label="Line thickness"
              variant="outlined"
              density="compact"
              :rules="[(v: number) => v > 0 || 'Must be greater than 0']"
              width="140px"
              hide-details
            />
          </div>
        </v-col>
      </v-row>

      <!-- Data points section -->
      <v-row>
        <v-col cols="12">
          <div class="text-subtitle-1 font-weight-medium mb-4">Data Points</div>
          <div class="ml-2 flex gap-x-8">
            <v-text-field
              v-model.number="widget.options.decimalPlaces"
              type="number"
              label="Decimal places"
              variant="outlined"
              density="comfortable"
              :rules="[(v: number) => v >= 0 || 'Must be 0 or greater']"
              hint="Number of decimal places to be displayed"
              width="160px"
              class="ml-2"
            />
            <v-checkbox v-model="widget.options.limitSamples" label="Limit number of samples" />
            <v-text-field
              v-model.number="widget.options.maxSamples"
              type="number"
              label="Maximum samples"
              variant="outlined"
              density="comfortable"
              :disabled="!widget.options.limitSamples"
              :rules="[(v: number) => v > 0 || 'Must be greater than 0']"
              hint="Higher values will show more history but may impact performance"
              width="220px"
            />
          </div>
        </v-col>
      </v-row>
    </template>
    <template #actions>
      <div class="flex w-full justify-end my-2">
        <v-btn @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">Close</v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { resetCanvas } from '@/libs/utils'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import InteractionDialog from '../InteractionDialog.vue'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget
const availableDataLakeVariables = ref<DataLakeVariable[]>([])
let dataLakeVariableListenerId: string | undefined
let dataLakeVariableInfoListenerId: string | undefined

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  const defaultOptions = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    lineColor: 'rgba(255, 0, 0, 1.0)',
    dataLakeVariableId: undefined,
    maxSamples: 1000,
    limitSamples: true,
    lineThickness: 1,
    decimalPlaces: 2,
    showTitle: true,
  }
  widget.value.options = { ...defaultOptions, ...widget.value.options }
})

onMounted(() => {
  changeDataLakeVariable(widget.value.options.dataLakeVariableId)
  availableDataLakeVariables.value = Object.values(getAllDataLakeVariablesInfo())
  dataLakeVariableInfoListenerId = listenToDataLakeVariablesInfoChanges((variables) => {
    availableDataLakeVariables.value = Object.values(variables)
  })

  // Try to get an initial value for the data lake variable
  if (valuesHistory.length === 0) {
    const initialValue = getDataLakeVariableData(widget.value.options.dataLakeVariableId)
    if (initialValue) {
      pushNewValue(initialValue as number)
    }
  }
})

onUnmounted(() => {
  if (dataLakeVariableInfoListenerId) {
    unlistenToDataLakeVariablesInfoChanges(dataLakeVariableInfoListenerId)
  }
  if (dataLakeVariableListenerId) {
    unlistenDataLakeVariable(widget.value.options.dataLakeVariableId, dataLakeVariableListenerId)
  }
})

const availableDataLakeNumberVariables = computed(() => {
  return availableDataLakeVariables.value.filter((variable) => variable.type === 'number')
})

const searchTerm = ref('')
const menuOpen = ref(false)

watch(
  () => widget.value.options.dataLakeVariableId,
  () => (menuOpen.value = false)
)

const filteredDataLakeNumberVariables = computed(() => {
  const search = (searchTerm.value || '').toLowerCase()
  return availableDataLakeNumberVariables.value.filter((variable) => variable.name.toLowerCase().includes(search))
})

// Remove the oldest sample if the number of samples is greater than the max samples
// Use shift if the number of samples is exactly the max samples + 1 for performance reasons
const cutExtraSamples = (): void => {
  if (widget.value.options.limitSamples) {
    if (valuesHistory.length === widget.value.options.maxSamples + 1) {
      valuesHistory.shift()
    } else if (valuesHistory.length > widget.value.options.maxSamples) {
      valuesHistory.splice(0, valuesHistory.length - widget.value.options.maxSamples)
    }
  }
}

const pushNewValue = (value: number): void => {
  valuesHistory.push(value)
  cutExtraSamples()
  renderCanvas()
}

const changeDataLakeVariable = (newId: string, oldId?: string): void => {
  if (newId === undefined) {
    console.error('No data lake variable ID provided!')
    return
  }

  if (oldId !== undefined && dataLakeVariableListenerId) {
    unlistenDataLakeVariable(oldId, dataLakeVariableListenerId)
  }

  dataLakeVariableListenerId = listenDataLakeVariable(newId, (value) => pushNewValue(value as number))
}

watch(
  () => widget.value.options.dataLakeVariableId,
  (newId, oldId) => {
    changeDataLakeVariable(newId, oldId)
    valuesHistory.length = 0
  }
)

// Make canvas size follows window resizing
const { width: windowWidth, height: windowHeight } = useWindowSize()
const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: widget.value.size.height * windowHeight.value,
}))

const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()

const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void => {
  // Add a semi-transparent background for better readability
  const metrics = ctx.measureText(text)
  const padding = 4
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(
    x - padding,
    y - 16 - padding, // 16 is approx. font height
    metrics.width + padding * 2,
    16 + padding * 2
  )

  // Draw the text
  ctx.fillStyle = widget.value.options.lineColor
  ctx.fillText(text, x, y)
}

const renderCanvas = (): void => {
  if (canvasRef.value === undefined || canvasRef.value === null) return
  if (canvasContext.value === undefined) {
    console.debug('Canvas context undefined!')
    canvasContext.value = canvasRef.value.getContext('2d')
    return
  }
  const ctx = canvasContext.value
  const canvasWidth = canvasSize.value.width
  const canvasHeight = canvasSize.value.height
  resetCanvas(ctx)

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = widget.value.options.backgroundColor
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.strokeStyle = widget.value.options.lineColor
  ctx.lineWidth = Math.max(widget.value.options.lineThickness, 1)

  try {
    maxValue = Math.max(...valuesHistory)
    minValue = Math.min(...valuesHistory)

    // Add a buffer to keep the plot neatly within bounds, and centered when there are no changes
    const buffer = 0.05 * (maxValue != minValue ? maxValue - minValue : 1)
    const maxY = maxValue + buffer
    const minY = minValue - buffer
    const currentValue = valuesHistory[valuesHistory.length - 1]

    // Draw the graph
    ctx.beginPath()
    ctx.moveTo(0, canvasHeight / 2)
    ctx.setLineDash([])

    if (valuesHistory.length === 0) {
      // Draw an open circle in the middle of the canvas indicating no value
      ctx.beginPath()
      ctx.arc(0, canvasHeight / 2, 7, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (valuesHistory.length === 1) {
      // Draw a filled circle in the middle of the canvas with a small dash line to the right indicating a single value
      ctx.fillStyle = widget.value.options.lineColor
      ctx.beginPath()
      ctx.arc(0, canvasHeight / 2, 7, 0, 2 * Math.PI)
      ctx.fill()

      ctx.beginPath()
      ctx.setLineDash([5, 5])
      ctx.moveTo(0, canvasHeight / 2)
      ctx.lineTo(0 + 50, canvasHeight / 2)
      ctx.stroke()
    } else {
      ctx.setLineDash([])
      valuesHistory.forEach((sample, index) => {
        const x = index * (canvasWidth / valuesHistory.length)
        const y = canvasHeight - ((sample - minY) / (maxY - minY)) * canvasHeight
        ctx.lineTo(x, y)
      })
    }
    ctx.stroke()

    // Setup text rendering
    ctx.font = '14px monospace'
    ctx.textBaseline = 'bottom'

    // Draw the title if enabled
    if (widget.value.options.showTitle && widget.value.options.dataLakeVariableId) {
      const variable = availableDataLakeVariables.value.find((v) => v.id === widget.value.options.dataLakeVariableId)
      if (variable) {
        drawText(ctx, variable.name, 10, 26)
        ctx.textBaseline = 'bottom'
      }
    }

    // Draw the values
    const decimalPlaces = widget.value.options.decimalPlaces
    drawText(ctx, `Current: ${Number(currentValue).toFixed(decimalPlaces)}`, 10, canvasHeight - 10)
    drawText(ctx, `Min: ${Number(minValue).toFixed(decimalPlaces)}`, 10, canvasHeight - 30)
    drawText(ctx, `Max: ${Number(maxValue).toFixed(decimalPlaces)}`, 10, canvasHeight - 50)
  } catch (error) {
    console.error('Error drawing graph:', error)
  }
}

const valuesHistory: number[] = []
let maxValue = 0
let minValue = 0

// Update canvas whenever reference variables changes
watch(
  [canvasSize, widget],
  () => {
    if (!widgetStore.isWidgetVisible(widget.value)) return
    cutExtraSamples()
    nextTick(() => renderCanvas())
  },
  { deep: true }
)

const canvasVisible = useElementVisibility(canvasRef)
watch(canvasVisible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible) renderCanvas()
})
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  min-height: 200px;
}
</style>
