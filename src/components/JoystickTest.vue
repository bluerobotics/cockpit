<template>
  <div v-if="isElectron()" class="joystick-test">
    <div class="joystick-header">
      <div class="joystick-name">{{ currentDevice || 'No joystick connected' }}</div>
      <v-btn icon="mdi-close" variant="text" color="white" size="small" class="close-button" @click="emit('close')" />
    </div>
    <div class="joystick-container">
      <div class="section-title">Raw SDL State</div>

      <div class="state-grid">
        <!-- Raw SDL Axes -->
        <div class="section">
          <h3>SDL Axes</h3>
          <div class="axes-grid">
            <div v-for="(value, name) in rawState?.axes" :key="name" class="axis-item">
              <div class="axis-name">{{ name }}</div>
              <div class="axis-value">{{ value.toFixed(2) }}</div>
              <div class="axis-bar" :style="{ width: `${((value + 1) / 2) * 100}%` }"></div>
            </div>
          </div>
        </div>

        <!-- Raw SDL Buttons -->
        <div class="section">
          <h3>SDL Buttons</h3>
          <div class="buttons-grid">
            <div v-for="(value, name) in rawState?.buttons" :key="name" class="button-item" :class="{ active: value }">
              <div class="button-name">{{ name }}</div>
              <div class="button-state">{{ value ? 'Pressed' : 'Released' }}</div>
            </div>
          </div>
        </div>

        <!-- Processed Gamepad Axes -->
        <div class="section">
          <h3>Gamepad Axes</h3>
          <div class="axes-grid">
            <div v-for="(value, index) in gamepadState?.axes" :key="`axis-${index}`" class="axis-item">
              <div class="axis-name">Axis {{ index }}</div>
              <div class="axis-value">{{ value.toFixed(2) }}</div>
              <div class="axis-bar" :style="{ width: `${((value + 1) / 2) * 100}%` }"></div>
            </div>
          </div>
        </div>

        <!-- Processed Gamepad Buttons -->
        <div class="section">
          <h3>Gamepad Buttons</h3>
          <div class="buttons-grid">
            <div
              v-for="(button, index) in gamepadState?.buttons"
              :key="`button-${index}`"
              class="button-item"
              :class="{ active: button.pressed }"
            >
              <div class="button-name">Button {{ index }}</div>
              <div class="button-state">{{ button.pressed ? 'Pressed' : 'Released' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { joystickManager } from '@/libs/joystick/manager'
import { isElectron } from '@/libs/utils'
import type { SDLControllerState } from '@/types/sdl'

const currentDevice = ref<string>('')
const rawState = ref<SDLControllerState | null>(null)
const gamepadState = ref<Gamepad | null>(null)

const emit = defineEmits<{
  (e: 'close'): void
}>()

/**
 * Set up joystick state listener when component is mounted
 */
onMounted(() => {
  if (!isElectron()) return

  joystickManager.onJoystickStateUpdate((event) => {
    currentDevice.value = event.gamepad.id
    gamepadState.value = event.gamepad
    rawState.value = event.rawState || null
  })
})

/**
 * Clean up event listeners when component is unmounted
 */
onUnmounted(() => {
  // No cleanup needed since we don't need to unsubscribe from joystickManager
})
</script>

<style scoped>
.joystick-test {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  color: white;
  font-family: monospace;
  max-height: 90vh;
  overflow-y: auto;
  width: fit-content;
}

.joystick-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.close-button {
  margin-left: 10px;
}

.joystick-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.joystick-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin-top: 10px;
  margin-bottom: 5px;
  border-bottom: 1px solid #666;
  width: 100%;
  text-align: center;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.section {
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section h3 {
  margin: 0;
  font-size: 14px;
  color: #aaa;
}

.axes-grid,
.buttons-grid {
  display: grid;
  gap: 8px;
}

.axis-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.axis-name {
  font-size: 11px;
  color: #aaa;
}

.axis-value {
  font-size: 11px;
  font-family: monospace;
}

.axis-bar {
  height: 3px;
  background: #4caf50;
  border-radius: 2px;
  transition: width 0.1s ease-out;
}

.button-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  transition: background-color 0.1s ease-out;
}

.button-item.active {
  background: rgba(76, 175, 80, 0.3);
}

.button-name {
  font-size: 11px;
  color: #aaa;
}

.button-state {
  font-size: 11px;
  font-family: monospace;
}
</style>
