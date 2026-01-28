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
      <div
        class="max-h-[85vh] overflow-y-auto -mr-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <!-- Data source section -->
        <ExpansiblePanel no-top-divider compact is-expanded>
          <template #title>Data Source</template>
          <template #content>
            <div class="py-2">
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
          </template>
        </ExpansiblePanel>

        <!-- Appearance section -->
        <ExpansiblePanel compact :is-expanded="!interfaceStore.isOnSmallScreen">
          <template #title>Appearance</template>
          <template #content>
            <div class="flex flex-wrap gap-x-8 gap-y-2 py-2">
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
          </template>
        </ExpansiblePanel>

        <!-- Data points section -->
        <ExpansiblePanel compact :is-expanded="!interfaceStore.isOnSmallScreen">
          <template #title>Data Points</template>
          <template #content>
            <div class="py-2">
              <div class="flex flex-wrap gap-x-8 gap-y-2">
                <v-text-field
                  v-model.number="widget.options.decimalPlaces"
                  type="number"
                  label="Decimal places"
                  variant="outlined"
                  density="comfortable"
                  :rules="[(v: number) => v >= 0 || 'Must be 0 or greater']"
                  hint="Number of decimal places to be displayed"
                  width="160px"
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
              <v-checkbox
                v-model="widget.options.updateOnConstantValue"
                label="Update on constant value"
                hint="Advance graph when value is unchanged (shows horizontal lines for constant values)"
                persistent-hint
              />
            </div>
          </template>
        </ExpansiblePanel>

        <!-- Statistics display section -->
        <ExpansiblePanel compact :is-expanded="!interfaceStore.isOnSmallScreen">
          <template #title>Statistics Display</template>
          <template #content>
            <div class="flex flex-wrap gap-x-6 py-2">
              <v-checkbox v-model="widget.options.showCurrent" label="Current" hide-details class="-mt-1" />
              <v-checkbox v-model="widget.options.showMin" label="Min" hide-details class="-mt-1" />
              <v-checkbox v-model="widget.options.showMax" label="Max" hide-details class="-mt-1" />
              <v-checkbox v-model="widget.options.showAvg" label="Avg" hide-details class="-mt-1" />
              <v-checkbox v-model="widget.options.showMedian" label="Median" hide-details class="-mt-1" />
            </div>
          </template>
        </ExpansiblePanel>

        <!-- Y-Axis bounds section -->
        <ExpansiblePanel compact no-bottom-divider :is-expanded="!interfaceStore.isOnSmallScreen">
          <template #title>Y-Axis Bounds</template>
          <template #content>
            <div class="flex gap-x-8 py-2 mb-2">
              <div class="flex flex-col">
                <v-checkbox v-model="widget.options.useFixedMinY" label="Fixed minimum" hide-details class="-mt-1" />
                <v-text-field
                  v-model.number="widget.options.fixedMinY"
                  type="number"
                  label="Min value"
                  variant="outlined"
                  density="compact"
                  :disabled="!widget.options.useFixedMinY"
                  width="140px"
                  hide-details
                />
              </div>
              <div class="flex flex-col">
                <v-checkbox v-model="widget.options.useFixedMaxY" label="Fixed maximum" hide-details class="-mt-1" />
                <v-text-field
                  v-model.number="widget.options.fixedMaxY"
                  type="number"
                  label="Max value"
                  variant="outlined"
                  density="compact"
                  :disabled="!widget.options.useFixedMaxY"
                  width="140px"
                  hide-details
                />
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
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
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import ExpansiblePanel from '../ExpansiblePanel.vue'
import InteractionDialog from '../InteractionDialog.vue'

const interfaceStore = useAppInterfaceStore()

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
    updateOnConstantValue: true,
    useFixedMinY: false,
    useFixedMaxY: false,
    fixedMinY: 0,
    fixedMaxY: 100,
    showCurrent: true,
    showMin: true,
    showMax: true,
    showAvg: true,
    showMedian: true,
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

  dataLakeVariableListenerId = listenDataLakeVariable(newId, (value) => pushNewValue(value as number), {
    notifyOnTimestampChange: widget.value.options.updateOnConstantValue,
  })
}

