<template>
  <object :class="component_name" type="image/svg+xml" :data="joystick_svg_path" />
</template>

<script lang="ts">
/**
 * Buttons for PS4 controller
 */
export enum Button {
  B0 = 0, // Bottom button in right cluster
  B1 = 1, // Right button in right cluster
  B2 = 2, // Left button in right cluster
  B3 = 3, // Top button in right cluster
  B4 = 4, // Top left front button
  B5 = 5, // Top right front button
  B6 = 6, // Bottom left front button
  B7 = 7, // Bottom right front button
  B8 = 8, // Left button in center cluster
  B9 = 9, // Right button in center cluster
  B10 = 10, // Left stick pressed button
  B11 = 11, // Right stick pressed button
  B12 = 12, // Top button in left cluster
  B13 = 13, // Bottom button in left cluster
  B14 = 14, // Left button in left cluster
  B15 = 15, // Right button in left cluster
  B16 = 16, // Center button in center cluster
  B17 = 17, // 	Extra non-standard buttons
}

/**
 * Joystick axis
 */
export enum Axis {
  HORIZONTAL_LEFT = 0, // Horizontal axis for left stick (negative left/positive right)
  VERTICAL_LEFT = 1, // Vertical axis for left stick (negative up/positive down)
  HORIZONTAL_RIGHT = 2, // Horizontal axis for right stick (negative left/positive right)
  VERTICAL_RIGHT = 3, // Vertical axis for right stick (negative up/positive down)
}

/**
 * Possible input
 */
export interface InputSpec {
  /**
   * Input type (Axis or Button)
   */
  type: EventType | EventType
  /**
   * Input value
   */
  value: Axis | Button
}
</script>

<script setup lang="ts">
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { EventType } from '@/libs/joystick/manager'
import type { InputWithPrettyName } from '@/libs/joystick/protocols'
import { scale } from '@/libs/utils'
import type { ProtocolControllerMapping } from '@/types/joystick'

const textColor = '#747474'

/**
 * Joystick models
 */
enum Models {
  PS4 = 'PS4',
  PS5 = 'PS5',
}

const buttonPath: { [key in Button]: string } = {
  [Button.B0]: 'path_b0',
  [Button.B1]: 'path_b1',
  [Button.B2]: 'path_b2',
  [Button.B3]: 'path_b3',
  [Button.B4]: 'path_b4',
  [Button.B5]: 'path_b5',
  [Button.B6]: 'path_b6',
  [Button.B7]: 'path_b7',
  [Button.B8]: 'path_b8',
  [Button.B9]: 'path_b9',
  [Button.B10]: 'path_b10',
  [Button.B11]: 'path_b11',
  [Button.B12]: 'path_b12',
  [Button.B13]: 'path_b13',
  [Button.B14]: 'path_b14',
  [Button.B15]: 'path_b15',
  [Button.B16]: 'path_b16',
  [Button.B17]: 'path_b17',
}

const axisPath: { [key in Axis]: string } = {
  [Axis.HORIZONTAL_LEFT]: 'path_b10',
  [Axis.VERTICAL_LEFT]: 'path_b10',
  [Axis.HORIZONTAL_RIGHT]: 'path_b11',
  [Axis.VERTICAL_RIGHT]: 'path_b11',
}

/* eslint-disable  */
const props = defineProps<{
  model: string // Joystick model
  b0?: number // State of the B0 button as a floating point number, between 0 and 1
  b1?: number // State of the B1 button as a floating point number, between 0 and 1
  b2?: number // State of the B2 button as a floating point number, between 0 and 1
  b3?: number // State of the B3 button as a floating point number, between 0 and 1
  b4?: number // State of the B4 button as a floating point number, between 0 and 1
  b5?: number // State of the B5 button as a floating point number, between 0 and 1
  b6?: number // State of the B6 button as a floating point number, between 0 and 1
  b7?: number // State of the B7 button as a floating point number, between 0 and 1
  b8?: number // State of the B8 button as a floating point number, between 0 and 1
  b9?: number // State of the B9 button as a floating point number, between 0 and 1
  b10?: number // State of the B10 button as a floating point number, between 0 and 1
  b11?: number // State of the B11 button as a floating point number, between 0 and 1
  b12?: number // State of the B12 button as a floating point number, between 0 and 1
  b13?: number // State of the B13 button as a floating point number, between 0 and 1
  b14?: number // State of the B14 button as a floating point number, between 0 and 1
  b15?: number // State of the B15 button as a floating point number, between 0 and 1
  b16?: number // State of the B16 button as a floating point number, between 0 and 1
  b17?: number // State of the B17 button as a floating point number, between 0 and 1
  leftAxisHoriz?: number // State of the horizontal left axis as a floating point number, between -1 and +1
  leftAxisVert?: number // State of the vertical left axis as a floating point number, between -1 and +1
  rightAxisHoriz?: number // State of the horizontal right axis as a floating point number, between -1 and +1
  rightAxisVert?: number // State of the vertical right axis as a floating point number, between -1 and +1
  protocolMapping: ProtocolControllerMapping // Mapping from the Cockpit standard to the protocol functions
  buttonLabelCorrespondency: InputWithPrettyName[] // Mapping from the protocol functions to human readable names
}>()

