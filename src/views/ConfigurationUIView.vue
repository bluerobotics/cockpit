<template>
  <BaseConfigurationView>
    <template #title>Interface configuration</template>
    <template #content>
      <div class="max-h-[85vh] overflow-y-auto" :class="{ [contentSizedLayout]: !interfaceStore.isOnPhoneScreen }">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Window material</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-3">
                <div class="flex flex-row items-center w-full mb-3">
                  <div class="flex w-56 shrink-0">Glass color</div>
                  <v-menu
                    :close-on-content-click="false"
                    location="top start"
                    origin="top start"
                    transition="scale-transition"
                    class="overflow-hidden"
                  >
                    <template #activator="{ props }">
                      <div
                        v-bind="props"
                        class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg cursor-pointer"
                        :style="{ backgroundColor: interfaceStore.UIGlassEffect.bgColor }"
                      ></div>
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
                <div class="flex flex-row items-center w-full mb-3 opacity-40">
                  <div class="flex w-56 shrink-0">Font color</div>
                  <v-menu
                    :close-on-content-click="false"
                    location="top start"
                    origin="top start"
                    transition="scale-transition"
                    class="overflow-hidden"
                    disabled
                  >
                    <template #activator="{ props }">
                      <div
                        v-bind="props"
                        class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg"
                        :style="{ backgroundColor: interfaceStore.UIGlassEffect.fontColor }"
                      ></div>
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
                <div class="flex w-full mb-3">
                  <div class="flex w-56 shrink-0 mt-[2px]">Opacity</div>
                  <div class="flex flex-1">
                    <v-slider
                      :model-value="parseInt(interfaceStore.UIGlassEffect.bgColor.slice(-2), 16) / 255"
                      color="white"
                      min="0"
                      max="1"
                      step="0.01"
                      thumb-label
                      hide-details
                      @update:model-value="updateOpacity"
                    />
                  </div>
                </div>
                <div class="flex w-full mb-2">
                  <div class="flex w-56 shrink-0 mt-[2px]">Blur</div>
                  <div class="flex flex-1">
                    <v-slider
                      v-model="interfaceStore.UIGlassEffect.blur"
                      color="white"
                      min="0"
                      max="50"
                      step="1"
                      thumb-label
                      hide-details
                    />
                  </div>
                </div>
                <div class="flex w-full mb-4">
                  <v-btn variant="text" size="small" class="-ml-3" @click="resetColorsToDefault"
                    >Reset to defaults</v-btn
                  >
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Menu</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-3">
                <div class="flex flex-row justify-start items-center w-full mb-4">
                  <div class="flex w-56 shrink-0">Main menu trigger position</div>
                  <div class="flex flex-1">
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
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Display units</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-3">
                <div class="flex flex-row justify-start items-center w-full mb-4">
                  <div class="flex w-56 shrink-0">System</div>
                  <div class="flex flex-1 items-center">
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
                  v-for="choice in shownUnitChoices"
                  :key="choice.quantity"
                  class="flex flex-row justify-start items-center w-full mb-4"
                >
                  <div class="flex w-56 shrink-0">{{ choice.label }}</div>
                  <div class="flex flex-1">
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
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Performance</template>
          <template #info>
            When enabled, only the view you are looking at stays loaded. Widgets on other views start again when you
            switch to them. Opening Mission planning also unloads the flight widgets until you come back. Turn this on
            if this computer slows down with several views.
          </template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-[10px]">
                <v-switch
                  :model-value="widgetStore.unmountHiddenViews"
                  label="Unload hidden views"
                  color="white"
                  hide-details
                  base-color="#FFFFFF33"
                  class="-mb-2 ml-3"
                  @update:model-value="widgetStore.setUnmountHiddenViews"
                />
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
  type HeightDisplayUnit,
  AreaDisplayUnit,
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
import { useWidgetManagerStore } from '@/stores/widgetManager'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

// The page is as wide as its longest row of units, kept on one line, and a collapsed info text would otherwise set
// the width by the length of its paragraph.
const contentSizedLayout =
  '[&_.v-selection-control-group]:flex-nowrap [&_.info-container]:w-0 [&_.info-container]:min-w-full'

const heightUnits: HeightDisplayUnit[] = [DistanceDisplayUnit.Meters, DistanceDisplayUnit.Feet]

const unitChoices = [
  { quantity: 'distance', label: 'Distance', units: Object.values(DistanceDisplayUnit) },
  { quantity: 'smallDistance', label: 'Distances under 1 nmi', units: Object.values(DistanceDisplayUnit) },
  { quantity: 'depth', label: 'Depth', units: heightUnits },
  { quantity: 'altitude', label: 'Altitude', units: heightUnits },
  { quantity: 'area', label: 'Area', units: Object.values(AreaDisplayUnit) },
  { quantity: 'smallArea', label: 'Areas under 1 nmi²', units: Object.values(AreaDisplayUnit) },
  { quantity: 'speed', label: 'Speed', units: Object.values(SpeedDisplayUnit) },
  { quantity: 'temperature', label: 'Temperature', units: Object.values(TemperatureDisplayUnit) },
  { quantity: 'pressure', label: 'Pressure', units: Object.values(PressureDisplayUnit) },
] as const

// The units for small quantities only apply while the larger one is read in nautical miles.
const shownUnitChoices = computed(() => {
  const preferences = interfaceStore.displayUnitPreferences
  return unitChoices.filter((choice) => {
    if (choice.quantity === 'smallDistance') return preferences.distance === DistanceDisplayUnit.NauticalMiles
    if (choice.quantity === 'smallArea') return preferences.area === AreaDisplayUnit.SquareNauticalMiles
    return true
  })
})

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
