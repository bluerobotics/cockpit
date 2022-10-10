<template>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect x="0" y="0" width="100%" height="100%" fill-opacity="0" />
    <g transform="scale(0.8 0.8) translate(12, 12)">
      <text x="20%" y="30%">
        {{ xAxis.toFixed(1) }}
      </text>
      <text x="60%" y="30%">
        {{ yAxis.toFixed(1) }}
      </text>
      <circle
        :cx="50 * (1 + xAxis) + '%'"
        :cy="50 * (1 + yAxis) + '%'"
        r="4"
        fill="rgba(1, 1, 1, 0.8)"
      />
      <circle
        cx="50%"
        cy="50%"
        r="49%"
        fill="none"
        stroke="rgba(0, 0, 0, 0.4)"
        stroke-width="1"
      />
      <circle
        :v-if="showOffset"
        cx="50%"
        cy="50%"
        :r="offset * 50 + '%'"
        fill="none"
        stroke="rgba(120, 0, 0, 0.4)"
        stroke-width="0.4"
      />
      <line
        x1="0"
        y1="50%"
        x2="100%"
        y2="50%"
        stroke="rgba(0, 0, 0, 0.2)"
        stroke-width="1"
      />
      <line
        x1="50%"
        y1="0%"
        x2="50%"
        y2="100%"
        stroke="rgba(0, 0, 0, 0.2)"
        stroke-width="1"
      />
      <polygon
        :points="calibrationSVGValues"
        fill="rgb(0, 13, 0); fill-rule:nonzero"
        :opacity="showCalibration ? 0.2 : 0"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Props for the JoystickAxis component
 */
export interface Props {
  /**
   * X axis of joystick, should be between -1 and 1
   */
  xAxis: number

  /**
   * Y axis of joystick, should be between -1 and 1
   */
  yAxis: number

  /**
   * Calibration array
   */
  calibration?: Array<[number, number]>

  /**
   * Show calibration overlay
   */
  showCalibration?: boolean

  /**
   * Show offset overlay
   */
  showOffset?: boolean

  /**
   * offset value, should be between 0 and 1
   */
  offset?: number
}

const props = withDefaults(defineProps<Props>(), {
  showCalibration: false,
  calibration: () => [],
  showOffset: false,
  offset: 0,
})

const calibrationSVGValues = computed(() => {
  const calibration = props.calibration
  const values = calibration
    .map(([x, y]) => `${50 * (1 + x)},${50 * (1 + y)}`)
    .join(' ')
  return values
})
</script>