const emit = defineEmits<{
  // eslint-disable-next-line
  (e: 'click', inputs: any): void
}>()

const findInputFromPath = (path: string): InputSpec[] => {
  const inputs: InputSpec[] = []
  Object.entries(buttonPath).filter(([, v]) => v === path).forEach((button) => {
    inputs.push({ type: EventType.Button, value: button[0] as unknown as Button })
  })
  Object.entries(axisPath).filter(([, v]) => v === path).forEach((axis) => {
    inputs.push({ type: EventType.Axis, value: axis[0] as unknown as Axis })
  })
  return inputs
}

// Wait for svg to be available
let waitTimer: ReturnType<typeof setInterval>
let svg: Document | null | undefined

const component_name = ref(`joystick-${uuid4()}`)

const isButtonPath = (element: Element) => element.id.includes('path_b')

// Wait for object to be loaded
waitTimer = setInterval(() => {
  if (svg) return
  svg = (document?.querySelector(`.${component_name.value}`) as HTMLEmbedElement | null)?.getSVGDocument()
  updateButtonsState()
  updateLabelsState()
  svg?.addEventListener('mouseover', (e) => {
    const button = e.target as Element
    if (!isButtonPath(button)) return
    button.setAttribute('fill', '#2699D0')
  })
  svg?.addEventListener('mouseout', (e) => {
    const button = e.target as Element
    if (!isButtonPath(button)) return
    button.setAttribute('fill', 'transparent')
    document.body.style.cursor = 'auto'
  })
  svg?.addEventListener('mousedown', (e) => {
    const button = e.target as Element
    if (!isButtonPath(button)) return
    emit('click', findInputFromPath(button.id as string))
  })
  svg?.addEventListener('mouseup', (e) => {
    const button = e.target as Element
    if (!isButtonPath(button)) return
    button.setAttribute('fill', 'transparent')
  })
}, 100)

onBeforeUnmount(async () => {
  clearInterval(waitTimer)
})

watch(
  () => [props.leftAxisHoriz, props.leftAxisVert, props.rightAxisHoriz, props.rightAxisVert],
  () => {
    setAxes([Axis.HORIZONTAL_LEFT, Axis.VERTICAL_LEFT], [props.leftAxisHoriz ?? 0, props.leftAxisVert ?? 0] )
    setAxes([Axis.HORIZONTAL_RIGHT, Axis.VERTICAL_RIGHT], [props.rightAxisHoriz ?? 0, props.rightAxisVert ?? 0] )
  }
)

const joystick_svg_path = computed(() => {
  return `/images/${props.model}.svg`
})

watch(
  () => [
    props.b0,
    props.b1,
    props.b2,
    props.b3,
    props.b4,
    props.b5,
    props.b6,
    props.b7,
    props.b8,
    props.b9,
    props.b10,
    props.b11,
    props.b12,
    props.b13,
    props.b14,
    props.b15,
    props.b16,
    props.b17,
  ],
  () => updateButtonsState()
)

watch([props.protocolMapping, props.buttonLabelCorrespondency], () => updateLabelsState())

