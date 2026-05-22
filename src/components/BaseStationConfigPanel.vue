<template>
  <div
    v-if="store.configPanelOpen"
    class="flex fixed w-[300px] right-0 top-0 border-l-[1px] border-[#FFFFFF44] text-white elevation-5 bg-[#051e2d] overflow-y-auto"
    :style="getMarginsFromBarsHeight"
  >
    <div class="flex flex-col h-full text-center w-full [&>*]:shrink-0">
      <v-btn
        class="absolute top-0 left-0"
        variant="text"
        size="small"
        icon="mdi-close"
        style="z-index: 50000"
        @click="closePanel"
      />

      <ExpansiblePanel
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Base station</p></template>
        <template #content>
          <div class="flex flex-col pt-1 w-full gap-y-1">
            <div class="config-row">
              <p class="config-label">Latitude</p>
              <input
                :value="latText"
                type="number"
                step="0.000001"
                class="config-input"
                :disabled="config.trackByGps"
                @input="(e) => onLatLngInput('lat', (e.target as HTMLInputElement).value)"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Longitude</p>
              <input
                :value="lngText"
                type="number"
                step="0.000001"
                class="config-input"
                :disabled="config.trackByGps"
                @input="(e) => onLatLngInput('lng', (e.target as HTMLInputElement).value)"
              />
            </div>
            <div class="config-row pt-0 mt-0 -mb-1">
              <p class="config-label">Track by GPS</p>
              <v-checkbox
                v-model="config.trackByGps"
                hide-details
                density="compact"
                class="config-checkbox"
                :disabled="!config.position"
              />
            </div>
            <div v-if="config.trackByGps" class="text-[11px] text-white/70 px-1 -mt-1">
              Position synced with browser geolocation.
            </div>
          </div>
        </template>
      </ExpansiblePanel>

      <ExpansiblePanel
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Setup</p></template>
        <template #content>
          <div class="flex flex-col pt-1 w-full gap-y-1">
            <div class="config-row">
              <p class="config-label">Topside</p>
              <select v-model="config.topSideComputerType" class="config-input">
                <option v-for="type in topSideTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
            <div class="config-row">
              <p class="config-label">Comms</p>
              <select v-model="config.commsType" class="config-input">
                <option v-for="comms in commsTypes" :key="comms" :value="comms">{{ comms }}</option>
              </select>
            </div>
            <div v-if="isMobileData" class="config-row">
              <p class="config-label">Coverage</p>
              <select :value="config.mobileCoverage.provider" class="config-input" @change="onCoverageProviderChange">
                <option v-for="p in mobileCoverageProviders" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div v-if="isMobileData && isOpenCellId" class="config-row">
              <p class="config-label">API key</p>
              <input v-model.trim="config.mobileCoverage.openCellIdApiKey" type="text" class="config-input" />
            </div>
            <div v-if="isMobileData && isOsmOverpass" class="config-row">
              <p class="config-label">Operator</p>
              <select v-model="config.mobileCoverage.osmOperator" class="config-input">
                <option value="">All operators</option>
                <option v-for="op in store.availableOsmOperators" :key="op" :value="op">{{ op }}</option>
              </select>
            </div>
            <div v-if="isMobileData && isCustomCoverage" class="config-row">
              <p class="config-label">Tile URL</p>
              <button type="button" class="config-input config-text-btn" @click="openCustomCoverageDialog">
                {{ config.mobileCoverage.customTileUrl ? 'Edit URL' : 'Set URL' }}
              </button>
            </div>
          </div>
        </template>
      </ExpansiblePanel>

      <v-dialog v-model="customCoverageDialogOpen" max-width="520">
        <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-h6 py-3 text-center">Custom coverage tile URL</v-card-title>
          <v-card-text class="px-6">
            <v-text-field
              v-model="customTileUrlDraft"
              label="Tile URL"
              placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
              hint="Leaflet TileLayer URL with {z}, {x}, {y} placeholders. Add an API key to the URL itself if your provider requires one."
              persistent-hint
              variant="outlined"
              density="compact"
              autofocus
            />
          </v-card-text>
          <v-card-actions class="px-6 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="customCoverageDialogOpen = false">Cancel</v-btn>
            <v-btn variant="elevated" color="primary" @click="saveCustomTileUrl">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <ExpansiblePanel
        v-if="isRadioLink"
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Radio</p></template>
        <template #content>
          <div class="flex flex-col pt-1 w-full gap-y-1">
            <div class="config-row">
              <p class="config-label">Radio model</p>
              <select :value="config.radioBaseStationKind" class="config-input" @change="onRadioKindChange">
                <option v-for="kind in radioKinds" :key="kind" :value="kind">{{ kind }}</option>
              </select>
            </div>
            <div v-if="isCustomRadio" class="config-row">
              <p class="config-label">TX power (mW)</p>
              <input
                :value="txPowerText"
                type="number"
                step="100"
                min="1"
                class="config-input"
                @input="(e) => onTxPowerInput((e.target as HTMLInputElement).value)"
                @focus="txPowerFocused = true"
                @blur="onTxPowerBlur"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Antenna</p>
              <select :value="config.antenna.type" class="config-input" @change="onAntennaTypeChange">
                <option v-for="type in antennaTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
            <div class="config-row">
              <div class="config-label-with-info">
                <p class="config-label">Antenna height (m)</p>
                <v-tooltip location="top" max-width="300">
                  <template #activator="{ props }">
                    <button
                      type="button"
                      class="config-info-btn"
                      title="Base station antenna height information"
                      aria-label="Base station antenna height information"
                      v-bind="props"
                    >
                      <v-icon icon="mdi-information-outline" size="14" />
                    </button>
                  </template>
                  <div class="config-open-cell-id-tip">
                    Higher antennas see farther over the horizon. For line-of-sight links, usable range grows roughly
                    with the square root of height (for example, 4× the height ≈ 2× the range). The default 1 m matches
                    the baseline used for the preset range values.
                  </div>
                </v-tooltip>
              </div>
              <input
                v-model.number="config.baseStationAntennaHeightMeters"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                class="config-input"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Gain (dBi)</p>
              <input
                :value="gainText"
                type="number"
                step="0.1"
                class="config-input"
                @input="(e) => onGainInput((e.target as HTMLInputElement).value)"
                @focus="gainFocused = true"
                @blur="onGainBlur"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Beamwidth (°)</p>
              <input
                v-model.number="config.antenna.beamwidth"
                type="number"
                step="1"
                min="1"
                max="360"
                class="config-input"
                :disabled="isOmni"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Range (m)</p>
              <input v-model.number="config.antenna.range" type="number" step="10" min="1" class="config-input" />
            </div>
            <div class="config-row config-checkbox-row">
              <div class="config-label-with-info">
                <p class="config-label">Vehicle has antenna mast</p>
                <v-tooltip location="top" max-width="300">
                  <template #activator="{ props }">
                    <button
                      type="button"
                      class="config-info-btn"
                      title="BlueBoat antenna mast information"
                      aria-label="BlueBoat antenna mast information"
                      v-bind="props"
                    >
                      <v-icon icon="mdi-information-outline" size="14" />
                    </button>
                  </template>
                  <div class="config-open-cell-id-tip">
                    The BlueBoat Antenna and Accessory Mast raises the vehicle antenna about 50 cm above the deck for
                    clearer line of sight, which can increase communication range by up to 1.75× compared with the
                    default deck mount.
                  </div>
                </v-tooltip>
              </div>
              <v-checkbox
                v-model="config.vehicleHasBlueBoatAntennaMast"
                hide-details
                density="compact"
                class="config-checkbox"
              />
            </div>
            <div v-if="!isOmni" class="config-row">
              <p class="config-label">Bearing (°)</p>
              <input
                :value="bearingText"
                type="number"
                step="1"
                class="config-input"
                @input="(e) => onBearingInput((e.target as HTMLInputElement).value)"
                @focus="bearingFocused = true"
                @blur="onBearingBlur"
              />
            </div>

            <div v-if="!isOmni" class="flex w-full justify-between gap-x-1 mt-[5px]">
              <v-btn
                size="x-small"
                variant="elevated"
                class="bg-[#FFFFFF22] flex-1 disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50"
                :disabled="!canSnapToVehicle"
                @click="snapBearingToVehicle"
              >
                Aim at vehicle
              </v-btn>
              <v-btn
                size="x-small"
                variant="elevated"
                class="bg-[#FFFFFF22] flex-1 disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50"
                :disabled="!canSnapToMission"
                @click="snapBearingToMission"
              >
                Aim at mission
              </v-btn>
            </div>

            <v-btn
              size="x-small"
              variant="elevated"
              class="bg-[#2b5779] my-2 w-3/4 mx-auto"
              prepend-icon="mdi-restore"
              @click="resetAntenna"
            >
              Reset antenna defaults
            </v-btn>
          </div>
        </template>
      </ExpansiblePanel>

      <ExpansiblePanel
        v-if="isTethered"
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Tether</p></template>
        <template #content>
          <div class="flex flex-col pt-1 w-full gap-y-1">
            <div class="config-row">
              <p class="config-label">Length (m)</p>
              <input v-model.number="config.tetherLengthMeters" type="number" step="1" min="1" class="config-input" />
            </div>
          </div>
        </template>
      </ExpansiblePanel>

      <ExpansiblePanel
        v-if="isRadioLink || isTethered"
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Display</p></template>
        <template #content>
          <div class="flex flex-col pt-1 w-full gap-y-1">
            <div class="config-row">
              <p class="config-label">Color</p>
              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: activatorProps }">
                  <button
                    v-bind="activatorProps"
                    type="button"
                    class="config-input config-color-swatch"
                    :style="{ backgroundColor: config.coverageColor }"
                    aria-label="Pick coverage color"
                  />
                </template>
                <v-color-picker
                  v-model="config.coverageColor"
                  mode="hex"
                  :modes="['hex']"
                  theme="dark"
                  width="220"
                  class="base-station-color-picker"
                />
              </v-menu>
            </div>
            <div class="config-row config-slider-row">
              <p class="config-label">Opacity</p>
              <v-slider
                v-model="config.coverageOpacity"
                :min="0"
                :max="1"
                :step="0.05"
                :thumb-size="12"
                :track-size="2"
                hide-details
                density="compact"
                color="white"
                track-color="rgba(255,255,255,0.2)"
                class="config-slider"
              />
              <p class="config-slider-value">{{ Math.round(config.coverageOpacity * 100) }}%</p>
            </div>
          </div>
        </template>
      </ExpansiblePanel>

      <div class="base-station-panel-footer">
        <v-btn
          class="base-station-panel-remove-btn bg-[#FFFFFF22] text-white"
          variant="elevated"
          size="small"
          prepend-icon="mdi-delete"
          @click="removeBaseStation"
        >
          Remove base station
        </v-btn>
        <v-btn
          class="base-station-panel-info-btn bg-[#FFFFFF22] text-white"
          variant="elevated"
          size="small"
          rounded="sm"
          icon="mdi-information-outline"
          aria-label="About coverage estimates"
          @click="estimatesInfoDialogOpen = true"
        />
      </div>

      <v-dialog v-model="estimatesInfoDialogOpen" max-width="480">
        <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-h6 py-3 px-6">
            <div class="relative flex items-center justify-center w-full min-h-[28px]">
              <span class="text-center">About coverage estimates</span>
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                color="white"
                class="absolute right-0 -mr-4"
                aria-label="Close about coverage estimates dialog"
                @click="estimatesInfoDialogOpen = false"
              />
            </div>
          </v-card-title>
          <v-card-text class="text-body-2 base-station-estimates-dialog-text px-8">
            <p>
              The ranges and overlays shown here are estimates, not a guarantee of what you will see on the water or in
              the field.
            </p>
            <p>
              <strong>Radio and tether links</strong> are modeled from Blue Robotics product specifications — antenna
              patterns, transmit power, and typical operating assumptions for our radios and related gear.
            </p>
            <p>
              <strong>Mobile data coverage</strong> comes from open-source tower databases (OpenCellID and
              OpenStreetMap). Records can be incomplete or out of date, and carriers change their networks over time.
            </p>
            <p class="mb-0">
              Real-world signal also depends on terrain, weather, interference, and how your vehicle is set up. Use
              these visuals to compare options, and verify connectivity on site when it really matters.
            </p>
          </v-card-text>
          <div class="flex justify-center w-full px-6">
            <v-divider class="opacity-10 border-[#fafafa] w-full" />
          </div>
          <v-card-actions class="px-6 pb-2 pt-2">
            <v-spacer />
            <v-btn variant="text" color="white" class="-mt-[1px]" @click="estimatesInfoDialogOpen = false"
              >Got it</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as turf from '@turf/turf'
import { useWindowSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { confirmRemoveBaseStation, useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import {
  AntennaType,
  BaseStationCommsType,
  BLUE_ROBOTICS_TX_POWER_MW,
  MobileCoverageProvider,
  RadioBaseStationKind,
  TopSideComputerType,
} from '@/types/baseStation'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

const store = useBaseStation()
const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

const config = computed(() => store.config)

const topSideTypes = Object.values(TopSideComputerType)
const commsTypes = Object.values(BaseStationCommsType)
const radioKinds = Object.values(RadioBaseStationKind)
const antennaTypes = Object.values(AntennaType)
const mobileCoverageProviders = Object.values(MobileCoverageProvider)

const isRadioLink = computed(() => config.value.commsType === BaseStationCommsType.RadioLink)
const isTethered = computed(() => config.value.commsType === BaseStationCommsType.Tethered)
const isMobileData = computed(() => config.value.commsType === BaseStationCommsType.MobileData)
const isOmni = computed(() => config.value.antenna.type === AntennaType.Omni)
const isCustomRadio = computed(() => config.value.radioBaseStationKind === RadioBaseStationKind.Custom)
const isOpenCellId = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.OpenCellID)
const isOsmOverpass = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.OSMOverpass)
const isCustomCoverage = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.Custom)

