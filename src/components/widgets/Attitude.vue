<template>
  <div class="main">
    <v-stage :config="stageSize">
      <v-layer>
        <v-group :config="hudConfig.pitchLinesGroups.left">
          <template v-for="angle in hudConfig.pitchLines.left" :key="angle">
            <v-group :config="angle.groupConfig">
              <v-line :config="angle.lineConfig" />
              <v-text :config="angle.textConfig" />
            </v-group>
          </template>
        </v-group>
        <v-group :config="hudConfig.centerAim">
          <v-line :config="hudConfig.aimLines.left" />
          <v-arc :config="hudConfig.aimArcs.left" />
          <v-arc :config="hudConfig.aimArcs.right" />
          <v-line :config="hudConfig.aimLines.right" />
        </v-group>
        <template v-if="widget.options.showRollPitchValues">
          <v-text :config="hudConfig.liveTxt.pitch" />
          <v-text :config="hudConfig.liveTxt.roll" />
        </template>
        <v-group :config="hudConfig.pitchLinesGroups.right">
          <template v-for="angle in hudConfig.pitchLines.right" :key="angle">
            <v-group :config="angle.groupConfig">
              <v-line :config="angle.lineConfig" />
              <v-text :config="angle.textConfig" />
            </v-group>
          </template>
        </v-group>
      </v-layer>
    </v-stage>
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
  </div>
  <v-dialog v-model="showOptionsDialog" min-width="400" max-width="35%">
    <v-card class="pa-2">
      <v-card-title>Attitude widget config</v-card-title>
      <v-card-text>
        <v-switch
          class="ma-1"
          label="Show roll/pitch values"
          :model-value="widget.options.showRollPitchValues"
          hide-details
          @change="
            widget.options.showRollPitchValues =
              !widget.options.showRollPitchValues
          "
        />
        <span>Distance between pitch lines</span>
        <v-slider
          v-model="widget.options.pitchHeightFactor"
          label="Pitch lines gain factor"
          :min="1"
          :max="2500"
          thumb-label
        />
        <span>Center circle radius</span>
        <v-slider
          v-model="widget.options.desiredAimRadius"
          label="Center circle radius"
          :min="10"
          :max="300"
          thumb-label
        />
        <v-expansion-panels>
          <v-expansion-panel>
            <v-expansion-panel-title>Color</v-expansion-panel-title>
            <v-expansion-panel-text class="pa-2">
              <v-color-picker
                v-model="widget.options.hudColor"
                :swatches="colorSwatches"
                show-swatches
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import gsap from 'gsap'
import { computed, onBeforeMount, reactive, ref, toRefs, watch } from 'vue'

import { constrain, degrees, radians, round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { LiveTexts, PitchLines, RenderVariables } from '@/types/attitude'
import type { Widget } from '@/types/widgets'

const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const showOptionsDialog = ref(false)

// Pitch angles for which horizontal indication lines are rendered.
const pitchAngles = [-90, -70, -45, -30, -10, 0, 10, 30, 45, 70, 90]

// Rendering variables. Store current rendering state.
const renderVars = reactive<RenderVariables>({
  rollDegrees: 0,
  pitchLinesHeights: {},
})

// Pre-defined HUD colors
const colorSwatches = ref([['#FF2D2D'], ['#0ADB0ACC'], ['#FFFFFF']])

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showRollPitchValues: true,
      desiredAimRadius: 150,
      pitchHeightFactor: 300,
      hudColor: colorSwatches.value[0][0],
    }
  }

  // Instantiate the initial pitch object
  pitchAngles.forEach((a: number) => (renderVars.pitchLinesHeights[a] = 5 * a))
})

// Make stage size follows window resizing
const { width: windowWidth, height: windowHeight } = useWindowSize()
const stageSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: widget.value.size.height * windowHeight.value,
}))

// Center aim radius, constrained from user's input
const aimRadius = computed(() =>
  constrain(
    widget.value.options.desiredAimRadius,
    35,
    0.2 * stageSize.value.width
  )
)
const rollAngleDeg = computed(() => degrees(store.attitude.roll) ?? 0)
const pitchY = computed(() => degrees(store.attitude.pitch) ?? 0)

// Returns the projected height of a pitch line for a given angle
const angleY = (angle: number): number => {
  return (
    (widget.value.options.pitchHeightFactor * radians(angle)) /
    Math.cos(radians(angle))
  )
}

