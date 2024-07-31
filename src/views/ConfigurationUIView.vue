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
                <div class="flex flex-row justify-start items-center w-full mb-[35px] gap-x-[115px]">
                  <div class="flex gap-x-[50px]">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                    >
                      <template #activator="{ props }">
                        <span class="text-start -mt-1">Glass color</span>
                        <div
                          v-bind="props"
                          class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
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
                  <div class="flex gap-x-[50px] opacity-40">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                      disabled
                    >
                      <template #activator="{ props }">
                        <span class="text-start -mt-1">Font color</span>
                        <div
                          v-bind="props"
                          class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full"
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
                    <v-radio-group v-model="interfaceStore.mainMenuStyleTrigger" inline hide-details>
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
                  <div class="flex w-[33%]">Distance</div>
                  <div class="flex w-[66%]">
                    <v-radio-group v-model="interfaceStore.displayUnitPreferences.distance" inline hide-details>
                      <v-radio
                        :label="unitPrettyName[DistanceDisplayUnit.Meters]"
                        :value="DistanceDisplayUnit.Meters"
                      />
                      <v-radio
                        :label="unitPrettyName[DistanceDisplayUnit.Feet]"
                        :value="DistanceDisplayUnit.Feet"
                        class="ml-6"
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
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { DistanceDisplayUnit, unitPrettyName } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

const updateOpacity = (value: number): void => {
  interfaceStore.setBgOpacity(value)
}
</script>
