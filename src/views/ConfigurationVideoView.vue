<template>
  <BaseConfigurationView>
    <template #help-icon> </template>
    <template #title>Video configuration</template>
    <template #content>
      <div class="flex-col h-full ml-[1vw] w-[840px] max-h-[85vh] overflow-y-auto pr-3">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Streams mapping</template>
          <template #info>
            Here you can map your external video streams to internal names and manage ignored streams. Active streams
            allow you to easily switch between different video sources in Cockpit. The widgets will be connected to the
            internal names, and the external video stream will be mapped to the internal name. Ignored streams (shown
            with "--" as internal name) can be restored by clicking the restore button.
          </template>
          <template #content>
            <div class="flex justify-center flex-col w-full ml-2 mt-2">
              <v-data-table
                :items="streamsToShow"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg mb-2"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #headers>
                  <tr>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Internal name</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">External name</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Video source</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Resolution</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Status</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Actions</p>
                    </th>
                  </tr>
                </template>
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center justify-center">
                        <ScrollingText :text="item.name" max-width="120px" class="text-sm text-gray-300" />
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <ScrollingText :text="item.externalId" max-width="120px" class="text-sm text-gray-300" />
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <ScrollingText
                          :text="getStreamInfo(item.externalId)?.sourceName || 'Unknown'"
                          max-width="120px"
                          class="text-sm text-gray-300"
                        />
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <div class="text-center">
                          <p class="text-sm text-gray-300 leading-tight">
                            {{
                              getStreamInfo(item.externalId)
                                ? `${getStreamInfo(item.externalId)?.width}x${getStreamInfo(item.externalId)?.height}`
                                : 'Unknown'
                            }}
                          </p>
                          <p class="text-xs text-gray-400 leading-tight">
                            {{ getStreamInfo(item.externalId) ? `@ ${getStreamInfo(item.externalId)?.fps}fps` : '' }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <div class="flex items-center justify-center border-[1px] border-[#ffffff44] rounded-md">
                          <div
                            class="flex items-center rounded-md p-1 text-[#ffffffa5]"
                            :style="{ backgroundColor: getStreamStatus(item.externalId).color }"
                          >
                            <v-icon size="small">
                              {{ getStreamStatus(item.externalId).icon }}
                            </v-icon>
                            <span class="text-xs ml-1">
                              {{ getStreamStatus(item.externalId).status }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <v-btn v-if="!item.isIgnored" icon variant="text" size="small" @click="openEditDialog(item)">
                          <v-icon>mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn
                          v-if="item.isIgnored"
                          icon
                          variant="text"
                          size="small"
                          class="text-gray-400"
                          @click="restoreIgnoredStream(item.externalId)"
                        >
                          <v-icon>mdi-eye-refresh</v-icon>
                        </v-btn>
                        <v-btn v-else icon variant="text" size="small" @click="deleteStream(item)">
                          <v-icon>mdi-eye-remove</v-icon>
                        </v-btn>
                      </div>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <div class="text-gray-400 py-4 w-[200px] text-end">No available streams found.</div>
                </template>
                <template #bottom></template>
              </v-data-table>
              <div class="flex items-center justify-start">
                <v-checkbox v-model="showIgnoredStreams" label="Show ignored streams" hide-details class="text-sm" />
                <span v-if="ignoredStreamExternalIds.length > 0" class="text-gray-400 text-sm ml-2">
                  ({{ ignoredStreamExternalIds.length }} ignored)
                </span>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Allowed WebRTC remote IP Addresses</template>
          <template #info>
            Select the IP addresses to allow connecting to for WebRTC video streaming. For best performance it is
            recommended to only use the most reliable interfaces - e.g. avoid wireless interfaces if there is a
            tethered/wired interface available. If no value is specified, all available routes are allowed.
          </template>
          <template #content>
            <div class="flex justify-center flex-col w-[90%] ml-2">
              <v-combobox
                v-model="allowedIceIps"
                multiple
                :items="availableIceIps"
                label="Allowed WebRTC remote IP Addresses"
                class="uri-input"
                variant="outlined"
                chips
                theme="dark"
                density="compact"
                clearable
                hide-details
              />
              <v-checkbox
                v-model="videoStore.enableAutoIceIpFetch"
                label="Enable auto-retrieval of allowed IP addresses"
                hide-details
                class="mb-2"
              />
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Allowed WebRTC protocols:</template>
          <template #info>
            <li>
              Video stream quality may be enhanced by enforcing a protocol that is well-suited to the available network
              infrastructure.
            </li>
            <li>
              UDP can be lower latency but may drop frames, while TCP enforces frame ordering at the cost of some
              increased latency and jitter.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-start">
              <v-checkbox
                v-for="protocol in availableICEProtocols"
                :key="protocol"
                v-model="allowedIceProtocols"
                :label="protocol.toUpperCase()"
                :value="protocol"
                :disabled="
                  allowedIceProtocols.length === 1 && allowedIceProtocols[0].toLowerCase() === protocol.toLowerCase()
                "
                class="text-sm mx-2"
              />
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>RTP Jitter Buffer (Target) duration:</template>
          <template #info>
            <li>
              Increasing the buffer duration causes additional video latency, but can help to compensate for network
              jitter and provide more consistent frame timing in the display.
            </li>
            <li>
              Cockpit's default is zero milliseconds, but you can set a custom value, or leave the field empty to use
              your browser's default.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-start w-[50%] ml-2">
              <v-text-field
                v-model.number="jitterBufferTarget"
                variant="filled"
                placeholder="auto"
                type="number"
                class="uri-input mt-4"
                theme="dark"
                density="compact"
                max="4000"
                min="0"
                :rules="jitterBufferTargetRules"
                @input="handleJitterBufferTargetInput"
              />
              <a class="ml-3">ms</a>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Video library options:</template>
          <template #info>
            <li>
              Configure live video processing to process videos in real-time during recording for instant availability
              when recording stops. This is only available in the Electron (desktop) version.
            </li>
            <li>
              Choose whether to save backup raw chunks alongside the final video file. This provides safety for video
              reconstruction if something goes wrong, but uses approximately double the storage space.
            </li>
            <li>
              Select whether video and subtitle files should be bundled together in a ZIP archive, or downloaded
              individually. Zipping allows a single download of a group of files, but requires waiting for the files to
              get zipped together. Depending on file sizes, the zipping process may complete within seconds or could
              take minutes.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-end w-[96%] ml-2 mb-4">
              <v-btn variant="flat" class="bg-[#FFFFFF22] px-3 elevation-1" @click="openVideoLibrary">
                <template #append>
                  <v-divider vertical></v-divider>
                  <v-badge color="info" dot class="cursor-pointer" @click="openVideoLibrary">
                    <v-icon class="w-6 h-6 ml-1 text-slate-100" @click="openVideoLibrary">
                      mdi-video-box
                    </v-icon></v-badge
                  >
                </template>
                Video Library
              </v-btn>
            </div>
            <!-- Browser Environment Notice -->
            <div v-if="!isElectron()" class="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4 mx-2 mb-4">
              <div class="flex items-start gap-3">
                <v-icon color="amber" class="mt-1">mdi-information</v-icon>
                <div>
                  <h4 class="text-amber-200 font-medium mb-2">Browser Version</h4>
                  <p class="text-amber-100 text-sm">
                    Video processing is not available in the browser version. Your recordings will be saved as raw
                    chunks that can be downloaded and processed using the standalone version of Cockpit.
                  </p>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-start w-[96%] ml-2">
              <v-checkbox
                v-model="videoStore.enableLiveProcessing"
                label="Live video processing (Electron)"
                class="text-sm mx-2"
                hide-details
                :disabled="!isElectron()"
              />
              <v-tooltip
                :text="
                  isElectron()
                    ? 'Process videos in real-time during recording for instant availability when recording stops'
                    : 'Live video processing is only available in the standalone version'
                "
              >
                <template #activator="{ props }">
                  <v-icon v-bind="props" class="ml-2 text-slate-400">mdi-information-outline</v-icon>
                </template>
              </v-tooltip>
            </div>

            <div class="flex items-center justify-start w-[96%] ml-2">
              <v-checkbox
                v-model="videoStore.keepRawVideoChunksAsBackup"
                label="Save backup raw chunks"
                class="text-sm mx-2"
                :disabled="!isElectron()"
                hide-details
              />
              <v-tooltip max-width="400px">
                <template #activator="{ props }">
                  <v-icon v-bind="props" class="ml-2 text-slate-400">mdi-information-outline</v-icon>
                </template>
                <div class="text-sm">
                  <p class="mb-2">Save the raw video chunks alongside the final video file for backup purposes.</p>
                  <p class="mb-2">
                    <strong>Enabled:</strong> Raw chunks are preserved after recording. Videos use ~2x storage space but
                    provide safety for reconstruction if the final video is corrupted.
                  </p>
                  <p>
                    <strong>Disabled:</strong> Raw chunks are automatically deleted after successful processing, using
                    minimal storage space.
                  </p>
                  <p class="mt-2 text-gray-300">
                    You can always manually clean up backup chunks later using the "Temporary" tab in the Video Library.
                  </p>
                  <p class="mt-2 text-gray-300">For the browser version the chunks are always saved by default.</p>
                </div>
              </v-tooltip>
            </div>
            <div class="flex items-center justify-start w-[50%] ml-2">
              <v-checkbox
                v-model="snapshotStore.zipMultipleFiles"
                label="Zip multiple files"
                class="text-sm mx-2"
                hide-details
              />
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>

  <!-- Edit Stream Name Dialog -->
  <InteractionDialog
    v-model:show-dialog="showEditDialog"
    title="Edit stream"
    variant="text-only"
    :persistent="true"
    :actions="[
      { text: 'Cancel', size: 'small', action: cancelEditDialog },
      { text: 'Save', size: 'small', disabled: !newStreamName.trim(), action: saveStreamNameFromDialog },
    ]"
  >
    <template #content>
      <div class="flex flex-col gap-6 px-4 mb-6">
        <div class="text-sm text-gray-400">
          <span>External stream name: </span>
          <span class="text-gray-200">{{ editingStream?.externalId }}</span>
        </div>
        <v-text-field
          v-model="newStreamName"
          label="Internal stream name"
          variant="outlined"
          density="compact"
          hide-details
          autofocus
          @keyup.enter="saveStreamNameFromDialog"
          @input="editDialogError = ''"
        />
        <div v-if="editDialogError" class="text-red-400 text-sm bg-red-900/20 border border-red-400/30 rounded-md p-3">
          <div class="flex items-center gap-2">
            <v-icon size="small" color="red-400">mdi-alert-circle</v-icon>
            <span>{{ editDialogError }}</span>
          </div>
        </div>
      </div>
    </template>
  </InteractionDialog>

  <!-- Unavailable Stream Confirmation Dialog -->
  <InteractionDialog
    v-model:show-dialog="showUnavailableStreamDialog"
    title="Stream is not available"
    variant="text-only"
    :persistent="true"
    max-width="520px"
    :actions="[
      { text: 'KEEP IGNORED', size: 'small', action: closeUnavailableStreamDialog },
      { text: 'DELETE PERMANENTLY', size: 'small', action: deleteStreamPermanently },
    ]"
  >
    <template #content>
      <div class="flex flex-col gap-4 px-4 mb-6">
        <p class="text-sm text-gray-300">
          The stream <span class="text-gray-100 font-medium">'{{ unavailableStreamId }}'</span> you're trying to restore
          is not available anymore.
        </p>
        <p class="text-sm text-gray-300">You have two options:</p>
        <ul class="text-sm text-gray-300 ml-4 space-y-1">
          <li>
            • <strong>Keep it ignored:</strong> Maintain it in the ignored list so it won't be mapped automatically if
            it becomes available again
          </li>
          <li>
            • <strong>Delete it permanently:</strong> Remove it from the ignored list, so if it becomes available again
            it will be mapped automatically.
          </li>
        </ul>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import ScrollingText from '@/components/ScrollingText.vue'
