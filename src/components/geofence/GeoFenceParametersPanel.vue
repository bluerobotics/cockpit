<template>
  <div class="fence-expansible-wrapper -mx-2 w-auto">
    <ExpansiblePanel compact invert-chevron hover-effect elevation-effect :is-expanded="false" darken-content>
      <template #title>
        <div class="flex w-[90%] justify-between items-center text-[14px] -mb-3 font-normal ml-2">Fence parameters</div>
      </template>
      <template #content>
        <div class="flex flex-col w-full">
          <p v-if="!isApm && !isPx4" class="text-xs opacity-70 px-3 py-2">
            Connect a vehicle to view its geofence parameters.
          </p>
          <p v-else class="text-[11px] opacity-70 px-3 pt-2 pb-1">
            These parameters apply to all fences uploaded to the vehicle.
          </p>

          <div
            v-for="param in activeParams"
            :key="param.name"
            class="flex w-full justify-between items-center border-b-[1px] border-[#FFFFFF22] h-[36px] px-3"
          >
            <p class="text-start text-[12px] flex-1 truncate">{{ param.name }}</p>
            <div class="flex items-center gap-x-2">
              <v-tooltip
                location="left"
                max-width="320"
                :open-on-hover="false"
                open-on-click
                :model-value="openTooltip === param.name"
                @update:model-value="
                  (v) => (openTooltip = v ? param.name : openTooltip === param.name ? null : openTooltip)
                "
              >
                <template #activator="{ props }">
                  <v-icon v-bind="props" size="14" class="text-slate-400 cursor-pointer opacity-70 hover:opacity-100">
                    mdi-information-outline
                  </v-icon>
                </template>
                <div class="text-xs whitespace-pre-line pa-1 leading-snug">{{ param.description }}</div>
              </v-tooltip>
              <input
                type="number"
                class="p-1 bg-[#FFFFFF11] w-[90px] text-xs text-right rounded-sm"
                :value="paramValues[param.name] ?? ''"
                @change="onWriteParam(param.name, ($event.target as HTMLInputElement).value, param.type)"
              />
            </div>
          </div>

          <div class="flex flex-row justify-end px-3 py-2">
            <v-tooltip location="top" text="Reload values from vehicle">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="text" size="x-small" icon @click="refreshAllParams">
                  <v-icon size="14">mdi-refresh</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import type { MavParamType as DialectMavParamType } from '@/libs/connection/m2r/dialects/ardupilotmega/MavParamType'
import { MAVLinkType, MavParamType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { useMainVehicleStore } from '@/stores/mainVehicle'

/**
 * Static metadata for an autopilot parameter exposed in the fence parameters
 * panel — name, human-readable description, expected MAVLink datatype, and
 * the firmware family it belongs to. The runtime value lives in `paramValues`.
 */
interface ParamDescriptor {
  /**
   * Onboard parameter name (max 16 chars).
   */
  name: string
  /**
   * Short user-facing description.
   */
  description: string
  /**
   * Underlying parameter encoding type, wrapped in the tagged-union form
   * expected by the MAVLink parameter API.
   */
  type: DialectMavParamType
}

const apmParams: ParamDescriptor[] = [
  {
    name: 'FENCE_ACTION',
    description: [
      'Action taken when the fence is breached. Available values vary by vehicle type:',
      '0 → Report only (no autopilot reaction).',
      '1 → RTL, falling back to Land if RTL is unavailable.',
      '2 → Always Land (Copter only).',
      '3 → SmartRTL, falling back to RTL or Land (Copter only).',
      '4 → Brake, falling back to Land (Copter only).',
      '5 → SmartRTL, falling back to Land (Copter only).',
      '6 → Switch to Guided mode (Plane only).',
      '7 → Switch to Guided mode while passing pilot throttle (Plane only).',
    ].join('\n'),
    type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 } as DialectMavParamType,
  },
  {
    name: 'FENCE_ALT_MAX',
    description: 'Maximum altitude (meters) before the fence triggers. Numeric value, range 10 to 1000, increment 1.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
  },
  {
    name: 'FENCE_ALT_MIN',
    description: 'Minimum altitude (meters) before the fence triggers. Numeric value, range -100 to 100, increment 1.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
  },
  {
    name: 'FENCE_MARGIN',
    description:
      'Buffer distance (meters) the autopilot tries to keep from the fence boundary to avoid breaching. Numeric value, range 1 to 10.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
  },
  {
    name: 'FENCE_AUTOENABLE',
    description: [
      'Controls whether the fence is automatically enabled by the autopilot:',
      '0 → Off (only enabled manually via FENCE_ENABLE).',
      '1 → Auto-enable on takeoff once the configured altitude is reached.',
      '2 → Auto-enable on takeoff; the minimum-altitude floor is disabled during landing.',
      '3 → Auto-enable as soon as the vehicle is armed.',
    ].join('\n'),
    type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 } as DialectMavParamType,
  },
]

