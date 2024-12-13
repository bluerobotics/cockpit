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
            <v-select
              v-model="widget.options.dataLakeVariableId"
              :items="availableDataLakeVariables"
              item-title="name"
              item-value="id"
              label="Data Lake variable"
              hint="Select a variable to be plotted"
              persistent-hint
              variant="outlined"
              density="comfortable"
            />
          </div>
        </v-col>
      </v-row>

      <!-- Appearance section -->
      <v-row>
        <v-col cols="12">
          <div class="text-subtitle-1 font-weight-medium mb-2">Appearance</div>
          <div class="ml-2 flex gap-x-8">
            <v-menu :close-on-content-click="false">
              <template #activator="{ props: colorPickerActivatorProps }">
                <div v-bind="colorPickerActivatorProps" class="flex cursor-pointer">
                  <span class="mt-1">Background color</span>
                  <div
                    class="w-[30px] h-[30px] border-2 border-slate-700 rounded-lg cursor-pointer ml-2"
                    :style="{ backgroundColor: widget.options.backgroundColor }"
                  ></div>
                </div>
              </template>
              <v-card class="overflow-hidden" :style="interfaceStore.globalGlassMenuStyles">
                <v-color-picker v-model="widget.options.backgroundColor" label="Background" hide-inputs />
              </v-card>
            </v-menu>
            <v-menu :close-on-content-click="false">
              <template #activator="{ props: colorPickerActivatorProps }">
                <div v-bind="colorPickerActivatorProps" class="flex cursor-pointer">
                  <span class="mt-1">Line color</span>
                  <div
                    class="w-[30px] h-[30px] border-2 border-slate-700 rounded-lg cursor-pointer ml-2"
                    :style="{ backgroundColor: widget.options.lineColor }"
                  ></div>
                </div>
              </template>
              <v-card class="overflow-hidden" :style="interfaceStore.globalGlassMenuStyles">
                <v-color-picker v-model="widget.options.lineColor" label="Line" hide-inputs />
              </v-card>
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
          <div class="text-subtitle-1 font-weight-medium mb-2">Data Points</div>
          <div class="ml-2 flex gap-x-8">
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
import { computed, nextTick, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { resetCanvas } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

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
let listenerId: string | undefined

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      lineColor: 'rgba(255, 0, 0, 1.0)',
      dataLakeVariableId: undefined,
      maxSamples: 1000,
      limitSamples: true,
      lineThickness: 1,
    }
  }
})

onMounted(() => {
  changeDataLakeVariable(widget.value.options.dataLakeVariableId)
  availableDataLakeVariables.value = Object.values(getAllDataLakeVariablesInfo()).filter(
    (variable) => variable.type === 'number'
  )
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

const changeDataLakeVariable = (newId: string, oldId?: string): void => {
  if (newId === undefined) {
    console.error('No data lake variable ID provided!')
    return
  }

  if (oldId !== undefined && listenerId) {
    unlistenDataLakeVariable(oldId, listenerId)
  }

  listenerId = listenDataLakeVariable(newId, (value) => {
    valuesHistory.push(value as number)

    cutExtraSamples()
    renderCanvas()
  })
}

watch([widget.value.options.maxSamples, widget.value.options.limitSamples], () => {
  cutExtraSamples()
  renderCanvas()
})

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
    if (valuesHistory.length === 0) return

    maxValue = Math.max(...valuesHistory)
    minValue = Math.min(...valuesHistory)
    const currentValue = valuesHistory[valuesHistory.length - 1]

    // Draw the graph
    ctx.beginPath()
    ctx.moveTo(0, canvasHeight)

    valuesHistory.forEach((sample, index) => {
      const x = index * (canvasWidth / valuesHistory.length)
      const y = canvasHeight - ((sample - minValue) / (maxValue - minValue)) * canvasHeight
      ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Setup text rendering
    ctx.font = '14px monospace'
    ctx.textBaseline = 'bottom'

    // Draw the values
    drawText(ctx, `Current: ${Number(currentValue).toFixed(2)}`, 10, canvasHeight - 10)
    drawText(ctx, `Min: ${Number(minValue).toFixed(2)}`, 10, canvasHeight - 30)
    drawText(ctx, `Max: ${Number(maxValue).toFixed(2)}`, 10, canvasHeight - 50)
  } catch (error) {
    console.error('Error drawing graph:', error)
  }
}

const valuesHistory: number[] = []
let maxValue = 0
let minValue = 0

// Update canvas whenever reference variables changes
watch([canvasSize, widget.value.options], () => {
  if (!widgetStore.isWidgetVisible(widget.value)) return
  nextTick(() => renderCanvas())
})

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
  position: relative;
  min-width: 150px;
  min-height: 200px;
}
</style>
