<template>
  <BaseConfigurationView>
    <template #title>Motor configuration</template>
    <template #content>
      <span class="help-info ma-1">Here you can test the configuration of your motors and invert their direction.</span>
      <span class="help-info ma-1">
        Moving the sliders will cause the motors to spin. Make sure the motors and propellers are clear from
        obstructions! The direction of the motor rotation is dependent on how the three phases of the motor are
        physically connected to the ESCs (if any two wires are swapped, the direction of rotation will flip). Because we
        cannot guarantee what order the phases are connected, the motor directions must be configured in software. When
        a slider is moved DOWN, the thruster should push air/water TOWARD the cable entering the housing. Click the
        checkbox to reverse the direction of the corresponding thruster.
      </span>
      <span class="help-info my-1">
        Before testing the motors, you need to arm the vehicle. Be cautious as this can make the motors spin.
      </span>
      <v-switch
        v-model="vehicleStore.isArmed"
        :disabled="!vehicleStore.isVehicleOnline"
        class="mx-1 flex-grow-0"
        color="red-darken-3"
        :label="`${vehicleStore.isArmed ? 'Armed' : 'Disarmed'}`"
        hide-details
        @update:model-value="vehicleStore.isArmed ? vehicleStore.arm() : vehicleStore.disarm()"
      />
      <div class="d-flex flex-row align-center justify-space-evenly w-100 h-100">
        <div class="d-flex flex-column align-center justify-space-evenly w-50">
          <div
            v-for="motorId in [...Array(maxNumberMotors).keys()]"
            :key="motorId"
            class="flex-centered-row justify-space-between my-1"
          >
            <v-slider
              v-model="motorSliderOutputs[motorId + 1]"
              class="align-center pwm-bar"
              :min="1000"
              :max="2000"
              :step="1"
              hide-details
              thumb-label
              :color="vehicleStore.isArmed ? 'red-darken-1' : '#c3c3c3'"
              :disabled="!vehicleStore.isArmed"
              @update:model-value="restartMotorZeroer(motorId + 1)"
            />
            <span class="text-no-wrap mx-4">Motor {{ motorId + 1 }}</span>
            <v-progress-linear
              :model-value="motorOutputs[motorId]"
              height="25"
              striped
              :color="vehicleStore.isArmed ? 'red-darken-1' : '#c3c3c3'"
              class="pwm-bar"
            >
              <template #default="{ value }">
                <strong>{{ Math.ceil(value) }}%</strong>
              </template>
            </v-progress-linear>
          </div>
        </div>
      </div>
      <span class="help-info ma-6"
        >Blue Robotics thrusters are lubricated by water and are not designed to be run in air. Testing the thrusters in
        air is ok at low speeds for short periods of time. Extended operation of Blue Robotics in air may lead to
        overheating and permanent damage. Without water lubrication, Blue Robotics thrusters may also make some
        unpleasant noises when operated in air; this is normal.
      </span>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, reactive } from 'vue'

import { constrain } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import BaseConfigurationView from './BaseConfigurationView.vue'

const vehicleStore = useMainVehicleStore()

const defaultMotorSliderValue = 1500
const maxNumberMotors = 12
const motorSliderOutputs = reactive<{ [i: number]: number }>({})
const motorSliderZeroer = reactive<{ [i: number]: ReturnType<typeof setTimeout> }>({})

const makeMotorZeroed = (motorId: number): void => {
  motorSliderOutputs[motorId] = defaultMotorSliderValue
}
const restartMotorZeroer = (motorId: number): void => {
  clearInterval(motorSliderZeroer[motorId])
  motorSliderZeroer[motorId] = setTimeout(() => makeMotorZeroed(motorId), 3000)
}
for (let i = 1; i < maxNumberMotors + 1; i++) {
  makeMotorZeroed(i)
  restartMotorZeroer(i)
}

const updateMotorsState = (): void => {
  if (vehicleStore.isArmed) {
    Object.entries(motorSliderOutputs).forEach(([motor, output]) => vehicleStore.doMotorTest(Number(motor), output))
  }
}

const motorTestStateUpdater = setInterval(updateMotorsState, 100)
onBeforeMount(() => vehicleStore.disarm())
onBeforeUnmount(() => clearInterval(motorTestStateUpdater))

const scaledValue = (rawValue: number): number | undefined => {
  if (rawValue === 0) return undefined
  return constrain((100 * (rawValue - 1000)) / 1000, 0, 100)
}

const motorOutputs = computed(() => {
  return vehicleStore.servoOutput.servosValues.map((v) => scaledValue(v)).slice(0, maxNumberMotors)
})
</script>

<style scoped>
.pwm-bar {
  min-width: 200px;
}
.help-info {
  max-width: 70%;
}
</style>
