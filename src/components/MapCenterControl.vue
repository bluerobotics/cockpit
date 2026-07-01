<template>
  <v-speed-dial
    :model-value="speedDialOpen"
    location="top center"
    transition="slide-y-reverse-transition"
    content-class="speed-dial-glow"
    @update:model-value="onSpeedDialToggle"
  >
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
          @click.stop="centerOnMission"
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
          @click.stop="goToHome"
          @dblclick.stop="trackHome"
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
          @click.stop="goToVehicle"
          @dblclick.stop="trackVehicle"
        />
      </template>
    </v-tooltip>

    <v-menu location="start" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <v-tooltip location="left" :text="centerPoiButtonTooltipText">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              key="pois"
              v-bind="{ ...menuProps, ...tooltipProps }"
              :class="[targetButtonClass, pois.length === 0 ? 'active-events-on-disabled' : '']"
              :style="[interfaceStore.globalGlassMenuStyles, pois.length === 0 ? { color: disabledButtonColor } : {}]"
              :color="isTrackingAnyPoi ? 'red' : ''"
              elevation="2"
              icon="mdi-map-marker-radius"
              size="x-small"
              :disabled="pois.length === 0"
            />
          </template>
        </v-tooltip>
      </template>
      <v-list
        density="compact"
        class="rounded-lg mr-2 py-0"
        :style="[interfaceStore.globalGlassMenuStyles, { maxHeight: '300px', overflowY: 'auto' }]"
      >
        <template v-for="(poi, index) in pois" :key="poi.id">
          <v-tooltip location="left" text="Click to center, double-click to track">
            <template #activator="{ props: itemProps }">
              <v-list-item
                v-bind="itemProps"
                :title="poi.name"
                :active="isTrackingPoi(poi)"
                class="poi-name-item"
                @click="goToPoi(poi)"
                @dblclick="trackPoi(poi)"
              />
            </template>
          </v-tooltip>
          <v-divider v-if="index < pois.length - 1" />
        </template>
      </v-list>
    </v-menu>
  </v-speed-dial>
</template>

<script setup lang="ts">
import { type StyleValue, computed, defineModel } from 'vue'

import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { TargetFollower, WhoToFollow } from '@/libs/map/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { ResolvedPointOfInterest, WaypointCoordinates } from '@/types/mission'

const props = withDefaults(
  defineProps<{
    /** Target follower controlling home/vehicle tracking */
    targetFollower: TargetFollower
    /** Currently tracked target id, if any (a WhoToFollow value or a POI target key) */
    followerTarget?: string
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
const { resolvedPointsOfInterest: pois } = usePointsOfInterest()

const poiTargetKey = (poiId: string): string => `poi:${poiId}`

const ensurePoiTrackable = (poi: ResolvedPointOfInterest): void => {
  props.targetFollower.setTrackableTarget(
    poiTargetKey(poi.id),
    () => pois.value.find((candidate) => candidate.id === poi.id)?.coordinates
  )
}

const isTrackingPoi = (poi: ResolvedPointOfInterest): boolean => props.followerTarget === poiTargetKey(poi.id)

const isTrackingAnyPoi = computed(() => props.followerTarget?.startsWith('poi:') ?? false)

const goToPoi = (poi: ResolvedPointOfInterest): void => {
  logUserAction(`Centered the map on the "${poi.name}" point of interest`)
  ensurePoiTrackable(poi)
  props.targetFollower.goToTarget(poiTargetKey(poi.id), true)
}

const trackPoi = (poi: ResolvedPointOfInterest): void => {
  logUserAction(`Started tracking the "${poi.name}" point of interest on the map`)
  ensurePoiTrackable(poi)
  props.targetFollower.follow(poiTargetKey(poi.id))
}

const centerOnMission = (): void => {
  logUserAction('Centered the map on the mission')
  emit('centerOnMission')
}

const goToHome = (): void => {
  logUserAction('Centered the map on the home position')
  props.targetFollower.goToTarget(WhoToFollow.HOME, true)
}

const trackHome = (): void => {
  logUserAction('Started tracking the home position on the map')
  props.targetFollower.follow(WhoToFollow.HOME)
}

const goToVehicle = (): void => {
  logUserAction('Centered the map on the vehicle')
  props.targetFollower.goToTarget(WhoToFollow.VEHICLE, true)
}

const trackVehicle = (): void => {
  logUserAction('Started tracking the vehicle on the map')
  props.targetFollower.follow(WhoToFollow.VEHICLE)
}

// Two-way bound open state, so parents can react to the dial opening/closing.
const speedDialOpen = defineModel<boolean>('open', { default: false })

const onSpeedDialToggle = (open: boolean): void => {
  speedDialOpen.value = open
  logUserAction(open ? 'Opened the map center-on menu' : 'Closed the map center-on menu')
}

const targetButtonClass = 'rounded-sm shadow-sm bg-slate-50 text-[14px]'
const disabledButtonColor = '#FFFFFF44'

const centerActivatorTooltipText = computed(() => {
  if (isTrackingAnyPoi.value) {
    const tracked = pois.value.find((poi) => poiTargetKey(poi.id) === props.followerTarget)
    return `Tracking "${tracked?.name ?? 'a point of interest'}". Open to change target.`
  }
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

const centerPoiButtonTooltipText = computed(() => {
  if (pois.value.length === 0) return 'No points of interest to center on.'
  return 'Center on a point of interest.'
})
</script>

<style scoped>
.active-events-on-disabled {
  pointer-events: all;
}

.poi-name-item :deep(.v-list-item-title) {
  font-weight: 600;
  user-select: none;
}

.poi-name-item.v-list-item--active {
  background-color: #f44336;
}

.poi-name-item.v-list-item--active :deep(.v-list-item__overlay) {
  opacity: 0;
}

.poi-name-item.v-list-item--active :deep(.v-list-item-title) {
  color: #ffffff;
}
</style>

<!-- Unscoped: the speed-dial content is teleported to <body>, so a scoped selector would not reach it. -->
<style>
.speed-dial-glow {
  isolation: isolate;
}

.speed-dial-glow::before {
  content: '';
  position: absolute;
  inset: -8px -10px -7px -10px;
  border-radius: 4px;
  background: rgba(30, 30, 30, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  pointer-events: none;
  z-index: -1;
}
</style>