const latText = ref('')
const lngText = ref('')
const bearingText = ref('')
const bearingFocused = ref(false)
const gainText = ref('')
const gainFocused = ref(false)
const txPowerText = ref('')
const txPowerFocused = ref(false)

const formatBearing = (bearing: number): string => bearing.toFixed(1)
const formatGain = (gain: number): string => gain.toFixed(1)
const formatTxPower = (mw: number): string => Math.round(mw).toString()

watch(
  () => config.value.position,
  (pos) => {
    latText.value = pos ? pos[0].toString() : ''
    lngText.value = pos ? pos[1].toString() : ''
  },
  { immediate: true }
)

// Skip the formatting round-trip while the user is editing — otherwise toFixed() rewrites the
// input mid-keystroke (e.g. "1" -> "1.0") and the next digit lands in the decimal spot.
watch(
  () => config.value.antenna.bearing,
  (b) => {
    if (!bearingFocused.value) bearingText.value = formatBearing(b)
  },
  { immediate: true }
)

watch(
  () => config.value.antenna.gain,
  (g) => {
    if (!gainFocused.value) gainText.value = formatGain(g)
  },
  { immediate: true }
)

watch(
  () => config.value.txPowerMilliwatts,
  (p) => {
    if (!txPowerFocused.value) txPowerText.value = formatTxPower(p)
  },
  { immediate: true }
)

