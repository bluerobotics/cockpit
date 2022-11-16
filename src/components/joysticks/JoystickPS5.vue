<template>
  <object class="svgObject" type="image/svg+xml" data="/images/PS5.svg" />
</template>

<script setup lang="ts">
import { watch } from 'vue'

/**
 * Buttons for PS5 controller
 */
enum Buttons {
  UP = 'path_up',
  DOWN = 'path_down',
  RIGHT = 'path_right',
  LEFT = 'path_left',
  PS = 'path_ps',
  T = 'path_t',
  L1 = 'path_l1',
  L2 = 'path_l2',
  L3 = 'path_l3',
  R1 = 'path_r1',
  R2 = 'path_r2',
  R3 = 'path_r3',
  TRIANGLE = 'path_triangle',
  CIRCLE = 'path_circle',
  SQUARE = 'path_square',
  X = 'path_x',
  CREATE = 'path_create',
  OPTIONS = 'path_options',
}

/**
 * Joystick axis
 */
enum Axis {
  RIGHT = Buttons.R3,
  LEFT = Buttons.L3,
}

/* eslint-disable  */
const props = defineProps<{
  up?: boolean
  down?: boolean
  right?: boolean
  left?: boolean
  ps?: boolean
  t?: boolean
  l1?: boolean
  l2?: boolean
  l3?: boolean
  r1?: boolean
  r2?: boolean
  r3?: boolean
  triangle?: boolean
  circle?: boolean
  square?: boolean
  x?: boolean
  create?: boolean
  options?: boolean
  leftAxis?: [number, number]
  rightAxis?: [number, number]
}>()
/* eslint-enable  */

// Wait for svg to be available
let waitTimer: ReturnType<typeof setInterval>
let svg: Document | null | undefined

// Wait for object to be loaded
waitTimer = setInterval(() => {
  svg = (
    document?.querySelector('.svgObject') as HTMLEmbedElement | null
  )?.getSVGDocument()
  if (svg != undefined) {
    clearInterval(waitTimer)
  }
}, 100)

watch(
  () => [props.leftAxis, props.rightAxis],
  () => {
    setAxis(Axis.LEFT, props.leftAxis ?? [0, 0])
    setAxis(Axis.RIGHT, props.rightAxis ?? [0, 0])
  }
)

watch(
  () => [
    props.up,
    props.down,
    props.right,
    props.left,
    props.ps,
    props.t,
    props.l1,
    props.l2,
    props.l3,
    props.r1,
    props.r2,
    props.r3,
    props.triangle,
    props.circle,
    props.square,
    props.x,
    props.create,
    props.options,
  ],
  () => {
    toggleButton(Buttons.UP, props.up ?? false)
    toggleButton(Buttons.DOWN, props.down ?? false)
    toggleButton(Buttons.RIGHT, props.right ?? false)
    toggleButton(Buttons.LEFT, props.left ?? false)
    toggleButton(Buttons.PS, props.ps ?? false)
    toggleButton(Buttons.T, props.t ?? false)
    toggleButton(Buttons.L1, props.l1 ?? false)
    toggleButton(Buttons.L2, props.l2 ?? false)
    toggleButton(Buttons.L3, props.l3 ?? false)
    toggleButton(Buttons.R1, props.r1 ?? false)
    toggleButton(Buttons.R2, props.r2 ?? false)
    toggleButton(Buttons.R3, props.r3 ?? false)
    toggleButton(Buttons.TRIANGLE, props.triangle ?? false)
    toggleButton(Buttons.CIRCLE, props.circle ?? false)
    toggleButton(Buttons.SQUARE, props.square ?? false)
    toggleButton(Buttons.X, props.x ?? false)
    toggleButton(Buttons.CREATE, props.create ?? false)
    toggleButton(Buttons.OPTIONS, props.options ?? false)
  }
)

/**
 * Simpler sleep function
 *
 * @param {Buttons} button Button to be user
 * @param {boolean} state Button state
 * @returns {void}
 */
function toggleButton(button: Buttons, state: boolean): void {
  svg?.getElementById(button)?.setAttribute('fill', state ? 'red' : 'none')
}

/**
 * Simpler sleep function
 *
 * @param {number} input Input value
 * @param {number} inputMin Input lowest point
 * @param {number} inputMax Input maximum point
 * @param {number} outputMin Output lowest point
 * @param {number} outputMax Output maximum point
 * @returns {void}
 */
function scale(
  input: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
): number {
  return (
    ((input - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) +
    outputMin
  )
}

/**
 * Set axis position
 *
 * @param {Axis} axis Axis to be set
 * @param {[number, number]} '[x, y]' Axis value between [-1, 1]
 * @returns {void}
 */
function setAxis(axis: Axis, [x, y]: [number, number]): void {
  const xValue =
    axis == Axis.RIGHT
      ? scale(x, -1, 1, -3920.9, -3882.1)
      : scale(x, -1, 1, -4144.8, -4106.1)
  const yValue = scale(y, -1, 1, -2192.7, -2153.9)

  svg
    ?.getElementById(axis as unknown as string)
    ?.setAttribute('transform', `translate(${xValue} ${yValue})`)
}
</script>
