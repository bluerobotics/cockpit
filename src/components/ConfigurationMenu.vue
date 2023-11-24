<template>
  <v-card width="100%" height="100%">
    <v-layout>
      <v-navigation-drawer permanent :rail="mdAndDown" :expand-on-hover="mdAndDown" :elevation="mdAndDown ? 5 : 0">
        <v-list v-model:selected="currentMenuComponent">
          <v-list-item prepend-icon="mdi-view-dashboard" title="Configuration menu" />
          <v-divider />
          <v-list-item
            v-for="(menu, i) in menus"
            :key="i"
            :prepend-icon="menu.icon"
            :title="menu.title"
            :value="menu.component"
          />
        </v-list>
        <v-divider />
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
import { useDisplay } from 'vuetify'

import { useMainVehicleStore } from '@/stores/mainVehicle'

import ConfigurationAlertsView from '../views/ConfigurationAlertsView.vue'
import ConfigurationDevelopmentView from '../views/ConfigurationDevelopmentView.vue'
import ConfigurationGeneralView from '../views/ConfigurationGeneralView.vue'
import ConfigurationJoystickView from '../views/ConfigurationJoystickView.vue'
import ConfigurationLogsView from '../views/ConfigurationLogsView.vue'

const store = useMainVehicleStore()

const currentMenuComponent = ref([ConfigurationGeneralView])
const { mdAndDown } = useDisplay()

const menus = [
  {
    icon: 'mdi-book-open-blank-variant',
    title: 'General',
    component: ConfigurationGeneralView,
  },
  {
    icon: 'mdi-controller',
    title: 'Joystick',
    component: ConfigurationJoystickView,
  },
  {
    icon: 'mdi-script',
    title: 'Logs',
    component: ConfigurationLogsView,
  },
  {
    icon: 'mdi-bell-ring',
    title: 'Alerts',
    component: ConfigurationAlertsView,
  },
  {
    icon: 'mdi-dev-to',
    title: 'Development',
    component: ConfigurationDevelopmentView,
  },
]

const vehicleMenus = computed(() => store?.configurationPages)
</script>
