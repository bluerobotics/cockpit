<template>
  <object :class="[component_name, { 'opacity-50': disabled }]" type="image/svg+xml" :data="joystick_svg_path" />
</template>

<script setup lang="ts">
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { JoystickModel } from '@/libs/joystick/manager'
import { scale } from '@/libs/utils'
import {
  type JoystickButtonActionCorrespondency,
  type JoystickInput,
  JoystickAxis,
  JoystickButton,
} from '@/types/joystick'
import { InputType } from '@/types/joystick'

const textColor = 'white'

/**
 * Joystick SVG models
 */
enum SVGModel {
  PS4 = 'PS4',
  PS5 = 'PS5',
  LogitechExtreme3DPro = 'LogitechExtreme3DPro',
  IPEGAPG9023 = 'Ipega9023',
}

const joystickSvgModel = computed(() => {
  switch (joystickModel.value) {
    case JoystickModel.LogitechExtreme3DPro:
      return SVGModel.LogitechExtreme3DPro
    case JoystickModel.IpegaPG9023:
      return SVGModel.IPEGAPG9023
    default:
      return SVGModel.PS4
  }
})

const buttonPath: { [key in JoystickButton]: string } = {
  [JoystickButton.B0]: 'path_b0',
  [JoystickButton.B1]: 'path_b1',
  [JoystickButton.B2]: 'path_b2',
  [JoystickButton.B3]: 'path_b3',
  [JoystickButton.B4]: 'path_b4',
  [JoystickButton.B5]: 'path_b5',
  [JoystickButton.B6]: 'path_b6',
  [JoystickButton.B7]: 'path_b7',
  [JoystickButton.B8]: 'path_b8',
  [JoystickButton.B9]: 'path_b9',
  [JoystickButton.B10]: 'path_b10',
  [JoystickButton.B11]: 'path_b11',
  [JoystickButton.B12]: 'path_b12',
  [JoystickButton.B13]: 'path_b13',
  [JoystickButton.B14]: 'path_b14',
  [JoystickButton.B15]: 'path_b15',
  [JoystickButton.B16]: 'path_b16',
  [JoystickButton.B17]: 'path_b17',
}

const axisPath = computed((): { [key in JoystickAxis]: string } => {
  switch (joystickSvgModel.value) {
    case SVGModel.LogitechExtreme3DPro:
      return {
        [JoystickAxis.A0]: 'path_b14',
        [JoystickAxis.A1]: 'path_b14',
        [JoystickAxis.A2]: 'path_b13',
        [JoystickAxis.A3]: 'path_b12',
      }
    default:
      return {
        [JoystickAxis.A0]: 'path_b10',
        [JoystickAxis.A1]: 'path_b10',
        [JoystickAxis.A2]: 'path_b11',
        [JoystickAxis.A3]: 'path_b11',
      }
  }
})

/* eslint-disable  */
const props = defineProps<{
  model: string // Joystick model
  disabled?: boolean // Whether the joystick is disabled
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
  buttonsActionsCorrespondency: JoystickButtonActionCorrespondency // Mapping from the Cockpit standard to the protocol functions
}>()

const emit = defineEmits<{
  // eslint-disable-next-line
  (e: 'click', inputs: any): void
}>()

