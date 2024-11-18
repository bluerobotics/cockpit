<template>
  <div class="mx-1 my-1.5 w-[500px]">
    <div
      ref="currentAlertBar"
      class="flex items-center justify-between p-1 overflow-hidden rounded cursor-pointer select-none whitespace-nowrap bg-slate-800/75"
    >
      <p class="mx-1 overflow-hidden text-xl font-medium text-gray-100 text-ellipsis">{{ currentAlert.message }}</p>
      <div class="flex flex-col justify-center mx-1 font-mono text-xs font-semibold leading-3 text-right text-gray-100">
        <p>{{ formattedDate(currentAlert.time_created || new Date()) }}</p>
        <p>{{ currentAlert.level.toUpperCase() }}</p>
      </div>
    </div>
    <div
      ref="expandedAlertsBar"
      class="expanded-alerts-bar absolute w-full p-2 transition-all rounded top-12 max-h-[30vh] overflow-y-auto text-slate-50 scrollbar-hide bg-slate-800/75 select-none flex flex-col"
      :class="{ 'opacity-0 invisible': !isShowingExpandedAlerts }"
    >
      <div v-for="(alert, i) in sortedAlertsReversed" :key="alert.time_created.toISOString()">
        <div :title="alert.message" class="flex items-center justify-between whitespace-nowrap">
          <p class="mx-1 overflow-hidden text-lg font-medium leading-none text-ellipsis">{{ alert.message }}</p>
          <div
            class="flex flex-col justify-center mx-1 font-mono text-xs font-semibold leading-3 text-right text-gray-100"
          >
            <p>{{ formattedDate(alert.time_created || new Date()) }}</p>
            <p>{{ alert.level.toUpperCase() }}</p>
          </div>
        </div>
        <div v-if="i !== alertStore.alerts.length - 1" class="h-px mx-1 mb-2 bg-slate-50/30" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementHover, useTimestamp, useToggle } from '@vueuse/core'
import { differenceInSeconds, format } from 'date-fns'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'
import { Alert, AlertLevel } from '@/types/alert'

useVehicleAlerterStore()
const alertStore = useAlertStore()
const timeNow = useTimestamp({ interval: 1000 })
const alertPersistencyInterval = 10 // in seconds

const formattedDate = (datetime: Date): string => format(datetime, 'HH:mm:ss')

const currentAlert = ref(alertStore.alerts[0])

// eslint-disable-next-line no-undef
let currentAlertInterval: NodeJS.Timer | undefined = undefined
onMounted(() => {
  currentAlertInterval = setInterval(() => {
    const dateNow = new Date(timeNow.value)
    const secsSinceLastAlert = differenceInSeconds(dateNow, alertStore.alerts.last()?.time_created || dateNow)
    if (secsSinceLastAlert > alertPersistencyInterval) {
      currentAlert.value = new Alert(AlertLevel.Info, 'No recent alerts.')
      return
    }
    currentAlert.value = alertStore.alerts.last()!
  }, 1000)
})

onUnmounted(() => {
  clearInterval(currentAlertInterval)
})

const [isShowingExpandedAlerts, toggleExpandedAlerts] = useToggle()

const currentAlertBar = ref()
const isCurrentAlertBarHovered = useElementHover(currentAlertBar)
const expandedAlertsBar = ref()
const isExpandedAlertsBarHovered = useElementHover(expandedAlertsBar)
watch(isCurrentAlertBarHovered, (isHovered, wasHovered) => {
  if (wasHovered && !isHovered) {
    setTimeout(() => {
      if (!isExpandedAlertsBarHovered.value && !isCurrentAlertBarHovered.value && isShowingExpandedAlerts.value) {
        toggleExpandedAlerts()
      }
    }, 250)
  }
  if (isShowingExpandedAlerts.value) return
  toggleExpandedAlerts()
})
watch(isExpandedAlertsBarHovered, (isHovering, wasHovering) => {
  if (!(wasHovering && !isHovering)) return
  toggleExpandedAlerts()
})

const sortedAlertsReversed = computed(() => {
  // We copy the sortedAlerts list before reversing it, otherwise the reverse function, which
  // is performed in-place, will mutate the original list, and be sorted again, and mutate, and
  // sort, in an infinite loop that will crash the app.
  return [...alertStore.sortedAlerts].reverse()
})
</script>

<style scoped>
.expanded-alerts-bar[invisible] {
  display: none;
}
</style>