import { type ProcessedStreamInfo, getStreamInformationFromVehicle } from '@/libs/blueos'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { VideoStreamCorrespondency } from '@/types/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

/**
 * Available ICE protocols as described in
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/protocol
 */
const availableICEProtocols = ['udp', 'tcp']

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const mainVehicleStore = useMainVehicleStore()
const snapshotStore = useSnapshotStore()

// Edit dialog state
const showEditDialog = ref(false)
const editingStream = ref<VideoStreamCorrespondency | null>(null)
const newStreamName = ref('')
const editDialogError = ref('')

// Unavailable stream dialog state
const showUnavailableStreamDialog = ref(false)
const unavailableStreamId = ref('')

const showIgnoredStreams = ref(false)
const streamInformation = ref<ProcessedStreamInfo[]>([])
let fetchInterval: ReturnType<typeof setInterval> | null = null

const streamsToShow = computed(() => {
  return [
    ...videoStore.streamsCorrespondency.map((item) => ({ ...item, isIgnored: false })),
    ...(showIgnoredStreams.value
      ? ignoredStreamExternalIds.value.map((id) => ({ name: '--', externalId: id, isIgnored: true }))
      : []),
  ].filter((item) => item.name !== '')
})

const openEditDialog = (item: VideoStreamCorrespondency): void => {
  editingStream.value = item
  newStreamName.value = item.name
  editDialogError.value = ''
  showEditDialog.value = true
}

