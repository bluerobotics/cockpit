<template>
  <div class="fence-expansible-wrapper -mx-2 w-auto">
    <ExpansiblePanel compact invert-chevron hover-effect elevation-effect :is-expanded="false" darken-content>
      <template #title>
        <div class="flex w-[90%] justify-between items-center text-[14px] -mb-3 font-normal ml-2">Fence parameters</div>
      </template>
      <template #content>
        <div class="flex flex-col w-full">
          <div class="flex items-start justify-between gap-x-2 px-3">
            <p v-if="!isApm && !isPx4" class="text-xs opacity-70 py-2">
              Connect a vehicle to view its geofence parameters.
            </p>
            <p v-else class="text-[11px] opacity-70 pt-2 pb-1">
              These parameters apply to all fences uploaded to the vehicle.
            </p>
            <v-tooltip location="top" text="Reload values from vehicle">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="text" size="x-small" icon class="mt-1 -mr-2" @click="onRefreshAllParams">
                  <v-icon size="14">mdi-refresh</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </div>

          <div v-if="!isApm && !isPx4 && breachOptions.length" class="px-3 pb-2 text-[11px]">
            <p class="opacity-70 mb-1">On a fence breach, the planned vehicle can be set to:</p>
            <p v-for="action in breachOptions" :key="action.value">{{ action.label }}</p>
          </div>

          <div
            v-for="param in rows"
            :key="param.name"
            class="flex w-full justify-between items-center gap-x-2 border-b-[1px] last:border-b-0 border-[#FFFFFF22] min-h-[36px] px-3"
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
              <v-select
                v-if="param.options"
                :model-value="paramValues[param.name]"
                :items="param.options"
                item-title="label"
                item-value="value"
                hide-details
                density="compact"
                theme="dark"
                variant="plain"
                center-affix
                class="flex-none w-[150px] text-xs [&_.v-field\_\_input]:py-0 [&_.v-field\_\_input]:min-h-7 [&_.v-field\_\_input]:justify-end [&_.v-field\_\_append-inner]:-translate-y-1"
                @update:model-value="(value: number) => onSelectParam(param, value)"
              >
                <template #selection="{ item }">
                  <span class="text-xs truncate">{{ item.raw.label }}</span>
                  <span class="text-[10px] opacity-60 ml-1">{{ item.raw.value }}</span>
                </template>
                <template #item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps">
                    <template #append>
                      <span class="text-[10px] opacity-60 ml-2">{{ item.raw.value }}</span>
                    </template>
                  </v-list-item>
                </template>
              </v-select>
              <input
                v-else
                type="number"
                class="p-1 bg-[#FFFFFF11] w-[90px] text-xs text-right rounded-sm"
                :min="param.min"
                :max="param.max"
                :value="paramValues[param.name] ?? ''"
                @change="onNumberInput(param, $event.target as HTMLInputElement)"
              />
            </div>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
    <InteractionDialog
      :show-dialog="pendingDriftWrite !== undefined"
      title="This leaves the boat drifting"
      variant="text-only"
      max-width="560px"
      :message="DRIFT_WARNING"
      @update:show-dialog="(open: boolean) => !open && pendingDriftWrite && closeDriftWarning(false)"
    >
      <template #actions>
        <div class="flex items-center w-full gap-x-2 px-2 pb-2">
          <v-checkbox v-model="dontShowDriftAgain" hide-details density="compact" class="flex-none">
            <template #label><span class="text-sm">Don't show again</span></template>
          </v-checkbox>
          <div class="flex-1" />
          <v-btn variant="text" size="small" @click="closeDriftWarning(false)">Cancel</v-btn>
          <v-btn size="small" class="bg-[#FFFFFF33] text-white" @click="closeDriftWarning(true)">Use this action</v-btn>
        </div>
      </template>
    </InteractionDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import { useFenceBreachAction } from '@/composables/useFenceBreachAction'
import type { MavParamType as DialectMavParamType } from '@/libs/connection/m2r/dialects/ardupilotmega/MavParamType'
import { MAVLinkType, MavParamType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { constrain } from '@/libs/utils'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { useAlertStore } from '@/stores/alert'
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
  /**
   * Lowest value the autopilot accepts, for numeric parameters.
   */
  min?: number
  /**
   * Highest value the autopilot accepts, for numeric parameters.
   */
  max?: number
  /**
   * The accepted values, for parameters picked from a list.
   */
  options?: ParamOption[]
}

/**
 * One accepted value of a list parameter.
 */
interface ParamOption {
  /**
   * Parameter value.
   */
  value: number
  /**
   * What the value does, in operator terms.
   */
  label: string
  /**
   * Whether the value leaves a boat drifting after a breach.
   */
  drifts?: boolean
}

/**
 * A fence action write held back until the operator confirms the boat drift warning.
 */
interface PendingDriftWrite {
  /**
   * The parameter to write.
   */
  param: ParamDescriptor
  /**
   * The value to write.
   */
  value: number
}

