<template>
  <div class="relative mb-10">
    <object
      :class="component_name"
      type="image/svg+xml"
      :data="joystick_svg_path"
      class="w-[140%] h-[120%] -ml-[21%]"
    />
    <!-- Modifier indicator in bottom left corner -->
    <div
      class="absolute bottom-2 left-2 text-white text-xs px-2 py-1 rounded-full font-bold uppercase"
      :class="modifier === CockpitModifierKeyOption.shift ? 'bg-purple-600' : 'bg-blue-600'"
    >
      {{ modifier }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuid4 } from 'uuid'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { CockpitModifierKeyOption, JoystickButton } from '@/types/joystick'

/**
 * Props interface for the JoystickButtonIndicator component
 */
interface Props {
  /**
   * The button number to highlight (0-17)
   */
  buttonNumber: number
  /**
   * The modifier key for this button mapping
   */
  modifier?: CockpitModifierKeyOption
}

/**
 * Props for the JoystickButtonIndicator component
 */
const props = withDefaults(defineProps<Props>(), {
  modifier: CockpitModifierKeyOption.regular,
})

const component_name = ref(`joystick-indicator-${uuid4()}`)

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

const joystick_svg_path = computed(() => {
  return './images/PS4.svg'
})

// Get the highlight color based on modifier
const highlightColor = computed(() => {
  return props.modifier === CockpitModifierKeyOption.shift ? '#9333ea' : '#2c99ce' // Purple for shift, blue for regular
})

// Wait for svg to be available and highlight the button
let waitTimer: ReturnType<typeof setInterval>
let svg: Document | null | undefined

const highlightButton = (): void => {
  if (!svg) return

  // Reset all buttons to default state and hide labels and lines
  Object.values(JoystickButton).forEach((button) => {
    if (isNaN(Number(button))) return
    const buttonId = buttonPath[button as JoystickButton]
    svg?.getElementById(buttonId)?.setAttribute('fill', 'transparent')
    // Hide the lines and text labels
    svg?.getElementById(buttonId.replace('path', 'path_line'))?.setAttribute('visibility', 'hidden')
    svg?.getElementById(buttonId.replace('path', 'text'))?.setAttribute('visibility', 'hidden')
  })

  // Highlight the specific button with appropriate color
  const targetButtonId = buttonPath[props.buttonNumber as JoystickButton]
  if (targetButtonId) {
    svg?.getElementById(targetButtonId)?.setAttribute('fill', highlightColor.value)
    // Keep the lines and text labels hidden even for the highlighted button
    svg?.getElementById(targetButtonId.replace('path', 'path_line'))?.setAttribute('visibility', 'hidden')
    svg?.getElementById(targetButtonId.replace('path', 'text'))?.setAttribute('visibility', 'hidden')
  }
}

// Wait for object to be loaded
waitTimer = setInterval(() => {
  if (svg) return
  svg = (document?.querySelector(`.${component_name.value}`) as HTMLEmbedElement | null)?.getSVGDocument()
  if (svg) {
    highlightButton()
  }
}, 100)

// Watch for button number or modifier changes
watch(
  () => [props.buttonNumber, props.modifier],
  () => {
    highlightButton()
  }
)

onBeforeUnmount(() => {
  clearInterval(waitTimer)
})
</script>
