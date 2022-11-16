<template>
  <v-card class="pa-2" width="100%" height="100%">
    <v-layout>
      <v-navigation-drawer>
        <v-card-title>Configuration menu</v-card-title>
        <v-divider />
        <v-list v-model:selected="currentMenuComponent">
          <v-list-item
            v-for="(menu, i) in menus"
            :key="i"
            :prepend-icon="menu.icon"
            :title="menu.title"
            :value="menu.component"
          />
        </v-list>
        <v-divider/>
        <v-list v-model:selected="currentMenuComponent">
          <v-list-item
            v-for="(menu, i) in vehicleMenus"
            :key="i"
            :prepend-icon="menu.icon"
            :title="menu.title"
            :value="menu.component"
          />
        </v-list>
      </v-navigation-drawer>
      <v-main scrollable>
        <component :is="currentMenuComponent[0]"></component>
      </v-main>
    </v-layout>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import ConfigurationFrameView from '../views/ConfigurationFrameView.vue'
import ConfigurationGeneralView from '../views/ConfigurationGeneralView.vue'
import ConfigurationJoystickView from '../views/ConfigurationJoystickView.vue'
import ConfigurationPowerView from '../views/ConfigurationPowerView.vue'
import ConfigurationSensorsView from '../views/ConfigurationSensorsView.vue'

const store = useMainVehicleStore()

const currentMenuComponent = ref([ConfigurationGeneralView])

const menus = [
  {
    icon: 'mdi-book-open-blank-variant',
    title: 'General',
    component: ConfigurationGeneralView,
  },
  {
    icon: 'mdi-altimeter',
    title: 'Sensors',
    component: ConfigurationSensorsView,
  },
  {
    icon: 'mdi-controller',
    title: 'Joystick',
    component: ConfigurationJoystickView,
  },
  {
    icon: 'mdi-tank',
    title: 'Frame',
    component: ConfigurationFrameView,
  },
  {
    icon: 'mdi-lightning-bolt',
    title: 'Power',
    component: ConfigurationPowerView,
  },
]

const vehicleMenus = computed(() => store?.configurationPages)
</script>