const onLatLngInput = (axis: 'lat' | 'lng', value: string): void => {
  if (axis === 'lat') latText.value = value
  else lngText.value = value
  const lat = parseFloat(latText.value)
  const lng = parseFloat(lngText.value)
  if (Number.isFinite(lat) && Number.isFinite(lng)) store.setPosition([lat, lng])
}

const onBearingInput = (value: string): void => {
  bearingText.value = value
  const parsed = parseFloat(value)
  if (Number.isFinite(parsed)) store.setBearing(parsed)
}

const onBearingBlur = (): void => {
  bearingFocused.value = false
  bearingText.value = formatBearing(config.value.antenna.bearing)
}

// Friis: a single-end gain delta scales LOS range by 10^(ΔG_dB/20).
const onGainInput = (value: string): void => {
  gainText.value = value
  const parsed = parseFloat(value)
  if (!Number.isFinite(parsed)) return
  const oldGain = config.value.antenna.gain
  if (parsed === oldGain) return
  const ratio = Math.pow(10, (parsed - oldGain) / 20)
  config.value.antenna.gain = parsed
  config.value.antenna.range = Math.max(1, Math.round(config.value.antenna.range * ratio))
}

const onGainBlur = (): void => {
  gainFocused.value = false
  gainText.value = formatGain(config.value.antenna.gain)
}

