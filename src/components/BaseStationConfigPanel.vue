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
              <p class="config-label">Name</p>
              <input v-model="config.name" type="text" class="config-input" />
            </div>
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
              <p class="config-label">Topside computer</p>
              <select v-model="config.topSideComputerType" class="config-input">
                <option v-for="type in topSideTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
            <div v-if="isPortableTopside" class="config-row config-checkbox-row">
              <p class="config-label">Track position by GPS</p>
              <v-checkbox
                v-model="config.trackByGps"
                hide-details
                density="compact"
                class="config-checkbox"
                :disabled="!config.position"
              />
            </div>
            <div class="config-row">
              <p class="config-label">Comms</p>
              <select v-model="config.commsType" class="config-input">
                <option v-for="comms in commsTypes" :key="comms" :value="comms">{{ comms }}</option>
              </select>
            </div>
            <div v-if="isMobileData" class="config-row">
              <p class="config-label">Coverage</p>
              <div class="config-input-actions">
                <div class="config-coverage-buttons">
                  <button
                    v-if="isOpenCellId || isOsmOverpass"
                    type="button"
                    class="config-target-btn"
                    :class="{ 'config-target-btn-active': store.mobileCoverageTargetToolActive }"
                    title="Click to pick a point on the map, or drag onto it"
                    aria-label="Pick a point on the map to fetch coverage"
                    draggable="true"
                    @click="toggleMobileCoverageTargetTool"
                    @dragstart="onMobileCoverageFetchDragStart"
                  >
                    <v-icon icon="mdi-crosshairs-gps" size="14" />
                  </button>
                  <v-menu location="bottom end" offset="4">
                    <template #activator="{ props }">
                      <button
                        type="button"
                        class="config-actions-menu-btn"
                        title="Coverage actions"
                        aria-label="Coverage actions"
                        v-bind="props"
                      >
                        <v-icon icon="mdi-dots-vertical" size="16" />
                      </button>
                    </template>
                    <v-list
                      density="compact"
                      class="config-actions-menu-list"
                      :style="[interfaceStore.globalGlassMenuStyles, { background: '#0a2a3dee' }]"
                    >
                      <v-list-item v-if="isOpenCellId && isStandalone" @click="toggleOpenCellIdApiKeyField">
                        <v-list-item-title>{{
                          showOpenCellIdApiKeyField ? 'Hide API key' : 'Show API key'
                        }}</v-list-item-title>
                        <template #append>
                          <v-icon icon="mdi-cog" size="14" class="-mt-[3px] -mr-[4px]" />
                        </template>
                      </v-list-item>
                      <v-divider v-if="isOpenCellId && isStandalone" class="config-actions-divider" />
                      <v-list-item
                        :disabled="store.mobileCoverageLoading || !config.position"
                        @click="reloadMobileCoverage"
                      >
                        <v-list-item-title>Reload coverage data</v-list-item-title>
                        <template #append>
                          <v-icon
                            :icon="store.mobileCoverageLoading ? 'mdi-loading' : 'mdi-refresh'"
                            size="15"
                            :class="{ 'reload-spin': store.mobileCoverageLoading, '-mr-[3px]': isOpenCellId }"
                          />
                        </template>
                      </v-list-item>
                      <v-divider class="config-actions-divider" />
                      <v-list-item :disabled="store.mobileCoverageLoading" @click="resetVisibleMobileCoverageData">
                        <v-list-item-title>Reset visible data</v-list-item-title>
                        <template #append>
                          <v-icon icon="mdi-delete-sweep-outline" size="16" class="-mb-[2px] -mr-[6px]" />
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
                <div class="config-provider-select-wrap">
                  <select
                    :value="config.mobileCoverage.provider"
                    class="config-input config-provider-select"
                    @change="onCoverageProviderChange"
                  >
                    <option v-for="p in mobileCoverageProviders" :key="p" :value="p">{{ p }}</option>
                  </select>
                  <v-progress-linear
                    v-if="store.mobileCoverageLoading"
                    absolute
                    indeterminate
                    location="bottom"
                    :height="2"
                    color="white"
                    bg-opacity="0"
                    class="config-provider-loading"
                  />
                </div>
              </div>
            </div>
            <div v-if="showOpenCellIdApiKeyField" class="config-row">
              <p class="config-label">API key</p>
              <div class="config-input-actions">
                <input
                  v-model.trim="config.mobileCoverage.openCellIdApiKey"
                  type="text"
                  class="config-input config-api-key-input"
                />
                <v-icon
                  v-if="config.mobileCoverage.openCellIdApiKey.trim() && store.openCellIdApiKeyStatus === 'valid'"
                  class="text-green-500"
                  size="14"
                >
                  mdi-check-circle
                </v-icon>
                <v-icon
                  v-else-if="
                    config.mobileCoverage.openCellIdApiKey.trim() && store.openCellIdApiKeyStatus === 'invalid'
                  "
                  class="text-red-400"
                  size="14"
                >
                  mdi-alert-circle
                </v-icon>
                <v-tooltip location="top" max-width="280">
                  <template #activator="{ props }">
                    <button
                      type="button"
                      class="config-info-btn"
                      title="OpenCellID API information"
                      aria-label="OpenCellID API information"
                      v-bind="props"
                    >
                      <v-icon icon="mdi-information-outline" size="14" />
                    </button>
                  </template>
                  <div class="config-open-cell-id-tip">
                    API key mode uses the official OpenCellID API with your own request quota, so it is usually more
                    stable and less aggressively rate-limited than the anonymous standalone service. Anonymous mode is
                    easier to use but may return fewer results or cool down sooner. Get a key at
                    `opencellid.org/register.php`, then copy it from your dashboard/API access page.
                  </div>
                </v-tooltip>
              </div>
            </div>
            <div v-if="isMobileData && isOsmOverpass" class="config-row">
              <p class="config-label">Operator</p>
              <select v-model="config.mobileCoverage.osmOperator" class="config-input">
                <option value="">All operators</option>
                <option v-for="op in store.availableOsmOperators" :key="op" :value="op">{{ op }}</option>
              </select>
            </div>
            <div
              v-if="isMobileData && isOpenCellId && store.availableOpenCellIdOperators.length > 0"
              class="config-row"
            >
              <p class="config-label">Operator</p>
              <select v-model="config.mobileCoverage.openCellIdOperator" class="config-input">
                <option value="">All operators</option>
                <option v-for="op in store.availableOpenCellIdOperators" :key="op" :value="op">{{ op }}</option>
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
        v-if="isRadioLink || isTethered || isMobileData"
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
            <div v-if="isRadioLink || isTethered" class="config-row">
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
            <div v-if="isMobileData && (isOpenCellId || isOsmOverpass)" class="config-row">
              <p class="config-label">Signal view</p>
              <select v-model="config.mobileCoverage.displayMode" class="config-input">
                <option v-for="mode in mobileCoverageDisplayModes" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </div>
            <div
              v-if="isMobileData && (isOpenCellId || isOsmOverpass) && isCoverageRingsMode"
              class="config-row config-checkbox-row"
            >
              <p class="config-label">Show ring labels</p>
              <v-checkbox
                v-model="config.mobileCoverage.showRingLabels"
                hide-details
                density="compact"
                class="config-checkbox"
              />
            </div>
            <div
              v-if="isMobileData && (isOpenCellId || isOsmOverpass) && isHeatmapMode"
              class="config-row config-slider-row"
            >
              <p class="config-label">Heatmap intensity</p>
              <v-slider
                v-model="config.mobileCoverage.heatmapIntensity"
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
              <p class="config-slider-value">
                {{ formatHeatmapIntensityLabel(config.mobileCoverage.heatmapIntensity) }}
              </p>
            </div>
            <div class="config-row config-slider-row">
              <p class="config-label">Opacity</p>
              <v-slider
                v-model="displayOpacityModel"
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
              <p class="config-slider-value">{{ Math.round(displayOpacityModel * 100) }}%</p>
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

