<template>
  <div class="main-style">
    <h3 class="center">Joysticks</h3>

    <div v-if="joysticks && !joysticks.length" class="pos-fixed pos-center">
      <h2 class="warning">
        No joystick detected.<br />
        Make sure that a joystick is connected. You can hit any key to test the
        joystick connection.
      </h2>
    </div>

    <div
      v-for="(joystick, index) in joysticks"
      :key="'joystick' + index"
      class="center"
    >
      <div style="width: 100%" class="center">
        {{ joystick.id }}
        <div style="margin-left: 1em">
          <JoystickAxis
            class="joystick-box"
            :x-axis="joystick.axes[0]"
            :y-axis="joystick.axes[1]"
            :calibration="calibrationLeft.map((point): [number, number] => [point.x, point.y])"
          />
          <JoystickAxis
            class="joystick-box"
            :x-axis="joystick.axes[2]"
            :y-axis="joystick.axes[3]"
            :calibration="calibrationRight.map((point): [number, number] => [point.x, point.y])"
          />
        </div>
      </div>
      <v-container class="d-flex flex-wrap">
        <v-checkbox
          v-for="(button, buttonIndex) in joystick.buttons"
          :key="buttonIndex"
          v-model="button.pressed"
          :label="`Button ${buttonIndex}`"
          :hide-details="true"
        >
        </v-checkbox>
      </v-container>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Ref, onMounted, ref } from 'vue'

import {
  type JoystickEvent,
  EventType,
  JoystickDetail,
  joystickManager,
} from '@/libs/joystick/manager'

import JoystickAxis from './JoystickAxis.vue'
/**
 * Simple Point abstraction
 */
interface Point {
  /**
   * Horizontal axis
   */
  x: number

  /**
   * Vertical axis
   */
  y: number
}

const joysticks = ref<Array<Gamepad>>([])
const calibrationLeft = ref<Array<Point>>(new Array(50).fill({ x: 0, y: 0 }))
const calibrationRight = ref<Array<Point>>(new Array(50).fill({ x: 0, y: 0 }))

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
  joystickManager.onJoystickStateUpdate((event) => {
    processJoystickStateEvent(event)
  })
})

const processJoystickEvent = (event: Array<Gamepad>): void => {
  joysticks.value = event
}

const processJoystickStateEvent = (event: JoystickEvent): void => {
  joysticks.value[event.detail.index] = event.detail.gamepad
  if (event.type == EventType.Axis) {
    processAxisCalibration(event)
  }
}

const processAxisCalibration = (event: JoystickEvent): void => {
  const checkAndUpdateCalibration = (
    point: Point,
    calibrationVector: Ref<Array<Point>>
  ): void => {
    // Remove low values
    if (Math.abs(point.x) < 0.1 && Math.abs(point.y) < 0.1) {
      return
    }

    // Calculate index based on angle
    const angle = Math.atan2(point.x, point.y)
    const index = Math.floor(
      ((calibrationVector.value.length - 1) * (angle + Math.PI)) / (2 * Math.PI)
    )
    const arrayPoint = calibrationVector.value[index]

    // Check if the new point is better than the previous one
    const distance = Math.hypot(point.x, point.y)
    const arrayPointDistance = Math.hypot(arrayPoint.x, arrayPoint.y)

    if (isNaN(arrayPointDistance) || arrayPointDistance < distance) {
      calibrationVector.value[index] = point
    }
  }

  switch (event.detail.stick) {
    case JoystickDetail.Stick.Left: {
      const newPoint = {
        x: event.detail.gamepad.axes[0],
        y: event.detail.gamepad.axes[1],
      }

      checkAndUpdateCalibration(newPoint, calibrationLeft)
      break
    }

    case JoystickDetail.Stick.Right: {
      const newPoint = {
        x: event.detail.gamepad.axes[2],
        y: event.detail.gamepad.axes[3],
      }

      checkAndUpdateCalibration(newPoint, calibrationRight)
      break
    }
  }
}
</script>

<style scoped>
.main-style {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.joystick-box {
  position: relative;
  height: 11em;
  width: 11em;
  display: inline-block;
  border: 0.1em solid rgba(0, 0, 0, 0.1);
}
</style>