const updateLabelsState = (): void => {
  Object.values(Button).forEach((button) => {
    if (isNaN(Number(button))) return
    const protocolButton = props.protocolMapping.buttons[button as Button] || undefined
    let functionName = undefined
    if (props.buttonLabelCorrespondency.length === 0 || !props.buttonLabelCorrespondency.map((b) => b.input.value).includes(button)) {
      functionName = protocolButton.protocol && protocolButton.value ? `${protocolButton.value} (${protocolButton.protocol})` : 'unassigned'
    } else {
      const param = props.buttonLabelCorrespondency.find((btn) => btn.input.protocol === protocolButton.protocol && btn.input.value === protocolButton.value)
      functionName = param === undefined ? 'unassigned' : param.prettyName
    }
    if (!svg) return
    // @ts-ignore: we already check if button is a number and so if button is a valid index
    const labelId = buttonPath[button].replace('path', 'text')
    if (svg?.getElementById(labelId) === null) return
    // @ts-ignore: we already check if element exists
    svg.getElementById(labelId).textContent = functionName
    // @ts-ignore: we already check if svg is not null
    svg.getElementById(labelId)?.setAttribute('font-style', functionName === 'unassigned' ? 'italic' : 'normal')
  })
}

const updateButtonsState = (): void => {
  toggleButton(Button.B0, props.b0 === undefined ? false : props.b0 > 0.5)
  toggleButton(Button.B1, props.b1 === undefined ? false : props.b1 > 0.5)
  toggleButton(Button.B2, props.b2 === undefined ? false : props.b2 > 0.5)
  toggleButton(Button.B3, props.b3 === undefined ? false : props.b3 > 0.5)
  toggleButton(Button.B4, props.b4 === undefined ? false : props.b4 > 0.5)
  toggleButton(Button.B5, props.b5 === undefined ? false : props.b5 > 0.5)
  toggleButton(Button.B6, props.b6 === undefined ? false : props.b6 > 0.5)
  toggleButton(Button.B7, props.b7 === undefined ? false : props.b7 > 0.5)
  toggleButton(Button.B8, props.b8 === undefined ? false : props.b8 > 0.5)
  toggleButton(Button.B9, props.b9 === undefined ? false : props.b9 > 0.5)
  toggleButton(Button.B10, props.b10 === undefined ? false : props.b10 > 0.5)
  toggleButton(Button.B11, props.b11 === undefined ? false : props.b11 > 0.5)
  toggleButton(Button.B12, props.b12 === undefined ? false : props.b12 > 0.5)
  toggleButton(Button.B13, props.b13 === undefined ? false : props.b13 > 0.5)
  toggleButton(Button.B14, props.b14 === undefined ? false : props.b14 > 0.5)
  toggleButton(Button.B15, props.b15 === undefined ? false : props.b15 > 0.5)
  toggleButton(Button.B16, props.b16 === undefined ? false : props.b16 > 0.5)
  toggleButton(Button.B17, props.b17 === undefined ? false : props.b17 > 0.5)
}

/**
 * Change virtual button to on/off state
 *
 * @param {Button} button Button to be used
 * @param {boolean} state Button state
 * @returns {void}
 */
function toggleButton(button: Button, state: boolean): void {
  svg?.getElementById(buttonPath[button])?.setAttribute('fill', state ? 'red' : 'transparent')
  svg
    ?.getElementById(buttonPath[button].replace('path', 'path_line'))
    ?.setAttribute('stroke', state ? 'red' : textColor)
  svg?.getElementById(buttonPath[button].replace('path', 'text'))?.setAttribute('fill', state ? 'red' : textColor)
}

/**
 * Set axis position
 *
 * @param {[Axis.HORIZONTAL_LEFT, Axis.VERTICAL_LEFT] | [Axis.HORIZONTAL_RIGHT, Axis.VERTICAL_RIGHT]} axes Axes combination to be set
 * @param {[number, number]} horizontalValue Horizontal and vertical axes values between [-1, 1]
 * @returns {void}
 */
function setAxes(axes: [Axis.HORIZONTAL_LEFT, Axis.VERTICAL_LEFT] | [Axis.HORIZONTAL_RIGHT, Axis.VERTICAL_RIGHT], values: [number, number]): void {
  let xValue
  let yValue
  switch (props.model) {
    case Models.PS5: {
      xValue = axes[0] == Axis.HORIZONTAL_LEFT ? scale(values[0], -1, 1, -3920.9, -3882.1) : scale(values[0], -1, 1, -4144.8, -4106.1)
      yValue = scale(values[1], -1, 1, -2192.7, -2153.9)
      break
    }
    default: {
      xValue = scale(values[0], -1, 1, -15, 15)
      yValue = scale(values[1], -1, 1, -15, 15)
      break
    }
  }

  svg?.getElementById(axisPath[axes[0]])?.setAttribute('transform', `translate(${xValue} ${yValue})`)
}
</script>