// Same Friis scaling as gain (range ∝ √P_t ⇒ 10^(ΔP_dB/20)).
const applyTxPower = (newPowerMw: number): void => {
  const oldPower = config.value.txPowerMilliwatts
  if (!Number.isFinite(newPowerMw) || newPowerMw <= 0 || newPowerMw === oldPower) return
  const ratio = Math.sqrt(newPowerMw / oldPower)
  config.value.txPowerMilliwatts = newPowerMw
  config.value.antenna.range = Math.max(1, Math.round(config.value.antenna.range * ratio))
}

const onTxPowerInput = (value: string): void => {
  txPowerText.value = value
  const parsed = parseFloat(value)
  if (Number.isFinite(parsed) && parsed > 0) applyTxPower(parsed)
}

const onTxPowerBlur = (): void => {
  txPowerFocused.value = false
  txPowerText.value = formatTxPower(config.value.txPowerMilliwatts)
}

// Switching back to the BR base station snaps power to its known 1 W radio and rescales range
// accordingly, so the panel never claims BR-branded hardware while running off-spec power.
const onRadioKindChange = (event: Event): void => {
  const newKind = (event.target as HTMLSelectElement).value as RadioBaseStationKind
  config.value.radioBaseStationKind = newKind
  if (newKind === RadioBaseStationKind.BlueRobotics) applyTxPower(BLUE_ROBOTICS_TX_POWER_MW)
}

const estimatesInfoDialogOpen = ref(false)
const customCoverageDialogOpen = ref(false)
const customTileUrlDraft = ref('')

const openCustomCoverageDialog = (): void => {
  customTileUrlDraft.value = config.value.mobileCoverage.customTileUrl
  customCoverageDialogOpen.value = true
}

const saveCustomTileUrl = (): void => {
  config.value.mobileCoverage.customTileUrl = customTileUrlDraft.value.trim()
  customCoverageDialogOpen.value = false
}

// Selecting Custom auto-pops the URL dialog (operator hasn't given us a tile URL yet),
// matching the spec; the other providers just swap and let the overlay refresh.
const onCoverageProviderChange = (event: Event): void => {
  const next = (event.target as HTMLSelectElement).value as MobileCoverageProvider
  config.value.mobileCoverage.provider = next
  if (next === MobileCoverageProvider.Custom) openCustomCoverageDialog()
}

const onAntennaTypeChange = (event: Event): void => {
  const value = (event.target as HTMLSelectElement).value as AntennaType
  store.setAntennaType(value)
}

const closePanel = (): void => {
  store.configPanelOpen = false
}

const { showDialog, closeDialog } = useInteractionDialog()

const removeBaseStation = (): void => {
  confirmRemoveBaseStation(showDialog, closeDialog)
}

const resetAntenna = (): void => {
  store.resetAntennaToDefaults()
}

const vehiclePosition = computed<WaypointCoordinates | null>(() => {
  const lat = vehicleStore.coordinates?.latitude
  const lng = vehicleStore.coordinates?.longitude
  return lat != null && lng != null ? [lat, lng] : null
})

const missionCentroid = computed<WaypointCoordinates | null>(() => {
  const planning = missionStore.currentPlanningWaypoints
  const vehicleMissionWps = missionStore.vehicleMission
  const wps = planning.length > 0 ? planning : vehicleMissionWps
  if (!wps || wps.length === 0) return null
  const [sumLat, sumLng] = wps.reduce<[number, number]>(
    ([lat, lng], wp: Waypoint) => [lat + wp.coordinates[0], lng + wp.coordinates[1]],
    [0, 0]
  )
  return [sumLat / wps.length, sumLng / wps.length]
})