<script lang="ts">
// Multiple Map widgets each mount their own config panel — keep the global Escape listener at
// module scope and ref-count it so we never queue duplicate handlers.
let targetToolEscapeListenerCount = 0
const sharedTargetToolEscapeHandlers = new Set<(event: KeyboardEvent) => void>()
const sharedTargetToolEscape = (event: KeyboardEvent): void => {
  for (const handler of sharedTargetToolEscapeHandlers) handler(event)
}
</script>

<script setup lang="ts">
import * as turf from '@turf/turf'
import { useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import {
  AntennaType,
  BaseStationCommsType,
  BLUE_ROBOTICS_TX_POWER_MW,
  MOBILE_COVERAGE_FETCH_DROP_MIME,
  MobileCoverageDisplayMode,
  MobileCoverageProvider,
  RadioBaseStationKind,
  TopSideComputerType,
} from '@/types/baseStation'
import type { DialogActions } from '@/types/general'
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
const mobileCoverageDisplayModes = Object.values(MobileCoverageDisplayMode)
const mobileCoverageProviders = Object.values(MobileCoverageProvider)

const isRadioLink = computed(() => config.value.commsType === BaseStationCommsType.RadioLink)
const isTethered = computed(() => config.value.commsType === BaseStationCommsType.Tethered)
const isMobileData = computed(() => config.value.commsType === BaseStationCommsType.MobileData)
const isStandalone = isElectron()
const isPortableTopside = computed(() => config.value.topSideComputerType === TopSideComputerType.Portable)
const isOmni = computed(() => config.value.antenna.type === AntennaType.Omni)
const isCustomRadio = computed(() => config.value.radioBaseStationKind === RadioBaseStationKind.Custom)
const isOpenCellId = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.OpenCellID)
const isOsmOverpass = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.OSMOverpass)
const isCustomCoverage = computed(() => config.value.mobileCoverage.provider === MobileCoverageProvider.Custom)
const isCoverageRingsMode = computed(
  () => config.value.mobileCoverage.displayMode === MobileCoverageDisplayMode.CoverageRings
)
const isHeatmapMode = computed(() => config.value.mobileCoverage.displayMode === MobileCoverageDisplayMode.Heatmap)
const openCellIdApiKeyFieldOpen = ref(isStandalone && !config.value.mobileCoverage.openCellIdApiKey.trim())
const showOpenCellIdApiKeyField = computed(
  () => isMobileData.value && isOpenCellId.value && (!isStandalone || openCellIdApiKeyFieldOpen.value)
)
const displayOpacityModel = computed({
  get: () => (isMobileData.value ? config.value.mobileCoverage.overlayOpacity : config.value.coverageOpacity),
  set: (value: number) => {
    if (isMobileData.value) config.value.mobileCoverage.overlayOpacity = value
    else config.value.coverageOpacity = value
  },
})

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

