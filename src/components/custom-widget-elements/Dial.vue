<template>
  <div
    id="dial"
    class="flex items-center w-auto"
    :style="{ justifyContent: element.options.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div class="flex flex-row" :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
      <div class="potentiometer-container w-full" :class="sizeClass" @mousedown="startDrag">
        <div class="potentiometer-scale elevation-5">
          <div class="potentiometer-knob" :style="{ transform: `rotate(${rotationAngle}deg)` }">
            <div class="knob-notch"></div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="element.options.showValue"
      class="value-display bg-[#FFFFFF22] border-[#FFFFFF44] border-[1px] rounded-md p-[2px] min-w-9 text-center elevation-1"
    >
      {{ Math.round(potentiometerValue) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRefs } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Dial]
}>()

const element = toRefs(props).element

const potentiometerValue = ref(0)
const rotationAngle = ref(-150)

onMounted(() => {
  if (!element.value.options || Object.keys(element.value.options).length === 0) {
    widgetStore.updateElementOptions(element.value.hash, {
      minValue: 0,
      maxValue: 100,
      size: 'small',
      showValue: true,
      cockpitAction: element.value.options.cockpitAction || '',
      align: 'center',
    })
  }
})

const sizeClass = computed(() => {
  switch (element.value.options.size) {
    case 'medium':
      return 'potentiometer-medium'
    case 'large':
      return 'potentiometer-large'
    default:
      return 'potentiometer-small'
  }
})

const startDrag = (event: MouseEvent): void => {
  event.preventDefault()

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()

  const handleDrag = (moveEvent: MouseEvent): void => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = moveEvent.clientX - centerX
    const dy = moveEvent.clientY - centerY

    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    const adjustedAngle = Math.max(-150, Math.min(150, angle))

    rotationAngle.value = adjustedAngle

    const rotationRange = 300
    const valueRange = element.value.options.maxValue - element.value.options.minValue
    potentiometerValue.value = ((adjustedAngle + 150) / rotationRange) * valueRange + element.value.options.minValue
  }

  const stopDrag = (): void => {
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}
</script>

<style scoped>
.potentiometer-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
}

.potentiometer-small {
  width: 50px;
  height: 50px;
}

.potentiometer-medium {
  width: 75px;
  height: 75px;
}

.potentiometer-large {
  width: 120px;
  height: 120px;
}

.potentiometer-scale {
  width: 80%;
  height: 80%;
  background-size: contain;
  background-repeat: no-repeat;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  position: relative;
}

.potentiometer-knob {
  width: 100%;
  height: 100%;
  background-color: #838383;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
}

.knob-notch {
  position: absolute;
  top: 10%;
  left: 50%;
  width: 15%;
  height: 15%;
  background-color: #303030aa;
  border-radius: 50%;
  transform: translateX(-50%);
}

.value-display {
  font-size: 14px;
  color: white;
  margin-left: 8px;
}
</style>
