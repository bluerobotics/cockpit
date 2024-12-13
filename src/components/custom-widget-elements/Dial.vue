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
      <div class="potentiometer-container w-full" :class="sizeClass" @mousedown="startDrag">
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
    </div>
    <div
      v-if="miniWidget.options.layout?.showValue"
      class="value-display bg-[#FFFFFF22] border-[#FFFFFF44] border-[1px] rounded-md p-[2px] min-w-9 text-center elevation-1"
    >
      {{ Math.round(potentiometerValue) || 0 }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  deleteDataLakeVariable,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
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
  const valueRange = miniWidget.value.options.layout?.maxValue - miniWidget.value.options.layout?.minValue || 1
  rotationAngle.value = ((numValue - miniWidget.value.options.layout?.minValue) / valueRange) * rotationRange - 150
}

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
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable?.name, (value) => {
      setDialValue(value as number)
    })
    const initialValue = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    setDialValue(initialValue)
  }
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

const startDrag = (event: MouseEvent): void => {
  event.preventDefault()

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const dxStart = event.clientX - centerX
  const dyStart = event.clientY - centerY
  const initialMouseAngle = Math.atan2(dyStart, dxStart) * (180 / Math.PI)

  const initialRotationAngle = rotationAngle.value

  const handleDrag = (moveEvent: MouseEvent): void => {
    const dx = moveEvent.clientX - centerX
    const dy = moveEvent.clientY - centerY

    const currentMouseAngle = Math.atan2(dy, dx) * (180 / Math.PI)

    let angleDifference = currentMouseAngle - initialMouseAngle

    if (angleDifference > 180) {
      angleDifference -= 360
    } else if (angleDifference < -180) {
      angleDifference += 360
    }

    let newRotationAngle = initialRotationAngle + angleDifference

    newRotationAngle = Math.max(-150, Math.min(150, newRotationAngle))

    rotationAngle.value = newRotationAngle

    const rotationRange = 300
    const valueRange = miniWidget.value.options.layout?.maxValue - miniWidget.value.options.layout?.minValue || 1
    potentiometerValue.value =
      ((newRotationAngle + 150) / rotationRange) * valueRange + miniWidget.value.options.layout?.minValue

    if (miniWidget.value.options.dataLakeVariable) {
      if (widgetStore.editingMode) return
      widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, Math.round(potentiometerValue.value))
      setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, Math.round(potentiometerValue.value))
    }
  }

  const stopDrag = (): void => {
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable) {
    deleteDataLakeVariable(miniWidget.value.options.dataLakeVariable.id)
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