const formatHeatmapIntensityLabel = (intensity: number): string => {
  const percent = Math.round(intensity * 100)
  if (percent <= 25) return 'Low'
  if (percent >= 75) return 'High'
  return 'Med'
}

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
  if (next !== MobileCoverageProvider.OpenCellID && isStandalone) openCellIdApiKeyFieldOpen.value = false
  if (
    next === MobileCoverageProvider.OpenCellID &&
    isStandalone &&
    !config.value.mobileCoverage.openCellIdApiKey.trim()
  ) {
    openCellIdApiKeyFieldOpen.value = true
  }
}

const reloadMobileCoverage = (): void => {
  store.requestMobileCoverageReload()
}

const resetVisibleMobileCoverageData = (): void => {
  store.requestVisibleMobileCoverageDataReset()
}

const toggleOpenCellIdApiKeyField = (): void => {
  openCellIdApiKeyFieldOpen.value = !openCellIdApiKeyFieldOpen.value
}

const onMobileCoverageFetchDragStart = (event: DragEvent): void => {
  event.dataTransfer?.setData(MOBILE_COVERAGE_FETCH_DROP_MIME, 'mobile-coverage-fetch')
  event.dataTransfer?.setData('text/plain', 'mobile-coverage-fetch')
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  // Drag preview: capture only the icon glyph so the surrounding button chrome doesn't tag along.
  const icon = (event.currentTarget as HTMLElement).querySelector('.v-icon') as HTMLElement | null
  if (icon && event.dataTransfer) {
    const rect = icon.getBoundingClientRect()
    event.dataTransfer.setDragImage(icon, rect.width / 2, rect.height / 2)
  }
  // Picking up the tool by drag and clicking the map afterwards would be confusing.
  store.mobileCoverageTargetToolActive = false
}

