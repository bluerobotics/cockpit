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
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title>Plotter config</v-card-title>
      <v-card-text>
        <v-container class="pa-0">
          <!-- Data source section -->
          <v-row>
            <v-col cols="12">
              <div class="text-subtitle-1 font-weight-medium mb-4">Data Source</div>
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
                class="mb-2"
                @update:model-value="changeDataLakeVariable"
              />
            </v-col>
          </v-row>

          <!-- Appearance section -->
          <v-row>
            <v-col cols="12">
              <div class="text-subtitle-1 font-weight-medium mb-4">Appearance</div>
              <v-menu>
                <template #activator="{ props: colorPickerActivatorProps }">
                  <v-btn
                    v-bind="colorPickerActivatorProps"
                    icon="mdi-palette"
                    size="54"
                    class="bg-[#334a5755] text-[#FFFFFFCC] text-[28px] rounded-full elevation-5"
                  />
                </template>
                <v-list :style="interfaceStore.globalGlassMenuStyles">
                  <v-list-item>
                    <v-list-item-title class="text-subtitle-1 font-weight-medium mb-2">
                      Background Color
                    </v-list-item-title>
                    <v-color-picker
                      v-model="widget.options.backgroundColor"
                      label="Background"
                      hide-inputs
                      class="m-2"
                    />
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title class="text-subtitle-1 font-weight-medium mb-2">Line Color</v-list-item-title>
                    <v-color-picker v-model="widget.options.lineColor" label="Line" hide-inputs class="m-2" />
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-col>
          </v-row>

          <!-- Data points section -->
          <v-row>
            <v-col cols="12">
              <div class="text-subtitle-1 font-weight-medium mb-4">Data Points</div>
              <v-switch
                v-model="widget.options.limitSamples"
                label="Limit number of samples"
                color="primary"
                hide-details
                class="mb-2"
              />
              <v-text-field
                v-model.number="widget.options.maxSamples"
                type="number"
                label="Maximum samples"
                variant="outlined"
                density="comfortable"
                :disabled="!widget.options.limitSamples"
                :rules="[(v: number) => v > 0 || 'Must be greater than 0']"
                hint="Higher values will show more history but may impact performance"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import {
  CockpitActionVariable,
  getAllCockpitActionVariablesInfo,
  listenCockpitActionVariable,
  unlistenCockpitActionVariable,
} from '@/libs/actions/data-lake'
import { resetCanvas } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget
const availableDataLakeVariables = ref<CockpitActionVariable[]>([])

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      lineColor: 'rgba(255, 0, 0, 1.0)',
      dataLakeVariableId: undefined,
      maxSamples: 1000,
      limitSamples: true,
    }
  }
})

onMounted(() => {
  changeDataLakeVariable(widget.value.options.dataLakeVariableId)
  availableDataLakeVariables.value = Object.values(getAllCockpitActionVariablesInfo()).filter(
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

const changeDataLakeVariable = (newId: string): void => {
  if (newId === undefined) {
    console.error('No data lake variable ID provided!')
    return
  }

  const oldId = widget.value.options.dataLakeVariableId
  if (oldId !== undefined) {
    unlistenCockpitActionVariable(oldId)
  }

  listenCockpitActionVariable(newId, (value) => {
    valuesHistory.push(value as number)

    cutExtraSamples()
    renderCanvas()
  })
}

watch([widget.value.options.maxSamples, widget.value.options.limitSamples], () => {
  cutExtraSamples()
  renderCanvas()
})

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
    drawText(ctx, `Current: ${currentValue.toFixed(2)}`, 10, canvasHeight - 10)
    drawText(ctx, `Min: ${minValue.toFixed(2)}`, 10, canvasHeight - 30)
    drawText(ctx, `Max: ${maxValue.toFixed(2)}`, 10, canvasHeight - 50)
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
