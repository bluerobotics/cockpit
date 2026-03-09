<template>
  <div ref="currentAlertBar" class="flex" :class="{ 'pointer-events-none': widgetStore.editingMode }">
    <div
      class="relative mx-1 my-1.5 w-[500px] rounded-md"
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
        class="expanded-alerts-bar absolute left-0 right-0 transition-all rounded bg-slate-800/75 select-none flex max-h-[30vh]"
        style="border: 1px solid #94a3b866"
        :class="{
          'opacity-0 invisible': !isShowingExpandedAlerts || widgetStore.editingMode,
          'flex-col': shouldExpandUpward,
          'flex-col-reverse': !shouldExpandUpward,
          'top-[46px]': !shouldExpandUpward,
          'bottom-[46px]': shouldExpandUpward,
        }"
      >
        <div class="p-2 overflow-y-auto text-slate-50 scrollbar-hide flex flex-col">
          <div v-for="(alert, i) in sortedAlertsReversed" :key="alert.time_created.toISOString()">
            <div
              :title="alert.message"
              class="flex items-center justify-between whitespace-nowrap"
              :style="alertRowHighlightStyle(alert.level)"
            >
              <p class="mx-1 overflow-hidden text-lg font-medium leading-none text-ellipsis">{{ alert.message }}</p>
              <div
                class="flex flex-col justify-center mx-1 font-mono text-xs font-semibold leading-3 text-right text-gray-100"
              >
                <p>{{ formattedDate(alert.time_created || new Date()) }}</p>
                <p>{{ alert.level.toUpperCase() }}</p>
              </div>
            </div>
            <div
              v-if="i !== alertStore.alerts.length - 1"
              class="h-px mx-1 mb-2"
              :style="{
                backgroundColor: isHighlightedLevel(alert.level) ? `${alertLevelColors[alert.level]}99` : undefined,
              }"
              :class="{ 'bg-slate-50/30': !isHighlightedLevel(alert.level) }"
            />
          </div>
        </div>
        <div
          class="flex items-center justify-center py-0.5 cursor-pointer hover:brightness-125 transition-all"
          :style="{
            [shouldExpandUpward ? 'borderTop' : 'borderBottom']: '1px solid #94a3b866',
            backgroundColor: '#94a3b866',
          }"
          @click="toggleExpandedAlertLock()"
        >
          <v-icon
            icon="mdi-arrow-vertical-lock"
            size="x-small"
            class="lock-icon transition-colors"
            :class="
              miniWidget.options.lockExpansion
                ? 'text-slate-200 hover:text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            "
          />
        </div>
      </div>
    </div>
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
import { useElementBounding, useElementHover, useTimestamp, useToggle, useWindowSize } from '@vueuse/core'
import { differenceInSeconds, format } from 'date-fns'
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { Alert, AlertLevel, alertLevelColors } from '@/types/alert'
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
miniWidget.value.options.lockExpansion ??= false

useVehicleAlerterStore()
const alertStore = useAlertStore()
const widgetStore = useWidgetManagerStore()
const timeNow = useTimestamp({ interval: 1000 })

const alertPersistencyInterval = 10 // in seconds

const formattedDate = (datetime: Date): string => format(datetime, 'HH:mm:ss')

const currentAlert = ref(alertStore.alerts[0])
const currentDisplayedAlertIndex = ref(alertStore.alerts.length - 1)

const colorCodeBorderStyle = computed(() => {
  if (currentAlert.value.level === AlertLevel.Critical) return 'border: 2px solid transparent'
  const color = alertLevelColors[currentAlert.value.level]
  return color ? `border: 2px solid ${color};` : 'border: none;'
})

const highlightedAlertLevels = [AlertLevel.Critical, AlertLevel.Error, AlertLevel.Warning]

/**
 * Returns inline styles for highlighting an alert row based on its level
 * @param {AlertLevel} level - The alert level to style
 * @returns {Record<string, string>} CSS style object with border and background tint
 */
const isHighlightedLevel = (level: AlertLevel): boolean => {
  return miniWidget.value.options.enableColorCoding && highlightedAlertLevels.includes(level)
}

/**
 * Returns inline styles for highlighting an alert row based on its level
 * @param {AlertLevel} level - The alert level to style
 * @returns {Record<string, string>} CSS style object with border and background tint
 */
const alertRowHighlightStyle = (level: AlertLevel): Record<string, string> => {
  if (!isHighlightedLevel(level)) return {}
  const color = alertLevelColors[level]
  return {
    backgroundColor: `${color}22`,
    padding: '2px',
  }
}

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

const [isShowingExpandedAlerts, toggleExpandedAlerts] = useToggle(miniWidget.value.options.lockExpansion)
const showExpandedAlerts = (): boolean => toggleExpandedAlerts(true)
const hideExpandedAlerts = (): boolean => toggleExpandedAlerts(false)

const currentAlertBar = ref<HTMLElement>()
const { top: barTop } = useElementBounding(currentAlertBar)
const { height: windowHeight } = useWindowSize()
const shouldExpandUpward = computed(() => barTop.value > windowHeight.value / 2)

const isCurrentAlertBarHovered = useElementHover(currentAlertBar)
const expandedAlertsBar = ref()
const isExpandedAlertsBarHovered = useElementHover(expandedAlertsBar)
watch(isCurrentAlertBarHovered, (isHovered, wasHovered) => {
  if (miniWidget.value.options.lockExpansion) return
  if (wasHovered && !isHovered) {
    setTimeout(() => {
      if (
        !miniWidget.value.options.lockExpansion &&
        !isExpandedAlertsBarHovered.value &&
        !isCurrentAlertBarHovered.value
      ) {
        hideExpandedAlerts()
      }
    }, 250)
  }
  if (isShowingExpandedAlerts.value) return
  showExpandedAlerts()
})
watch(isExpandedAlertsBarHovered, (isHovering, wasHovering) => {
  if (miniWidget.value.options.lockExpansion) return
  if (!(wasHovering && !isHovering)) return
  hideExpandedAlerts()
})

const toggleExpandedAlertLock = (): void => {
  miniWidget.value.options.lockExpansion = !miniWidget.value.options.lockExpansion

  if (miniWidget.value.options.lockExpansion) {
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