const toggleMobileCoverageTargetTool = (): void => {
  store.mobileCoverageTargetToolActive = !store.mobileCoverageTargetToolActive
}

const onTargetToolEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && store.mobileCoverageTargetToolActive) {
    store.mobileCoverageTargetToolActive = false
  }
}
if (targetToolEscapeListenerCount === 0) {
  window.addEventListener('keydown', sharedTargetToolEscape)
}
targetToolEscapeListenerCount++
sharedTargetToolEscapeHandlers.add(onTargetToolEscape)
onBeforeUnmount(() => {
  sharedTargetToolEscapeHandlers.delete(onTargetToolEscape)
  targetToolEscapeListenerCount = Math.max(0, targetToolEscapeListenerCount - 1)
  if (targetToolEscapeListenerCount === 0) {
    window.removeEventListener('keydown', sharedTargetToolEscape)
  }
  store.mobileCoverageTargetToolActive = false
})

const onAntennaTypeChange = (event: Event): void => {
  const value = (event.target as HTMLSelectElement).value as AntennaType
  store.setAntennaType(value)
}

const closePanel = (): void => {
  store.configPanelOpen = false
}

const { showDialog, closeDialog } = useInteractionDialog()

const removeBaseStation = (): void => {
  showDialog({
    variant: 'text-only',
    message: 'Remove the base station? This will clear its position and configuration.',
    persistent: false,
    maxWidth: '480px',
    actions: [
      { text: 'Cancel', color: 'white', action: closeDialog },
      {
        text: 'Remove',
        color: 'white',
        action: () => {
          store.remove()
          closeDialog()
        },
      },
    ] as DialogActions[],
  })
}

const resetAntenna = (): void => {
  store.resetAntennaToDefaults()
}

const vehiclePosition = computed<WaypointCoordinates | null>(() => {
  const lat = vehicleStore.coordinates?.latitude
  const lng = vehicleStore.coordinates?.longitude
  return lat && lng ? [lat, lng] : null
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

.config-input-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-provider-select-wrap {
  position: relative;
  width: 130px;
  flex: 0 0 130px;
}

.config-provider-select {
  width: 100%;
}

.config-provider-loading {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  margin: 0;
}

.config-coverage-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.config-actions-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border: 1px solid transparent;
  color: white;
  background: transparent;
}

.config-info-btn,
.config-target-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border: 1px solid transparent;
  background: transparent;
  color: white;
}

.config-target-btn-active {
  color: #60a5fa;
}

.config-actions-menu-list {
  min-width: 190px;
  padding: 0;
  border: 1px solid #ffffff22;
  border-radius: 8px;
}

.config-actions-menu-list :deep(.v-list-item) {
  min-height: 30px;
  color: white;
}

.config-actions-menu-list :deep(.v-list-item-title) {
  font-size: 12px;
}

.config-actions-menu-list :deep(.v-list-item__append) {
  margin-left: 16px;
}

.config-actions-divider {
  opacity: 0.22;
}

.config-api-key-input {
  width: 100%;
}

.config-open-cell-id-tip {
  font-size: 11px;
  line-height: 1.35;
  color: #ffffffde;
  text-align: left;
}

.reload-spin {
  animation: reload-spin 0.9s linear infinite;
}

@keyframes reload-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