const findInputFromPath = (path: string): JoystickInput[] => {
  const inputs: JoystickInput[] = []
  Object.entries(buttonPath)
    .filter(([, v]) => v === path)
    .forEach((button) => {
      inputs.push({ type: InputType.Button, id: button[0] as unknown as JoystickButton })
    })
  Object.entries(axisPath.value)
    .filter(([, v]) => v === path)
    .forEach((axis) => {
      inputs.push({ type: InputType.Axis, id: axis[0] as unknown as JoystickAxis })
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
    button.setAttribute('fill', '#A6DAEF')
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
    setAxes([JoystickAxis.A0, JoystickAxis.A1], [props.leftAxisHoriz ?? 0, props.leftAxisVert ?? 0])
    setAxes([JoystickAxis.A2, JoystickAxis.A3], [props.rightAxisHoriz ?? 0, props.rightAxisVert ?? 0])
  }
)

const joystick_svg_path = computed(() => {
  return `./images/${joystickSvgModel.value}.svg`
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

const joystickModel = toRefs(props).model
const buttonsActionsCorrespondency = toRefs(props).buttonsActionsCorrespondency
watch(buttonsActionsCorrespondency, () => updateLabelsState())

const updateLabelsState = (): void => {
  Object.values(JoystickButton).forEach((button) => {
    if (isNaN(Number(button))) return
    const buttonActionCorrespondency = buttonsActionsCorrespondency.value[button as JoystickButton] || undefined
    const functionName =
      buttonActionCorrespondency === undefined ? 'unassigned' : buttonActionCorrespondency.action.name
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
  toggleButton(JoystickButton.B0, props.b0 === undefined ? false : props.b0 > 0.5)
  toggleButton(JoystickButton.B1, props.b1 === undefined ? false : props.b1 > 0.5)
  toggleButton(JoystickButton.B2, props.b2 === undefined ? false : props.b2 > 0.5)
  toggleButton(JoystickButton.B3, props.b3 === undefined ? false : props.b3 > 0.5)
  toggleButton(JoystickButton.B4, props.b4 === undefined ? false : props.b4 > 0.5)
  toggleButton(JoystickButton.B5, props.b5 === undefined ? false : props.b5 > 0.5)
  toggleButton(JoystickButton.B6, props.b6 === undefined ? false : props.b6 > 0.5)
  toggleButton(JoystickButton.B7, props.b7 === undefined ? false : props.b7 > 0.5)
  toggleButton(JoystickButton.B8, props.b8 === undefined ? false : props.b8 > 0.5)
  toggleButton(JoystickButton.B9, props.b9 === undefined ? false : props.b9 > 0.5)
  toggleButton(JoystickButton.B10, props.b10 === undefined ? false : props.b10 > 0.5)
  toggleButton(JoystickButton.B11, props.b11 === undefined ? false : props.b11 > 0.5)
  toggleButton(JoystickButton.B12, props.b12 === undefined ? false : props.b12 > 0.5)
  toggleButton(JoystickButton.B13, props.b13 === undefined ? false : props.b13 > 0.5)
  toggleButton(JoystickButton.B14, props.b14 === undefined ? false : props.b14 > 0.5)
  toggleButton(JoystickButton.B15, props.b15 === undefined ? false : props.b15 > 0.5)
  toggleButton(JoystickButton.B16, props.b16 === undefined ? false : props.b16 > 0.5)
  toggleButton(JoystickButton.B17, props.b17 === undefined ? false : props.b17 > 0.5)
}

/**
 * Change virtual button to on/off state
 *
 * @param {JoystickButton} button Button to be used
 * @param {boolean} state Button state
 * @returns {void}
 */
function toggleButton(button: JoystickButton, state: boolean): void {
  svg?.getElementById(buttonPath[button])?.setAttribute('fill', state ? 'red' : 'transparent')
  svg
    ?.getElementById(buttonPath[button].replace('path', 'path_line'))
    ?.setAttribute('stroke', state ? 'red' : textColor)
  svg?.getElementById(buttonPath[button].replace('path', 'text'))?.setAttribute('fill', state ? 'red' : textColor)
}

/**
 * Set axis position
 *
 * @param {[JoystickAxis.A0, JoystickAxis.A1] | [JoystickAxis.A2, JoystickAxis.A3]} axes Axes combination to be set
 * @param {[number, number]} horizontalValue Horizontal and vertical axes values between [-1, 1]
 * @returns {void}
 */
function setAxes(
  axes: [JoystickAxis.A0, JoystickAxis.A1] | [JoystickAxis.A2, JoystickAxis.A3],
  values: [number, number]
): void {
  let xValue
  let yValue
  switch (joystickModel.value) {
    case SVGModel.PS5: {
      xValue =
        axes[0] == JoystickAxis.A0
          ? scale(values[0], -1, 1, -3920.9, -3882.1)
          : scale(values[0], -1, 1, -4144.8, -4106.1)
      yValue = scale(values[1], -1, 1, -2192.7, -2153.9)
      break
    }
    case SVGModel.LogitechExtreme3DPro: {
      xValue = scale(values[0], -1, 1, -15, 15)
      yValue = scale(values[1], -1, 1, -15, 15)
      break
    }
    default: {
      xValue = scale(values[0], -1, 1, -15, 15)
      yValue = scale(values[1], -1, 1, -15, 15)
      break
    }
  }

  svg?.getElementById(axisPath.value[axes[0]])?.setAttribute('transform', `translate(${xValue} ${yValue})`)
}
</script>
