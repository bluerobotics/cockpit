<template>
  <div class="rounded-full transition-width bg-[#333333EE]" :class="hovering ? 'w-[180px]' : 'w-[80px]'">
    <div class="relative flex items-start justify-start">
      <div class="dial-container">
        <div class="compass">
          <div class="wind-direction-dial-container" @mousedown="startDrag">
            <div class="dial-arrow" :style="{ transform: `rotate(${rotationAngle}deg)` }">
              <v-icon class="text-[90px] scale-x-[.4]">mdi-arrow-up-thin</v-icon>
            </div>
          </div>

          <p class="absolute top-0 left-[33px] text-[15px] pointer-events-none text-[#FFFFFF99]">N</p>
          <p class="absolute top-[25px] right-1 text-[16px] pointer-events-none text-[#FFFFFF99]">E</p>
          <p class="absolute bottom-0 left-[33px] pointer-events-none text-[#FFFFFF99]">S</p>
          <p class="absolute top-[25px] left-1 text-[15px] pointer-events-none text-[#FFFFFF99]">W</p>
        </div>
      </div>
      <div class="w-[150px] ml-auto">
        <div v-show="hovering" class="flex flex-col items-center justify-center text-white mr-[14px] mt-[10px]">
          <p class="text-xs -mb-1">Scan</p>
          <p class="text-xs -mb-1">Direction</p>
          <p class="font-bold text-[30px] text-center text-[#FFFF00]">
            {{ getCardinalDirection(rotationAngle || 0) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

/* eslint-disable jsdoc/require-jsdoc */
const props = defineProps<{
  autoUpdate?: boolean
  angle: number | undefined
  polygonState: boolean
}>()
/* eslint-enable jsdoc/require-jsdoc */

const emit = defineEmits<{
  (event: 'surveyLinesAngle', angle: number): void
  (event: 'regenerateSurveyWaypoints', angle: number): void
}>()

const rotationAngle = ref(props.angle)
const hovering = ref(false)
const polygonStateEdit = ref(props.polygonState || false)

watch(
  () => props.angle,
  (newAngle) => {
    rotationAngle.value = newAngle
  }
)

const updateLinesAngleOnParent = (): void => {
  if (props.autoUpdate && !polygonStateEdit.value && rotationAngle.value) {
    onRegenerateSurveyWaypoints(rotationAngle.value)
  }
  if (polygonStateEdit.value) {
    onSurveyLinesAngleChange(rotationAngle.value || 0)
  }
}

const startDrag = (event: MouseEvent): void => {
  hovering.value = true
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()

  const handleDrag = (moveEvent: MouseEvent): void => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = moveEvent.clientX - centerX
    const dy = moveEvent.clientY - centerY
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI
    angle = (angle + 360 + 90) % 360

    rotationAngle.value = angle
    updateLinesAngleOnParent()
  }

  const stopDrag = (): void => {
    hovering.value = false
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)
    updateLinesAngleOnParent()
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const getCardinalDirection = (angle: number): string => {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
    'N',
  ]
  const normalizedAngle = ((angle % 360) + 360) % 360
  const index = Math.round(normalizedAngle / 22.5) // 22.5 comes from 360 divided by 16, that results on the cardinal directions positions
  return directions[index]
}

const onRegenerateSurveyWaypoints = (angle: number): void => {
  emit('regenerateSurveyWaypoints', angle)
}

const onSurveyLinesAngleChange = (newAngle: number): void => {
  emit('surveyLinesAngle', newAngle)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', startDrag)
  document.removeEventListener('mouseup', startDrag)
  hovering.value = false
})
</script>

<style scoped>
.overlay {
  z-index: 100;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.transition-width {
  transition: width 0.2s ease-in-out;
  animation-delay: 1s;
}

.dial-container {
  display: flex;
  align-items: start;
  position: relative;
}

.compass {
  position: relative;
  width: 80px;
  height: 80px;
  border: 1px solid #ffffff22;
  border-radius: 50%;
  cursor: grab;
}

.wind-direction-dial-container {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
}

.dial-arrow {
  color: #ffff00;
  position: absolute;
  margin-top: -5px;
  margin-left: -5px;
  transform-origin: center;
}
</style>
