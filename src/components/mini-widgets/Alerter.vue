<template>
  <div ref="currentAlertBar" class="flex" :class="{ 'pointer-events-none': widgetStore.editingMode }">
    <div
      class="mx-1 my-1.5 w-[500px] rounded-md"
      :class="{ 'alert-border-blink': shouldBlinkBorder }"
      :style="miniWidget.options.enableColorCoding ? colorCodeBorderStyle : 'border: none;'"
    >
      <div
        class="flex items-center justify-between p-1 overflow-hidden rounded cursor-pointer select-none whitespace-nowrap"
        :class="shouldBlinkBorder ? 'bg-[#db151233]' : 'bg-slate-800/75'"
      >
        <p class="mx-1 overflow-hidden text-xl font-medium text-gray-100 text-ellipsis">{{ currentAlert.message }}</p>
      </div>
      <div
        ref="expandedAlertsBar"
        class="expanded-alerts-bar absolute w-full p-2 transition-all rounded top-12 max-h-[30vh] overflow-y-auto text-slate-50 scrollbar-hide bg-slate-800/75 select-none flex flex-col"
        :class="{ 'opacity-0 invisible': !isShowingExpandedAlerts }"
      >
        <div v-for="(alert, i) in sortedAlertsReversed" :key="alert.time_created.toISOString()">
          <div
            :title="alert.message"
            class="flex items-center justify-between whitespace-nowrap"
            :class="{
              'border-[1px] border-[#dc262699] bg-[#dc262622] pa-1':
                (alert.level === AlertLevel.Critical || alert.level === AlertLevel.Error) &&
                miniWidget.options.enableColorCoding,
            }"
          >
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
    <v-btn
      v-if="isShowingExpandedAlerts || lockAlertsOpened"
      icon="mdi-arrow-vertical-lock"
      variant="text"
      :color="lockAlertsOpened ? 'orange ' : 'white'"
      class="-mr-8 -ml-4 mt-[2px] bg-transparent"
      @click="toggleExpandedAlertLock()"
    ></v-btn>
  </div>

  <InteractionDialog
    v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen"
    title="Alerter options"
    max-width="400px"
    variant="text-only"
  >
    <template #content>
      <div class="flex items-start justify-between flex-col -mt-8 mb-6 pl-6">
        <v-switch
          v-model="miniWidget.options.enableColorCoding"
          hide-details
          label="Enable color coded alerts"
          color="white"
        />
        <v-switch v-model="alertStore.enableVoiceAlerts" hide-details label="Enable voice alerts" color="white" />
        <v-slider
          v-model="alertStore.alertVolume"
          min="0"
          max="1"
          step="0.05"
          hide-details
          thumb-label
          label="Alert volume"
          color="white"
          class="w-[250px] mt-2"
          :disabled="!alertStore.enableVoiceAlerts"
        />
      </div>
    </template>
    <template #actions>
      <v-btn @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false">Close</v-btn>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useElementHover, useTimestamp, useToggle } from '@vueuse/core'
import { differenceInSeconds, format } from 'date-fns'
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { Alert, AlertLevel } from '@/types/alert'
import { MiniWidget } from '@/types/widgets'

import InteractionDialog from '../InteractionDialog.vue'

/**
 * Props for the JoystickCommIndicator component
 */
const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

miniWidget.value.options.enableColorCoding ??= true

useVehicleAlerterStore()
const alertStore = useAlertStore()
const widgetStore = useWidgetManagerStore()
const timeNow = useTimestamp({ interval: 1000 })

const alertPersistencyInterval = 10 // in seconds

const formattedDate = (datetime: Date): string => format(datetime, 'HH:mm:ss')

const currentAlert = ref(alertStore.alerts[0])
const lockAlertsOpened = ref(false)
const currentDisplayedAlertIndex = ref(alertStore.alerts.length - 1)

const colorCodeBorderStyle = computed(() => {
  switch (currentAlert.value.level) {
    case AlertLevel.Critical:
      return 'border: 2px solid transparent'
    case AlertLevel.Error:
      return 'border: 2px solid #dc2626;'
    case AlertLevel.Warning:
      return 'border: 2px solid #db9340;'
    case AlertLevel.Info:
      return 'border: 2px solid #3b82f655;'
    case AlertLevel.Success:
      return 'border: 2px solid #308013;'
    default:
      return 'border: none;'
  }
})

