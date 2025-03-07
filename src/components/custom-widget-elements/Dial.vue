<template>
  <div
    id="dial"
    class="flex items-center w-auto"
    :style="{ justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <div class="flex flex-row" :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
      <div
        class="potentiometer-container w-full"
        :class="sizeClass"
        @mousedown="startDrag"
        @click="isEditingValue = false"
      >
        <div class="potentiometer-scale elevation-5">
          <div
            class="potentiometer-knob"
            :style="{
              transform: `rotate(${rotationAngle}deg)`,
              background: miniWidget.options.layout?.knobColor || '#838383',
            }"
          >
            <div class="knob-notch" :style="{ background: miniWidget.options.layout?.notchColor || '#222222' }"></div>
          </div>
        </div>
      </div>
      <p
        v-if="miniWidget.options.layout?.minValue >= miniWidget.options.layout?.maxValue"
        class="absolute bg-[#880000] pa-2 text-xs mt-2 -ml-12 border-2 border-white rounded-md z-50"
      >
        Min value is larger than Max value
      </p>
    </div>
    <div v-if="miniWidget.options.layout?.showValue" class="flex" @keydown.esc="finishEditingValue">
      <div
        class="value-display bg-[#FFFFFF22] border-[1px] rounded-md p-[2px] min-w-[40px] text-center elevation-1"
        :class="
          isEditingValue
            ? 'pointer-events-auto border-blue-800 bg-[#0000FF11]'
            : 'cursor-pointer border-[#FFFFFF44] bg-[#FFFFFF22]'
        "
      >
        <div v-if="!isEditingValue" @click="startEditingValue">
          {{ Math.round(potentiometerValue) || 0 }}
        </div>
        <input
          v-if="isEditingValue"
          v-model="editableValue"
          class="bg-transparent border-0 text-center outline-none max-w-[30px]"
          @keydown.enter="finishEditingValue"
          @blur="finishEditingValue"
        />
      </div>
      <div class="flex flex-col w-4 h-7 justify-between items-center">
        <v-icon
          v-if="!isEditingValue"
          class="text-white text-[16px] -mt-[2px] ml-2 cursor-pointer opacity-30"
          @click="addDialValue"
          >mdi-plus</v-icon
        >
        <v-icon
          v-if="!isEditingValue"
          class="text-white text-[16px] -mb-1 ml-2 cursor-pointer opacity-30"
          @click="subtractDialValue"
          >mdi-minus</v-icon
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import { listenDataLakeVariable, setDataLakeVariableData, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Dial]
}>()

const miniWidget = toRefs(props).miniWidget

const potentiometerValue = ref(0)
const rotationAngle = ref(-150)
let listenerId: string | undefined
const isEditingValue = ref(false)
const editableValue = ref(String(Math.round(potentiometerValue.value) || 0))

watch(
  () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  (newValue) => {
    if (newValue === true) {
      widgetStore.showElementPropsDrawer(miniWidget.value.hash)
      setTimeout(() => {
        widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
      }, 200)
    }
  },
  { immediate: true, deep: true }
)

const setDialValue = (value: number | string | undefined): void => {
  let numValue: number
  if (value === undefined || value === null || isNaN(Number(value))) {
    numValue = miniWidget.value.options.layout?.minValue || 0
  } else {
    numValue = Number(value)
  }

  potentiometerValue.value = numValue

  const rotationRange = 300
  const minVal = miniWidget.value.options.layout?.minValue || 0
  const maxVal = miniWidget.value.options.layout?.maxValue || 100
  const valueRange = maxVal - minVal

  rotationAngle.value = ((numValue - minVal) / valueRange) * rotationRange - 150
}

const startListeningDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable?.name, (value) => {
      setDialValue(value as number)
    })
    const initialValue = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    setDialValue(initialValue)
  }
}

watch(
  () => miniWidget.value.options.dataLakeVariable?.name,
  (newVal) => {
    if (newVal) {
      startListeningDataLakeVariable()
    }
  },
  { immediate: true }
)

