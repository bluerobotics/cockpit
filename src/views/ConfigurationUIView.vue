<template>
  <BaseConfigurationView>
    <template #title>Interface configuration</template>
    <template #content>
      <div class="max-h-[85vh] overflow-y-auto">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Window material</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px] gap-x-[85px]">
                  <div class="flex">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                    >
                      <template #activator="{ props }">
                        <div v-bind="props" class="flex cursor-pointer gap-x-[30px]">
                          <span class="text-start mt-[2px]">Glass color</span>
                          <div
                            class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg cursor-pointer"
                            :style="{ backgroundColor: interfaceStore.UIGlassEffect.bgColor }"
                          ></div>
                        </div>
                      </template>
                      <v-card class="overflow-hidden"
                        ><v-color-picker
                          v-model="interfaceStore.UIGlassEffect.bgColor"
                          width="400px"
                          mode="rgba"
                          theme="dark"
                      /></v-card>
                    </v-menu>
                  </div>
                  <div class="flex gap-x-[40px] opacity-40">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                      disabled
                    >
                      <template #activator="{ props }">
                        <div v-bind="props" class="flex gap-x-[30px]">
                          <span class="text-start mt-[2px]">Font color</span>
                          <div
                            v-bind="props"
                            class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg"
                            :style="{ backgroundColor: interfaceStore.UIGlassEffect.fontColor }"
                          ></div>
                        </div>
                      </template>
                      <v-card class="overflow-hidden"
                        ><v-color-picker
                          v-model="interfaceStore.UIGlassEffect.fontColor"
                          width="400px"
                          mode="rgba"
                          theme="dark"
                      /></v-card>
                    </v-menu>
                  </div>
                  <v-btn variant="text" size="small" @click="resetColorsToDefault">Reset to defaults</v-btn>
                </div>
                <div class="flex w-full">
                  <div class="flex w-[33%] mt-[2px]">Opacity</div>
                  <div class="flex w-[66%]">
                    <v-slider
                      :model-value="parseInt(interfaceStore.UIGlassEffect.bgColor.slice(-2), 16) / 255"
                      color="white"
                      min="0"
                      max="1"
                      step="0.01"
                      thumb-label
                      @update:model-value="updateOpacity"
                    />
                  </div>
                </div>
                <div class="flex w-full">
                  <div class="flex w-[33%] mt-[2px]">Blur</div>
                  <div class="flex w-[66%]">
                    <v-slider
                      v-model="interfaceStore.UIGlassEffect.blur"
                      color="white"
                      min="0"
                      max="50"
                      step="1"
                      thumb-label
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Menu</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px]">
                  <div class="flex w-[33%]">Main menu trigger position</div>
                  <div class="flex w-[66%]">
                    <v-radio-group
                      :model-value="interfaceStore.mainMenuStyleTrigger"
                      inline
                      hide-details
                      @update:model-value="setMainMenuTrigger"
                    >
                      <v-radio label="Center-left tab" value="center-left" />
                      <v-radio label="Top bar button" value="burger" class="ml-6" />
                    </v-radio-group>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Display units</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px]">
                  <div class="flex w-[33%]">System</div>
                  <div class="flex w-[66%] items-center">
                    <v-radio-group
                      :model-value="currentUnitSystem"
                      inline
                      hide-details
                      @update:model-value="setUnitSystem"
                    >
                      <v-radio
                        v-for="system in selectableUnitSystems"
                        :key="system"
                        :label="system"
                        :value="system"
                        class="capitalize mr-6"
                      />
                    </v-radio-group>
                    <span v-if="currentUnitSystem === UnitSystem.Custom" class="text-sm opacity-60">
                      Mixed — pick a system, or set each quantity below
                    </span>
                  </div>
                </div>
                <div
                  v-for="choice in unitChoices"
                  :key="choice.quantity"
                  class="flex flex-row justify-start items-center w-full mb-[35px]"
                >
                  <div class="flex w-[33%]">{{ choice.label }}</div>
                  <div class="flex w-[66%]">
                    <v-radio-group
                      :model-value="interfaceStore.displayUnitPreferences[choice.quantity]"
                      inline
                      hide-details
                      @update:model-value="(value: unknown) => setDisplayUnit(choice, value)"
                    >
                      <v-radio
                        v-for="choiceUnit in choice.units"
                        :key="choiceUnit"
                        :label="unitPrettyName[choiceUnit]"
                        :value="choiceUnit"
                        class="mr-6"
                      />
                    </v-radio-group>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { defaultUIGlassColor } from '@/assets/defaults'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import {
  DistanceDisplayUnit,
  PressureDisplayUnit,
  SpeedDisplayUnit,
  TemperatureDisplayUnit,
  unitPrettyName,
  UnitSystem,
  unitSystemFromPreferences,
  unitSystems,
} from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

const unitChoices = [
  { quantity: 'distance', label: 'Distance', units: Object.values(DistanceDisplayUnit) },
  { quantity: 'speed', label: 'Speed', units: Object.values(SpeedDisplayUnit) },
  { quantity: 'temperature', label: 'Temperature', units: Object.values(TemperatureDisplayUnit) },
  { quantity: 'pressure', label: 'Pressure', units: Object.values(PressureDisplayUnit) },
] as const

const selectableUnitSystems = Object.keys(unitSystems) as (keyof typeof unitSystems)[]

const currentUnitSystem = computed(() => unitSystemFromPreferences(interfaceStore.displayUnitPreferences))

const updateOpacity = (value: number): void => {
  logUserAction(`Set glass effect opacity to ${value}`)
  interfaceStore.setBgOpacity(value)
}

const resetColorsToDefault = (): void => {
  logUserAction('Reset UI glass colors to default')
  interfaceStore.UIGlassEffect = defaultUIGlassColor
}

const setMainMenuTrigger = (value: unknown): void => {
  logUserAction(`Set main menu trigger position to '${value}'`)
  interfaceStore.mainMenuStyleTrigger = value as typeof interfaceStore.mainMenuStyleTrigger
}

// Written into rather than replaced, so picking one quantity leaves the others as they were.
const setDisplayUnit = (choice: (typeof unitChoices)[number], value: unknown): void => {
  logUserAction(`Set ${choice.quantity} display unit to '${value}'`)
  Object.assign(interfaceStore.storedDisplayUnitPreferences, { [choice.quantity]: value })
}

const setUnitSystem = (value: unknown): void => {
  if (value === undefined) return
  logUserAction(`Set display units to the ${value} system`)
  Object.assign(interfaceStore.storedDisplayUnitPreferences, unitSystems[value as keyof typeof unitSystems])
}
</script>