const apmParams: ParamDescriptor[] = [
  {
    name: 'FENCE_ACTION',
    description: 'What the vehicle does when it crosses the fence. The options depend on the vehicle type.',
    type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 } as DialectMavParamType,
  },
  {
    name: 'FENCE_ALT_MAX',
    description: 'Maximum altitude (meters) before the fence triggers. Numeric value, range 10 to 1000, increment 1.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
    min: 10,
    max: 1000,
  },
  {
    name: 'FENCE_ALT_MIN',
    description: 'Minimum altitude (meters) before the fence triggers. Numeric value, range -100 to 100, increment 1.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
    min: -100,
    max: 100,
  },
  {
    name: 'FENCE_MARGIN',
    description:
      'Buffer distance (meters) the autopilot tries to keep from the fence boundary to avoid breaching. Numeric value, range 1 to 10.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
    min: 1,
    max: 10,
  },
  {
    name: 'FENCE_AUTOENABLE',
    description: 'Whether the autopilot turns the fence on by itself, and when.',
    type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 } as DialectMavParamType,
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'On after an automatic takeoff' },
      { value: 2, label: 'On after an automatic takeoff, floor off when landing' },
      { value: 3, label: 'On when armed' },
    ],
  },
]

const px4Params: ParamDescriptor[] = [
  {
    name: 'GF_ACTION',
    description: 'What the vehicle does when it crosses the fence.',
    type: { type: MavParamType.MAV_PARAM_TYPE_INT32 } as DialectMavParamType,
  },
  {
    name: 'GF_MAX_HOR_DIST',
    description:
      'Maximum horizontal distance (meters) the vehicle may travel from the home position. Numeric value. 0 → no horizontal limit.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
    min: 0,
    max: 10000,
  },
  {
    name: 'GF_MAX_VER_DIST',
    description:
      'Maximum vertical distance (meters) the vehicle may travel above the home position. Numeric value. 0 → no vertical limit.',
    type: { type: MavParamType.MAV_PARAM_TYPE_REAL32 } as DialectMavParamType,
    min: 0,
    max: 1000,
  },
  {
    name: 'GF_PREDICT',
    description: 'Whether the autopilot acts as soon as a breach is predicted, rather than once it has happened.',
    type: { type: MavParamType.MAV_PARAM_TYPE_INT32 } as DialectMavParamType,
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'On' },
    ],
  },
]

const vehicleStore = useMainVehicleStore()
const alertStore = useAlertStore()
const { openSnackbar } = useSnackbar()
const { parameterName: actionParam, options: breachOptions } = useFenceBreachAction()

const paramValues = reactive<Record<string, number | undefined>>({})
const openTooltip = ref<string | null>(null)

const isApm = computed<boolean>(() => vehicleStore.mainVehicle?.firmware() === Vehicle.Firmware.ArduPilot)
const isPx4 = computed<boolean>(() => vehicleStore.mainVehicle?.firmware() === Vehicle.Firmware.PX4)
const activeParams = computed<ParamDescriptor[]>(() => (isApm.value ? apmParams : isPx4.value ? px4Params : []))

// Only what the vehicle answered for, since the parameter set differs between vehicle types and firmware versions.
const rows = computed<ParamDescriptor[]>(() => {
  const vehicleOptions: Record<string, ParamOption[]> = {}
  if (actionParam.value) vehicleOptions[actionParam.value] = breachOptions.value
  return activeParams.value
    .filter((param) => paramValues[param.name] !== undefined)
    .map((param) => {
      const options = vehicleOptions[param.name] ?? param.options
      const value = paramValues[param.name] as number
      if (!options || options.some((option) => option.value === value)) return { ...param, options }
      return { ...param, options: [...options, { value, label: 'Not used by this vehicle' }] }
    })
})

const refreshAllParams = (): void => {
  activeParams.value.forEach((p) => vehicleStore.requestParameter(p.name))
}

const onRefreshAllParams = (): void => {
  logUserAction('Reloaded the fence parameters from the vehicle')
  refreshAllParams()
}

const DRIFT_WARNING =
  'When the boat crosses the fence, this action cuts its motors. Any current, tide or wind then carries it ' +
  'further past the fence, toward whatever lies beyond, and it will not come back by itself. Unless someone ' +
  'can reach the boat quickly, pick an action that returns home or holds position instead.'

const pendingDriftWrite = ref<PendingDriftWrite>()
const dontShowDriftAgain = ref(false)

const onSelectParam = (param: ParamDescriptor, value: number): void => {
  const drifts = param.options?.find((option) => option.value === value)?.drifts
  if (!drifts || alertStore.neverShowBoatDriftFenceWarning) {
    onWriteParam(param.name, value, param.type)
    return
  }
  dontShowDriftAgain.value = false
  pendingDriftWrite.value = { param, value }
}

const closeDriftWarning = (confirmed: boolean): void => {
  const pending = pendingDriftWrite.value
  pendingDriftWrite.value = undefined
  if (!confirmed || !pending) {
    logUserAction('Kept the previous fence action after the boat drift warning')
    return
  }
  if (dontShowDriftAgain.value) {
    alertStore.neverShowBoatDriftFenceWarning = true
    logUserAction('Turned off the boat drift warning for fence actions')
  }
  onWriteParam(pending.param.name, pending.value, pending.param.type)
}

const onNumberInput = (param: ParamDescriptor, input: HTMLInputElement): void => {
  const typed = Number(input.value)
  if (input.value === '' || !Number.isFinite(typed)) return
  const value = constrain(typed, param.min ?? -Infinity, param.max ?? Infinity)
  input.value = String(value)
  onWriteParam(param.name, value, param.type)
}

const onWriteParam = (name: string, value: number, type: DialectMavParamType): void => {
  if (!vehicleStore.mainVehicle) return
  logUserAction(`Wrote fence parameter ${name} as ${value}`)
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