// Configuration of the HUD Konva rendering objects
const hudConfig = computed(() => {
  const halfArc = {
    innerRadius: aimRadius.value,
    outerRadius: aimRadius.value + 2,
    angle: 90,
    stroke: widget.value.options.hudColor,
    strokeWidth: 2,
  }
  const aimArcs = {
    left: { ...halfArc, ...{ rotation: -45 } },
    right: { ...halfArc, ...{ rotation: +135 } },
  }

  const centerAim = {
    x: stageSize.value.width / 2,
    y: stageSize.value.height / 2,
    rotation: renderVars.rollDegrees,
  }

  const aimLineBase = { stroke: widget.value.options.hudColor, strokeWidth: 2 }
  const aimLines = {
    left: {
      ...aimLineBase,
      ...{ points: [aimRadius.value, 0, 1.6 * aimRadius.value - 1, 0] },
    },
    right: {
      ...aimLineBase,
      ...{ points: [-aimRadius.value, 0, -1.6 * aimRadius.value + 1, 0] },
    },
  }

  const pitchLinesBaseConfig = {
    y: 0,
    stroke: widget.value.options.hudColor,
    strokeWidth: 1,
    dash: [6, 3],
  }

  const pitchTextsBaseConfig = {
    y: -14,
    width: 30,
    fontSize: 12,
    fontStyle: 'bold',
    fontFamily: 'Arial',
    fill: widget.value.options.hudColor,
  }

  const pitchLinesGroups = {
    left: { ...centerAim, ...{ offsetX: 1.8 * aimRadius.value } },
    right: { ...centerAim, ...{ offsetX: -1.8 * aimRadius.value } },
  }

  // Configuration for the pitch lines on the left side of the screen
  const pitchLines: PitchLines = { left: {}, right: {} }
  pitchAngles.forEach((angle: number) => {
    let lineWidth = -stageSize.value.width / 2
    let lineConfig = {
      ...pitchLinesBaseConfig,
      ...{ x: -3, points: [0, 20, -2, 0, 0.3 * lineWidth, 0] },
    }
    let textConfig = {
      ...pitchTextsBaseConfig,
      ...{ x: -36, align: 'right', text: `${angle}°` },
    }
    let groupConfig = { y: renderVars.pitchLinesHeights[angle] }
    pitchLines.left[angle] = { lineConfig, textConfig, groupConfig }

    lineConfig = {
      ...pitchLinesBaseConfig,
      ...{ x: 3, points: [0, 20, 2, 0, -0.3 * lineWidth, 0] },
    }
    textConfig = {
      ...pitchTextsBaseConfig,
      ...{ x: 6, align: 'left', text: `${angle}°` },
    }
    groupConfig = { y: renderVars.pitchLinesHeights[angle] }
    pitchLines.right[angle] = { lineConfig, textConfig, groupConfig }
  })

  const LiveTextsBase = {
    fontSize: 20,
    fontStyle: 'bold',
    fontFamily: 'Arial',
    fill: widget.value.options.hudColor,
  }

  const liveTxt: LiveTexts = {
    roll: {
      ...LiveTextsBase,
      ...{
        x:
          stageSize.value.width / 2 +
          (aimRadius.value < 140 ? -30 : -0.8 * aimRadius.value),
        y:
          stageSize.value.height / 2 +
          (aimRadius.value < 140 ? -2.4 : 0.3) * aimRadius.value,
        text: `r: ${round(rollAngleDeg.value)}°`,
      },
    },
    pitch: {
      ...LiveTextsBase,
      ...{
        x:
          stageSize.value.width / 2 +
          (aimRadius.value < 140 ? -30 : -0.7 * aimRadius.value),
        y:
          stageSize.value.height / 2 +
          (aimRadius.value < 140 ? 2 : 0.45) * aimRadius.value,
        text: `p: ${round(pitchY.value)}°`,
      },
    },
  }

  return { pitchLines, pitchLinesGroups, aimLines, aimArcs, centerAim, liveTxt }
})

// Update the height of each pitch line when the vehicle pitch is updated
watch(pitchY, () => {
  pitchAngles.forEach((angle: number) => {
    const y = -round(angleY(angle - degrees(store.attitude.pitch)))
    gsap.to(renderVars.pitchLinesHeights, 0.1, { [angle]: y })
  })
})

// Update the HUD roll angle when the vehicle roll is updated
watch(rollAngleDeg, () => {
  gsap.to(renderVars, 0.1, { rollDegrees: -round(rollAngleDeg.value) })
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
}
.options-btn {
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
}
.main:hover .options-btn {
  display: block;
}
</style>