watch(
  () => widget.value.options.dataLakeVariableId,
  (newId, oldId) => {
    changeDataLakeVariable(newId, oldId)
    valuesHistory.length = 0
  }
)

// Re-register listener when updateOnConstantValue option changes
watch(
  () => widget.value.options.updateOnConstantValue,
  () => {
    const currentId = widget.value.options.dataLakeVariableId
    if (currentId) {
      changeDataLakeVariable(currentId, currentId)
    }
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
    medianValue = calculateMedian(valuesHistory)
    averageValue = calculateAverage(valuesHistory)

    // Use fixed Y-axis bounds if enabled, otherwise calculate with a buffer to keep the plot neatly within bounds, and centered when there are no changes
    const tempMinValue = widget.value.options.useFixedMinY ? widget.value.options.fixedMinY : minValue
    const tempMaxValue = widget.value.options.useFixedMaxY ? widget.value.options.fixedMaxY : maxValue
    const buffer = 0.05 * (tempMaxValue != tempMinValue ? tempMaxValue - tempMinValue : 1)
    const minY = widget.value.options.useFixedMinY ? widget.value.options.fixedMinY : tempMinValue - buffer
    const maxY = widget.value.options.useFixedMaxY ? widget.value.options.fixedMaxY : tempMaxValue + buffer

    const currentValue = valuesHistory[valuesHistory.length - 1]

    // Draw zero reference line if zero is within the visible range
    if (minY <= 0 && maxY >= 0) {
      const zeroY = canvasHeight - ((0 - minY) / (maxY - minY)) * canvasHeight
      ctx.beginPath()
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.moveTo(0, zeroY)
      ctx.lineTo(canvasWidth, zeroY)
      ctx.stroke()
      // Restore line settings for the main graph
      ctx.strokeStyle = widget.value.options.lineColor
      ctx.lineWidth = Math.max(widget.value.options.lineThickness, 1)
    }

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

    // Draw the values (stacked based on which ones are enabled)
    const decimalPlaces = widget.value.options.decimalPlaces
    const lineHeight = 20
    let yOffset = 10

    if (widget.value.options.showCurrent) {
      drawText(ctx, `Current: ${Number(currentValue).toFixed(decimalPlaces)}`, 10, canvasHeight - yOffset)
      yOffset += lineHeight
    }
    if (widget.value.options.showMin) {
      drawText(ctx, `Min: ${Number(minValue).toFixed(decimalPlaces)}`, 10, canvasHeight - yOffset)
      yOffset += lineHeight
    }
    if (widget.value.options.showMax) {
      drawText(ctx, `Max: ${Number(maxValue).toFixed(decimalPlaces)}`, 10, canvasHeight - yOffset)
      yOffset += lineHeight
    }
    if (widget.value.options.showAvg) {
      drawText(ctx, `Avg: ${Number(averageValue).toFixed(decimalPlaces)}`, 10, canvasHeight - yOffset)
      yOffset += lineHeight
    }
    if (widget.value.options.showMedian) {
      drawText(ctx, `Median: ${Number(medianValue).toFixed(decimalPlaces)}`, 10, canvasHeight - yOffset)
    }
  } catch (error) {
    console.error('Error drawing graph:', error)
  }
}

const valuesHistory: number[] = []
let maxValue = 0
let minValue = 0
let medianValue = 0
let averageValue = 0

/**
 * Calculate the median value from an array of numbers
 * @param {number[]} values - Array of numbers to calculate median from
 * @returns {number} The median value
 */
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Calculate the average (mean) value from an array of numbers
 * @param {number[]} values - Array of numbers to calculate average from
 * @returns {number} The average value
 */
const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

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