const px4Params: ParamDescriptor[] = [
  {
    name: 'GF_ACTION',
    description: [
      'Action taken when the fence is breached:',
      '0 → None (no autopilot reaction).',
      '1 → Warning only (notification, no behavior change).',
      '2 → Hold (switch to Hold mode and stop in place).',
      '3 → Return (switch to Return mode / RTL).',
      '4 → Terminate (immediate flight termination, vehicle disarm/crash).',
      '5 → Land (switch to Land mode at current position).',
    ].join('\n'),
    type: { type: MavParamType.MAV_PARAM_TYPE_INT32 } as DialectMavParamType,
  },
  {
    name: 'GF_MAX_HOR_DIST',
    description:
      'Maximum horizontal distance (meters) the vehicle may travel from the home position. Numeric value. 0 → no horizontal limit.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
  },
  {
    name: 'GF_MAX_VER_DIST',
    description:
      'Maximum vertical distance (meters) the vehicle may travel above the home position. Numeric value. 0 → no vertical limit.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
  },
  {
    name: 'GF_PREDICT',
    description: [
      'Predictive geofence breach detection. The autopilot acts based on the projected position when enabled:',
      '0 → Disabled (act only after a breach has occurred).',
      '1 → Enabled (act as soon as a breach is predicted).',
    ].join('\n'),
    type: { type: MavParamType.MAV_PARAM_TYPE_INT32 } as DialectMavParamType,
  },
]

const vehicleStore = useMainVehicleStore()
const { openSnackbar } = useSnackbar()

const paramValues = reactive<Record<string, number | undefined>>({})
const openTooltip = ref<string | null>(null)

const isApm = computed<boolean>(() => vehicleStore.mainVehicle?.firmware() === Vehicle.Firmware.ArduPilot)
const isPx4 = computed<boolean>(() => vehicleStore.mainVehicle?.firmware() === Vehicle.Firmware.PX4)
const activeParams = computed<ParamDescriptor[]>(() => (isApm.value ? apmParams : isPx4.value ? px4Params : []))

const refreshAllParams = (): void => {
  activeParams.value.forEach((p) => vehicleStore.requestParameter(p.name))
}

const onWriteParam = (name: string, valueStr: string, type: DialectMavParamType): void => {
  if (!vehicleStore.mainVehicle) return
  const value = Number(valueStr)
  if (!Number.isFinite(value)) return
  try {
    vehicleStore.mainVehicle.setParameter({ id: name, value, type })
    paramValues[name] = value
    // The write may be rejected on the wire (out-of-range, read-only); request
    // the value back so the PARAM_VALUE reply reconciles the optimistic update.
    vehicleStore.requestParameter(name)
  } catch (error) {
    openSnackbar({
      variant: 'error',
      message: `Failed to write ${name}: ${error instanceof Error ? error.message : String(error)}`,
      duration: 4000,
    })
  }
}

// Captured separately so it can be unsubscribed on unmount; otherwise every
// remount of this panel adds another listener that lives for the vehicle's
// lifetime.
const onParamValueMessage = (pack: {
  /**
   * Decoded MAVLink message payload. We narrow it inside the handler to the
   * subset of `PARAM_VALUE` fields we actually consume.
   */
  message: unknown
}): void => {
  const message = pack.message as {
    /**
     * Parameter id as a 16-byte char array (NUL-padded).
     */
    param_id: string[]
    /**
     * Current value of the parameter, encoded as a number regardless of
     * the underlying `param_type`.
     */
    param_value: number
  }
  const name = message.param_id.join('').replace(/\0/g, '')
  if (apmParams.some((p) => p.name === name) || px4Params.some((p) => p.name === name)) {
    paramValues[name] = Number(message.param_value)
  }
}

// Track which vehicle the PARAM_VALUE listener is currently attached to so
// reconnections or vehicle switches detach from the previous instance and
// (re)attach to the new one — otherwise the panel goes stale on the new link.
let attachedVehicle: typeof vehicleStore.mainVehicle | undefined

const attachToVehicle = (vehicle: typeof vehicleStore.mainVehicle | undefined): void => {
  if (attachedVehicle === vehicle) return
  attachedVehicle?.onIncomingMAVLinkMessage.remove(MAVLinkType.PARAM_VALUE, onParamValueMessage)
  attachedVehicle = vehicle
  attachedVehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.PARAM_VALUE, onParamValueMessage)
}

onMounted(() => {
  attachToVehicle(vehicleStore.mainVehicle)
  refreshAllParams()
})

onBeforeUnmount(() => {
  attachToVehicle(undefined)
})

watch(
  () => vehicleStore.mainVehicle,
  (vehicle) => {
    attachToVehicle(vehicle)
    refreshAllParams()
  }
)
watch(() => vehicleStore.firmwareType, refreshAllParams)
</script>

<style scoped>
.fence-expansible-wrapper :deep(.content-expand-collapse) {
  padding-left: 0;
  padding-right: 0;
}
</style>
