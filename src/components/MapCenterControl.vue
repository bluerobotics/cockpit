<template>
  <v-speed-dial v-model="speedDialOpen" location="top center" transition="slide-y-reverse-transition">
    <template #activator="{ props: activatorProps }">
      <v-tooltip location="top center" :text="centerActivatorTooltipText" :disabled="speedDialOpen">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="{ ...activatorProps, ...tooltipProps }"
            class="absolute right-[44px] m-3 rounded-sm shadow-sm bg-slate-50 text-[14px]"
            :style="[interfaceStore.globalGlassMenuStyles, { zIndex: 1002 }, activatorStyle ?? {}]"
            :color="followerTarget !== undefined ? 'red' : ''"
            elevation="2"
            icon="mdi-crosshairs-gps"
            size="x-small"
          />
        </template>
      </v-tooltip>
    </template>

    <v-tooltip location="left" :text="centerMissionButtonTooltipText">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          key="mission"
          v-bind="tooltipProps"
          :class="[targetButtonClass, !hasMissionWaypoints ? 'active-events-on-disabled' : '']"
          :style="[interfaceStore.globalGlassMenuStyles, !hasMissionWaypoints ? { color: disabledButtonColor } : {}]"
          elevation="2"
          icon="mdi-map-marker-path"
          size="x-small"
          :disabled="!hasMissionWaypoints"
          @click.stop="emit('centerOnMission')"
        />
      </template>
    </v-tooltip>

    <v-tooltip location="left" :text="centerHomeButtonTooltipText">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          key="home"
          v-bind="tooltipProps"
          :class="[targetButtonClass, !home ? 'active-events-on-disabled' : '']"
          :style="[interfaceStore.globalGlassMenuStyles, !home ? { color: disabledButtonColor } : {}]"
          :color="followerTarget === WhoToFollow.HOME ? 'red' : ''"
          elevation="2"
          icon="mdi-home-search"
          size="x-small"
          :disabled="!home"
          @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
          @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
        />
      </template>
    </v-tooltip>

    <v-tooltip location="left" :text="centerVehicleButtonTooltipText">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          key="vehicle"
          v-bind="tooltipProps"
          :class="[targetButtonClass, !vehiclePosition ? 'active-events-on-disabled' : '']"
          :style="[interfaceStore.globalGlassMenuStyles, !vehiclePosition ? { color: disabledButtonColor } : {}]"
          :color="followerTarget === WhoToFollow.VEHICLE ? 'red' : ''"
          elevation="2"
          icon="mdi-airplane-marker"
          size="x-small"
          :disabled="!vehiclePosition"
          @click.stop="targetFollower.goToTarget(WhoToFollow.VEHICLE, true)"
          @dblclick.stop="targetFollower.follow(WhoToFollow.VEHICLE)"
        />
      </template>
    </v-tooltip>
  </v-speed-dial>
</template>

<script setup lang="ts">
import { type StyleValue, computed, defineModel } from 'vue'

import { TargetFollower, WhoToFollow } from '@/libs/map/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { WaypointCoordinates } from '@/types/mission'

const props = withDefaults(
  defineProps<{
    /** Target follower controlling home/vehicle tracking */
    targetFollower: TargetFollower
    /** Currently tracked target, if any */
    followerTarget?: WhoToFollow
    /** Home coordinates, when available */
    home?: WaypointCoordinates
    /** Vehicle coordinates, when available */
    vehiclePosition?: WaypointCoordinates
    /** Whether the vehicle is currently online */
    isVehicleOnline: boolean
    /** Whether the current mission has any waypoints to center on */
    hasMissionWaypoints: boolean
    /** Inline style positioning the activator button (e.g. its bottom offset) */
    activatorStyle?: StyleValue
  }>(),
  {
    followerTarget: undefined,
    home: undefined,
    vehiclePosition: undefined,
    activatorStyle: undefined,
  }
)

const emit = defineEmits<{
  /** Requests the parent to center the map on the current mission */
  (e: 'centerOnMission'): void
}>()

const interfaceStore = useAppInterfaceStore()

// Two-way bound open state, so parents can react to the dial opening/closing.
const speedDialOpen = defineModel<boolean>('open', { default: false })

const targetButtonClass = 'rounded-sm shadow-sm bg-slate-50 text-[14px]'
const disabledButtonColor = '#FFFFFF44'

const centerActivatorTooltipText = computed(() => {
  if (props.followerTarget === WhoToFollow.HOME) return 'Tracking home position. Open to change target.'
  if (props.followerTarget === WhoToFollow.VEHICLE) return 'Tracking vehicle position. Open to change target.'
  return 'Center map on home, vehicle or mission.'
})

const centerMissionButtonTooltipText = computed(() => {
  if (!props.hasMissionWaypoints) return 'Cannot center map on mission (no waypoints available).'
  return 'Click to center the map on the current mission.'
})

const centerHomeButtonTooltipText = computed(() => {
  if (props.home === undefined) return 'Cannot center map on home (home position undefined).'
  if (props.followerTarget === WhoToFollow.HOME) return 'Tracking home position. Click to stop tracking.'
  return 'Click once to center on home or twice to track it.'
})

const centerVehicleButtonTooltipText = computed(() => {
  if (!props.isVehicleOnline) return 'Cannot center map on vehicle (vehicle offline).'
  if (props.vehiclePosition === undefined) return 'Cannot center map on vehicle (vehicle position undefined).'
  if (props.followerTarget === WhoToFollow.VEHICLE) return 'Tracking vehicle position. Click to stop tracking.'
  return 'Click once to center on vehicle or twice to track it.'
})
</script>

<style scoped>
.active-events-on-disabled {
  pointer-events: all;
}
</style>
