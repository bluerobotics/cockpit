<template>
  <div class="flex items-center">
    <v-menu v-model="menu" :close-on-content-click="false" location="end">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          size="default"
          variant="elevated"
          :style="{
            backgroundColor: buttonBackgroundColor,
          }"
          :disabled="dataStatus === 'error'"
        >
          <v-icon class="mr-2">{{ statusIcon }}</v-icon>
          EKF
          <v-icon v-if="dataStatus === 'loading'" class="ml-2 animate-spin">mdi-loading</v-icon>
          <v-icon v-if="dataStatus === 'error'" class="ml-2">mdi-connection</v-icon>
        </v-btn>
      </template>

      <v-card min-width="420" min-height="280" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-text class="pa-3">
          <div v-if="dataStatus === 'error'" class="text-center mb-3">
            <v-alert type="warning" density="compact" class="text-sm"> No EKF data - Check vehicle connection </v-alert>
          </div>
          <div v-else-if="dataStatus === 'loading'" class="text-center mb-3">
            <v-progress-circular indeterminate size="20" width="2" class="mr-2" />
            <span class="text-sm text-white opacity-70">Waiting for EKF data...</span>
          </div>
          <div class="d-flex">
            <!-- EKF Bars Section -->
            <div class="bars-container">
              <div v-for="(bar, index) in ekfBars" :key="index" class="bar-wrapper">
                <div class="ekf-bar-container">
                  <div class="ekf-bar">
                    <!-- Bar fill based on value and thresholds -->
                    <div
                      class="bar-fill"
                      :class="getBarColorClass(bar.value)"
                      :style="{ height: `${Math.min(bar.value * 100, 100)}%` }"
                    />
                    <!-- Threshold lines -->
                    <div class="threshold-line threshold-50" />
                    <div class="threshold-line threshold-80" />
                    <!-- Value indicator line -->
                    <div class="value-indicator" :style="{ bottom: `${Math.min(bar.value * 100, 100)}%` }" />
                  </div>
                  <div class="bar-value">{{ bar.value.toFixed(1) }}</div>
                </div>
                <div class="bar-label">
                  {{ bar.label }}
                </div>
              </div>
            </div>

            <!-- Flags Section -->
            <div class="flags-section">
              <div class="flags-grid">
                <div v-for="(flag, key) in ekfFlags" :key="key" class="flag-item">
                  <v-tooltip :text="getFlagTooltip(key)" location="left">
                    <template #activator="{ props: tooltipProps }">
                      <div v-bind="tooltipProps" class="flag-content">
                        <v-icon
                          :icon="getFlagIcon(key, flag)"
                          :class="getFlagColorClass(key, flag)"
                          size="small"
                          class="mr-2"
                        />
                        <span class="flag-name">{{ key }}</span>
                      </div>
                    </template>
                  </v-tooltip>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

import { listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
const menu = ref(false)
const listeners = ref<Map<string, string>>(new Map())
const dataStatus = ref<'loading' | 'connected' | 'error'>('loading')

// EKF bar data
const ekfBars = reactive([
  { label: 'Velocity', value: 0.0 },
  { label: 'Position (Horiz)', value: 0.0 },
  { label: 'Position (Vert)', value: 0.0 },
  { label: 'Compass', value: 0.0 },
  { label: 'Terrain', value: 0.0 },
])

// EKF flags data
const ekfFlags = reactive({
  attitude: false,
  velocity_horiz: false,
  velocity_vert: false,
  pos_horiz_rel: false,
  pos_horiz_abs: false,
  pos_vert_abs: false,
  pos_vert_agl: false,
  const_pos_mode: false,
  pred_pos_horiz_rel: false,
  pred_pos_horiz_abs: false,
  uninitialized: false,
  gps_glitching: false,
})

const getBarColorClass = (value: number): string => {
  if (value <= 0.5) return 'bar-green'
  if (value <= 0.8) return 'bar-orange'
  return 'bar-red'
}

const getFlagColorClass = (key: string, flag: boolean): string => {
  if (key === 'gps_glitching' || key === 'uninitialized') {
    return flag ? 'flag-error' : 'flag-good'
  }
  return flag ? 'flag-good' : 'flag-error'
}

const getFlagIcon = (key: string, flag: boolean): string => {
  return flag ? 'mdi-checkbox-marked-circle' : 'mdi-close-thick'
}

const getFlagTooltip = (key: string): string => {
  const tooltips: Record<string, string> = {
    attitude: 'EKF attitude estimate quality - indicates how well the system knows its orientation (roll, pitch, yaw)',
    velocity_horiz: 'EKF horizontal velocity estimate quality - indicates confidence in horizontal speed measurements',
    velocity_vert: 'EKF vertical velocity estimate quality - indicates confidence in vertical speed measurements',
    pos_horiz_rel:
      'EKF horizontal position (relative) estimate quality - confidence in relative positioning from starting point',
    pos_horiz_abs: 'EKF horizontal position (absolute) estimate quality - confidence in GPS-based absolute positioning',
    pos_vert_abs: 'EKF vertical position (absolute) estimate quality - confidence in altitude measurements',
    pos_vert_agl: 'EKF vertical position (above ground) estimate quality - confidence in height above terrain',
    const_pos_mode: 'EKF constant position mode - system assumes stationary position when other estimates are poor',
    pred_pos_horiz_rel:
      'EKF predicted horizontal position (relative) estimate quality - confidence in future relative position',
    pred_pos_horiz_abs:
      'EKF predicted horizontal position (absolute) estimate quality - confidence in future absolute position',
    uninitialized: 'EKF initialization status - whether the Extended Kalman Filter has been properly initialized',
    gps_glitching: 'GPS health status - whether the EKF detects problems with GPS input data',
  }
  return tooltips[key] || 'EKF status flag'
}

const worstStatusBackgroundColor = computed(() => {
  const hasRedBar = ekfBars.some((bar) => bar.value > 0.8)
  if (hasRedBar) return 'rgba(255, 51, 51, 0.7)'

  const hasOrangeBar = ekfBars.some((bar) => bar.value > 0.5 && bar.value <= 0.8)
  if (hasOrangeBar) return 'rgba(251, 146, 60, 0.7)'

  return 'rgba(74, 222, 128, 0.7)'
})

const statusIcon = computed(() => {
  if (dataStatus.value === 'loading') return 'mdi-dots-horizontal'
  if (dataStatus.value === 'error') return 'mdi-alert-circle'

  const hasRedBar = ekfBars.some((bar) => bar.value > 0.8)
  if (hasRedBar) return 'mdi-alert'

  const hasOrangeBar = ekfBars.some((bar) => bar.value > 0.5 && bar.value <= 0.8)
  if (hasOrangeBar) return 'mdi-alert'

  return 'mdi-check-bold'
})

const buttonBackgroundColor = computed(() => {
  if (dataStatus.value === 'loading') return 'rgba(255, 255, 255, 0.1)'
  if (dataStatus.value === 'error') return 'rgba(255, 51, 51, 0.7)'
  return worstStatusBackgroundColor.value
})

const startListeningDataLakeVariables = (): void => {
  // Listen to EKF flags
  const flagsListenerId = listenDataLakeVariable('EKF_STATUS_REPORT/flags', (value) => {
    if (typeof value === 'number') {
      ekfFlags.attitude = !!(value & 1)
      ekfFlags.velocity_horiz = !!(value & 2)
      ekfFlags.velocity_vert = !!(value & 4)
      ekfFlags.pos_horiz_rel = !!(value & 8)
      ekfFlags.pos_horiz_abs = !!(value & 16)
      ekfFlags.pos_vert_abs = !!(value & 32)
      ekfFlags.pos_vert_agl = !!(value & 64)
      ekfFlags.const_pos_mode = !!(value & 128)
      ekfFlags.pred_pos_horiz_rel = !!(value & 256)
      ekfFlags.pred_pos_horiz_abs = !!(value & 512)
      ekfFlags.uninitialized = !!(value & 1024)
      ekfFlags.gps_glitching = !!(value & 32768)

      dataStatus.value = 'connected'
    }
  })
  if (flagsListenerId) listeners.value.set('EKF_STATUS_REPORT/flags', flagsListenerId)

  // Listen to EKF variance values
  const varianceFields = [
    'velocity_variance',
    'pos_horiz_variance',
    'pos_vert_variance',
    'compass_variance',
    'terrain_alt_variance',
  ]

  varianceFields.forEach((field, index) => {
    const listenerId = listenDataLakeVariable(`EKF_STATUS_REPORT/${field}`, (value) => {
      if (typeof value === 'number' && ekfBars[index]) {
        ekfBars[index].value = Math.sqrt(value)
        dataStatus.value = 'connected'
      }
    })
    if (listenerId) listeners.value.set(`EKF_STATUS_REPORT/${field}`, listenerId)
  })
}

onMounted(() => {
  startListeningDataLakeVariables()
})

onUnmounted(() => {
  listeners.value.forEach((id, variableName) => {
    try {
      unlistenDataLakeVariable(variableName, id)
    } catch (error) {
      console.warn(`Failed to unregister listener for ${variableName}:`, error)
    }
  })
  listeners.value.clear()
})
</script>

<style scoped>
.bars-container {
  display: flex;
  align-items: end;
  flex: 1;
  padding-right: 24px;
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.ekf-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 160px;
  justify-content: flex-end;
}

.ekf-bar {
  width: 28px;
  height: 120px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  transition: height 0.3s ease, background-color 0.3s ease;
  border-radius: 0 0 5px 5px;
}

.bar-green {
  background: rgba(76, 175, 80, 0.8);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

.bar-orange {
  background: rgba(255, 152, 0, 0.8);
  box-shadow: 0 0 8px rgba(255, 152, 0, 0.4);
}

.bar-red {
  background: rgba(244, 67, 54, 0.8);
  box-shadow: 0 0 8px rgba(244, 67, 54, 0.4);
}

.threshold-line {
  position: absolute;
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.4);
  left: 0;
}

.threshold-50 {
  bottom: 50%;
}

.threshold-80 {
  bottom: 80%;
}

.value-indicator {
  position: absolute;
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.9);
  left: 0;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
  transition: bottom 0.3s ease;
}

.bar-value {
  color: white;
  font-weight: 600;
  font-size: 12px;
  margin-top: 6px;
  text-align: center;
  min-height: 16px;
}

.bar-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 10px;
  text-align: center;
  margin-top: 4px;
  line-height: 1.1;
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flags-section {
  min-width: 160px;
  padding-left: 16px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.flags-grid {
  display: flex;
  flex-direction: column;
}

.flag-item {
  display: flex;
  align-items: center;
  min-height: 18px;
}

.flag-content {
  display: flex;
  align-items: center;
}

.flag-good {
  color: rgba(76, 175, 80, 0.9) !important;
}

.flag-error {
  color: rgba(244, 67, 54, 0.9) !important;
}

.flag-name {
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
  text-align: left;
}
</style>