const saveStreamNameFromDialog = (): void => {
  if (editingStream.value && newStreamName.value.trim()) {
    try {
      editDialogError.value = ''
      videoStore.renameStreamInternalNameById(editingStream.value.externalId, newStreamName.value.trim())
      cancelEditDialog()
    } catch (error) {
      editDialogError.value = (error as Error).message
    }
  }
}

const cancelEditDialog = (): void => {
  showEditDialog.value = false
  editingStream.value = null
  newStreamName.value = ''
  editDialogError.value = ''
}

const deleteStream = (item: VideoStreamCorrespondency): void => {
  videoStore.deleteStreamCorrespondency(item.externalId)
}

const restoreIgnoredStream = (externalId: string): void => {
  const isStreamAvailable = videoStore.namesAvailableStreams.includes(externalId)

  // If the stream is available, restore normally, otherwise ask the user to confirm they want to delete it permanently
  if (isStreamAvailable) {
    videoStore.restoreIgnoredStream(externalId)
  } else {
    // Stream is not available, show confirmation dialog
    unavailableStreamId.value = externalId
    showUnavailableStreamDialog.value = true
  }
}

const closeUnavailableStreamDialog = (): void => {
  showUnavailableStreamDialog.value = false
  unavailableStreamId.value = ''
}

