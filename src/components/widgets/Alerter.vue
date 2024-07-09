<template>
  <div class="relative mx-1 my-1.5 max-w-[25%] flex-grow">
    <div
      ref="currentAlertBar"
      class="flex cursor-pointer select-none items-center justify-between overflow-hidden whitespace-nowrap rounded bg-slate-800/75 p-1"
    >
      <p class="mx-1 overflow-hidden text-xl font-medium text-gray-100">{{ currentAlert.message }}</p>
      <div class="mx-1 flex flex-col justify-center text-right font-mono text-xs font-semibold leading-3 text-gray-100">
        <p>{{ formattedDate(currentAlert.time_created || new Date()) }}</p>
        <p>{{ currentAlert.level.toUpperCase() }}</p>
      </div>
    </div>
    <div
      ref="expandedAlertsBar"
      class="expanded-alerts-bar absolute top-12 flex max-h-[30vh] w-full select-none flex-col overflow-y-auto rounded bg-slate-800/75 p-2 text-slate-50 transition-all scrollbar-hide"
      :class="{ 'invisible opacity-0': !isShowingExpandedAlerts }"
    >
      <div v-for="(alert, i) in sortedAlertsReversed" :key="alert.time_created.toISOString()">
        <div v-tooltip.right="alert.message" class="flex items-center justify-between whitespace-nowrap">
          <p class="mx-1 overflow-hidden text-ellipsis text-lg font-medium leading-none">{{ alert.message }}</p>
          <div
            class="mx-1 flex flex-col justify-center text-right font-mono text-xs font-semibold leading-3 text-gray-100"
          >
            <p>{{ formattedDate(alert.time_created || new Date()) }}</p>
            <p>{{ alert.level.toUpperCase() }}</p>
          </div>
        </div>
        <div v-if="i !== alertStore.alerts.length - 1" class="mx-1 mb-2 h-px bg-slate-50/30" />
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