const shouldBlinkBorder = computed<boolean>(() => {
  return miniWidget.value.options.enableColorCoding && currentAlert.value.level === AlertLevel.Critical
})

// eslint-disable-next-line no-undef
let currentAlertInterval: NodeJS.Timer | undefined = undefined
onMounted(() => {
  currentAlertInterval = setInterval(() => {
    const dateNow = new Date(timeNow.value)
    const lastAlertIndex = alertStore.alerts.length - 1
    const lastAlert = alertStore.alerts[lastAlertIndex]

    // Check if we've caught up to all alerts
    if (currentDisplayedAlertIndex.value >= lastAlertIndex) {
      // We're showing the latest alert, check if it's too old
      const secsSinceLastAlert = differenceInSeconds(dateNow, lastAlert?.time_created || dateNow)
      if (secsSinceLastAlert > alertPersistencyInterval) {
        currentAlert.value = new Alert(AlertLevel.Info, 'No recent alerts.')
        return
      }
      currentAlert.value = lastAlert!
      return
    }

    // There are newer alerts queued - advance when the current alert's speech has finished
    if (alertStore.lastSpokenAlertIndex >= currentDisplayedAlertIndex.value) {
      // Speech for current alert has finished, move to the next alert
      currentDisplayedAlertIndex.value++
      currentAlert.value = alertStore.alerts[currentDisplayedAlertIndex.value]
    }
  }, 100) // Check frequently for responsive transitions
})

onUnmounted(() => {
  clearInterval(currentAlertInterval)
})

// Watch for new alerts to ensure we start tracking from the right index
watch(
  () => alertStore.alerts.length,
  (newLength, oldLength) => {
    // If this is a new alert and we're currently showing the "no recent alerts" message,
    // jump to the new alert immediately
    if (newLength > oldLength && currentAlert.value.message === 'No recent alerts.') {
      currentDisplayedAlertIndex.value = newLength - 1
      currentAlert.value = alertStore.alerts[currentDisplayedAlertIndex.value]
    }
  }
)

const [isShowingExpandedAlerts, toggleExpandedAlerts] = useToggle()
const showExpandedAlerts = (): boolean => toggleExpandedAlerts(true)
const hideExpandedAlerts = (): boolean => toggleExpandedAlerts(false)

const currentAlertBar = ref()
const isCurrentAlertBarHovered = useElementHover(currentAlertBar)
const expandedAlertsBar = ref()
const isExpandedAlertsBarHovered = useElementHover(expandedAlertsBar)
watch(isCurrentAlertBarHovered, (isHovered, wasHovered) => {
  if (lockAlertsOpened.value) return
  if (wasHovered && !isHovered) {
    setTimeout(() => {
      if (!lockAlertsOpened.value && !isExpandedAlertsBarHovered.value && !isCurrentAlertBarHovered.value) {
        hideExpandedAlerts()
      }
    }, 250)
  }
  if (isShowingExpandedAlerts.value) return
  showExpandedAlerts()
})
watch(isExpandedAlertsBarHovered, (isHovering, wasHovering) => {
  if (lockAlertsOpened.value) return
  if (!(wasHovering && !isHovering)) return
  hideExpandedAlerts()
})

const toggleExpandedAlertLock = (): void => {
  const shouldLock = !lockAlertsOpened.value
  lockAlertsOpened.value = shouldLock

  if (shouldLock) {
    showExpandedAlerts()
    return
  }

  if (!isExpandedAlertsBarHovered.value && !isCurrentAlertBarHovered.value) {
    hideExpandedAlerts()
  }
}

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

.alert-border-blink {
  border-width: 2px;
  border-style: solid;
  animation-name: alert-border-blink;
  animation-duration: 700ms;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform, box-shadow, border-color;
}

@keyframes alert-border-blink {
  0% {
    border-color: transparent;
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
  40% {
    border-color: #f97373;
    box-shadow: 0 0 8px 2px rgba(248, 113, 113, 0.9);
  }
  70% {
    border-color: #dc2626;
    box-shadow: 0 0 1px 1px rgba(220, 38, 38, 0.7);
  }
  100% {
    border-color: transparent;
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
}
</style>