const deleteStreamPermanently = (): void => {
  videoStore.restoreIgnoredStream(unavailableStreamId.value)
  closeUnavailableStreamDialog()
}

const fetchStreamInformation = async (): Promise<void> => {
  if (!mainVehicleStore.globalAddress) return

  try {
    streamInformation.value = await getStreamInformationFromVehicle(mainVehicleStore.globalAddress)
  } catch (error) {
    console.error('Failed to fetch stream information:', error)
    streamInformation.value = []
  }
}

const startStreamInfoFetching = (): void => {
  // Clear any existing interval
  if (fetchInterval) {
    clearInterval(fetchInterval)
  }

  // Fetch immediately
  fetchStreamInformation()

  // Set up interval to fetch every 5 seconds
  fetchInterval = setInterval(() => {
    fetchStreamInformation()
  }, 5000)
}

const stopStreamInfoFetching = (): void => {
  if (fetchInterval) {
    clearInterval(fetchInterval)
    fetchInterval = null
  }
}

const getStreamInfo = (externalId: string): ProcessedStreamInfo | undefined => {
  return streamInformation.value.find((info) => info.name === externalId)
}

// eslint-disable-next-line
const getStreamStatus = (externalId: string): { status: 'Available' | 'Unavailable' | 'Offline' | 'Unknown'; icon: string; color: string } => {
  const isInAvailableList = videoStore.namesAvailableStreams.includes(externalId)
  const streamInfo = getStreamInfo(externalId)
  const isRunning = streamInfo?.running ?? false

  if (isInAvailableList && isRunning) {
    return { status: 'Available', icon: 'mdi-check-circle', color: '#297e1944' }
  } else if (!isInAvailableList) {
    return { status: 'Unavailable', icon: 'mdi-close-circle', color: '#ff000044' }
  } else if (isInAvailableList && !isRunning) {
    return { status: 'Offline', icon: 'mdi-pause-circle', color: '#ffa50044' }
  } else {
    return { status: 'Unknown', icon: 'mdi-help-circle', color: '#80808044' }
  }
}

onMounted(async () => {
  if (allowedIceProtocols.value.length === 0) {
    allowedIceProtocols.value = availableICEProtocols
  }
  startStreamInfoFetching()
})

onUnmounted(() => {
  stopStreamInfoFetching()
})

const openVideoLibrary = (): void => {
  interfaceStore.videoLibraryVisibility = true
}

/**
 * Handles the input for setting the jitter buffer target
 * @param {string} input - The input value to be processed
 */
function handleJitterBufferTargetInput(input: InputEvent): void {
  if (input.data === null) {
    jitterBufferTarget.value = null
  }
}

const jitterBufferTargetRules = [
  (value: number | '') => value === '' || value >= 0 || 'Must be >= 0',
  (value: number | '') => value === '' || value <= 4000 || 'Must be <= 4000',
]

const { allowedIceIps, allowedIceProtocols, availableIceIps, jitterBufferTarget, ignoredStreamExternalIds } =
  storeToRefs(videoStore)
</script>
<style scoped>
.uri-input {
  width: 95%;
  margin-block: 10px;
}
</style>