const canSnapToVehicle = computed(() => Boolean(config.value.position && vehiclePosition.value))
const canSnapToMission = computed(() => Boolean(config.value.position && missionCentroid.value))

const bearingTo = (target: WaypointCoordinates): number => {
  const center = config.value.position!
  return turf.bearing(turf.point([center[1], center[0]]), turf.point([target[1], target[0]]))
}

const snapBearingToVehicle = (): void => {
  if (!canSnapToVehicle.value) return
  store.setBearing(bearingTo(vehiclePosition.value!))
}

const snapBearingToMission = (): void => {
  if (!canSnapToMission.value) return
  store.setBearing(bearingTo(missionCentroid.value!))
}

const { height: windowHeight } = useWindowSize()

const getMarginsFromBarsHeight = computed(() => {
  return {
    marginTop: widgetStore.editingMode ? '0px' : widgetStore.currentTopBarHeightPixels + 'px',
    marginBottom: widgetStore.editingMode ? '0px' : widgetStore.currentBottomBarHeightPixels + 'px',
    height: widgetStore.editingMode
      ? windowHeight.value + 'px'
      : windowHeight.value -
        widgetStore.currentTopBarHeightPixels -
        widgetStore.currentBottomBarHeightPixels -
        1 +
        'px',
    zIndex: 600,
  }
})
</script>

<style scoped>
.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ffffff17;
  padding: 2px 0 8px 0;
  margin-top: 2px;
  min-height: 36px;
  box-sizing: border-box;
}

/* Drop the divider after the bottom-most row of each section so the section header below it
   isn't visually attached to the previous control. */
.config-row:last-child {
  border-bottom: none;
}

.config-label {
  text-align: start;
  margin-left: 4px;
  font-size: 13px;
  width: 50%;
}

.config-input {
  background-color: #ffffff11;
  padding: 4px 8px;
  width: 130px;
  font-size: 13px;
  color: white;
  box-sizing: border-box;
  border: 1px solid transparent;
}

/* Strip the native number-input spinner so number fields render at the same usable width as
   the <select>s in the same column. */
.config-input[type='number']::-webkit-inner-spin-button,
.config-input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.config-input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* Native <option> popups inherit OS chrome by default and render light-on-light over the
   dark panel; force them onto the panel palette so the dropdowns stay readable. */
.config-input option {
  background-color: #0a2a3d;
  color: white;
}

.config-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.config-checkbox {
  margin-right: 6px;
}

.config-checkbox-row {
  padding: 0 0 4px 0;
  min-height: auto;
}

.config-label-with-info {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  justify-content: space-between;
  min-width: 0;
  margin-right: 8px;
}

.config-label-with-info .config-label {
  width: auto;
}

.config-checkbox :deep(.v-selection-control) {
  min-height: auto;
}

.config-checkbox :deep(.v-selection-control__wrapper) {
  transform: scale(0.8);
  transform-origin: center;
}

.config-color-swatch {
  height: 24px;
  border: 1px solid #ffffff33;
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
}

.config-text-btn {
  text-align: center;
  cursor: pointer;
}

/* Eyedropper hijacks the v-menu's outside-click and the OS picker UX is shaky on web; drop it. */
.base-station-color-picker :deep(.v-color-picker-preview__eye-dropper) {
  display: none;
}

.config-slider-row {
  gap: 6px;
}

.config-slider {
  flex: 1;
  margin: 0;
}

.config-slider-value {
  font-size: 12px;
  width: 36px;
  text-align: right;
  color: #ffffffcc;
}

.base-station-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  margin-top: auto;
  margin-bottom: 8px;
  padding: 0 8px;
}

.base-station-panel-info-btn {
  flex: 0 0 auto;
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px !important;
}

.base-station-panel-remove-btn {
  flex: 0 0 auto;
}

.base-station-estimates-dialog-text {
  padding-left: 40px;
  padding-right: 40px;
  text-align: justify;
  hyphens: auto;
}

.base-station-estimates-dialog-text p + p {
  margin-top: 12px;
}
</style>