watch(
  () => [miniWidget.value.options.layout?.minValue, miniWidget.value.options.layout?.maxValue],
  () => {
    potentiometerValue.value = miniWidget.value.options.layout?.minValue || 0
    setDialValue(potentiometerValue.value)
  },
  { immediate: true }
)

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        minValue: 0,
        maxValue: 100,
        size: 'small',
        showValue: true,
        align: 'center',
        knobColor: '#838383',
        notchColor: '#303030aa',
      },
      variableType: 'number',
      dataLakeVariable: undefined,
    })
  }
  startListeningDataLakeVariable()
})

const sizeClass = computed(() => {
  switch (miniWidget.value.options.layout?.size) {
    case 'medium':
      return 'potentiometer-medium'
    case 'large':
      return 'potentiometer-large'
    default:
      return 'potentiometer-small'
  }
})

let lastMouseAngle = 0
let lastUnwrappedAngle = 0

const updateDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable && !widgetStore.editingMode) {
    const roundedValue = Math.round(potentiometerValue.value)
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, roundedValue)
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, roundedValue)
  }
}

const startDrag = (event: MouseEvent): void => {
  event.preventDefault()

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const initialMouseAngle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI

  lastMouseAngle = initialMouseAngle
  lastUnwrappedAngle = initialMouseAngle

  const initialKnobAngle = rotationAngle.value

  const offsetAngle = initialKnobAngle - initialMouseAngle

  const handleDrag = (moveEvent: MouseEvent): void => {
    const rawAngle = (Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180) / Math.PI

    let angleDiff = rawAngle - lastMouseAngle
    if (angleDiff > 180) angleDiff -= 360
    else if (angleDiff < -180) angleDiff += 360

    const unwrappedAngle = lastUnwrappedAngle + angleDiff

    lastMouseAngle = rawAngle
    lastUnwrappedAngle = unwrappedAngle

    let newRotationAngle = unwrappedAngle + offsetAngle

    newRotationAngle = Math.max(-150, Math.min(150, newRotationAngle))

    rotationAngle.value = newRotationAngle

    const rotationRange = 300
    const minVal = miniWidget.value.options.layout?.minValue || 0
    const maxVal = miniWidget.value.options.layout?.maxValue || 100
    const valueRange = maxVal - minVal

    potentiometerValue.value = ((newRotationAngle + 150) / rotationRange) * valueRange + minVal

    if (miniWidget.value.options.dataLakeVariable) {
      updateDataLakeVariable()
    }
  }

  const stopDrag = (): void => {
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const addDialValue = (): void => {
  const maxVal = miniWidget.value.options.layout?.maxValue || 100
  if (potentiometerValue.value < maxVal) {
    setDialValue(potentiometerValue.value + 1)
    updateDataLakeVariable()
  }
}

const subtractDialValue = (): void => {
  const minVal = miniWidget.value.options.layout?.minValue || 0
  if (potentiometerValue.value > minVal) {
    setDialValue(potentiometerValue.value - 1)
    updateDataLakeVariable()
  }
}

const startEditingValue = (): void => {
  if (widgetStore.editingMode) return
  isEditingValue.value = true

  editableValue.value = String(Math.round(potentiometerValue.value) || 0)
}

const finishEditingValue = (): void => {
  let newValue = parseFloat(editableValue.value)
  if (isNaN(newValue)) {
    newValue = Math.round(potentiometerValue.value) || 0
  }
  const minVal = miniWidget.value.options.layout?.minValue || 0
  const maxVal = miniWidget.value.options.layout?.maxValue || 100

  if (newValue > maxVal) newValue = maxVal
  if (newValue < minVal) newValue = minVal

  setDialValue(newValue)
  if (miniWidget.value.options.dataLakeVariable && !widgetStore.editingMode) {
    const roundedValue = Math.round(newValue)
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, roundedValue)
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, roundedValue)
  }

  isEditingValue.value = false
}

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable) {
    if (listenerId) {
      unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.name, listenerId)
    }
  }
})
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
  border-radius: 50%;
  transform: translateX(-50%);
}

.value-display {
  font-size: 14px;
  color: white;
  margin-left: 8px;
}
</style>
