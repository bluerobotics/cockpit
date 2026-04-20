<template>
  <InteractionDialog
    :show-dialog="showDialog"
    title="Camera stream change detected"
    :actions="dialogActions"
    variant="text-only"
    max-width="520px"
    @update:show-dialog="handleDialogClose"
  >
    <template #content>
      <div class="flex flex-col gap-4 min-w-[340px]">
        <p class="text-sm text-gray-300">
          We noticed that a stream used by your widgets is no longer available, but a new stream has appeared. This
          usually happens when replacing a camera. Would you like to update your widgets to use the new stream?
        </p>

        <div v-for="orphan in orphanedWidgetStreams" :key="orphan.externalId" class="flex flex-col gap-3">
          <div class="stream-card unavailable">
            <div class="stream-card-header">
              <v-icon size="18" color="red-lighten-1">mdi-video-off</v-icon>
              <span class="font-medium text-white text-sm">{{ orphan.internalName }}</span>
              <v-chip size="x-small" color="red-darken-1" variant="flat" label class="text-white ml-auto">
                Unavailable
              </v-chip>
            </div>
            <div class="stream-card-details">
              <div class="detail-row">
                <span class="detail-label">Source</span>
                <span class="detail-value">{{ orphan.displayInfo.source }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Stream ID</span>
                <span class="detail-value text-xs">{{ orphan.externalId }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <span class="detail-value">
                  <v-chip
                    size="x-small"
                    :color="orphan.displayInfo.protocolLabel === 'RTSP' ? '#e67e22' : '#3498db'"
                    variant="flat"
                    label
                    class="text-white"
                  >
                    {{ orphan.displayInfo.protocolLabel }}
                  </v-chip>
                </span>
              </div>
              <div v-if="orphan.displayInfo.resolution !== 'Unknown'" class="detail-row">
                <span class="detail-label">Resolution</span>
                <span class="detail-value">
                  {{ orphan.displayInfo.resolution }}
                  <template v-if="orphan.displayInfo.fps"> @ {{ orphan.displayInfo.fps }}</template>
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-center">
            <v-icon size="20" color="grey-lighten-1">mdi-arrow-down</v-icon>
          </div>

          <div v-if="unusedAvailableStreams.length > 1" class="mb-2">
            <v-select
              v-model="replacementMap[orphan.internalName]"
              :items="replacementItems"
              item-value="internalName"
              item-title="label"
              density="compact"
              variant="outlined"
              hide-details
              label="Replace with"
            />
          </div>
          <template v-else>
            <div v-for="corr in unusedAvailableStreams" :key="corr.externalId" class="stream-card available">
              <div class="stream-card-header">
                <v-icon size="18" color="green-lighten-1">mdi-video</v-icon>
                <span class="font-medium text-white text-sm">{{ corr.name }}</span>
                <v-chip size="x-small" color="green-darken-1" variant="flat" label class="text-white ml-auto">
                  Available
                </v-chip>
              </div>
              <div class="stream-card-details">
                <div class="detail-row">
                  <span class="detail-label">Source</span>
                  <span class="detail-value">{{ videoStore.getStreamDisplayInfo(corr.externalId).source }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Stream ID</span>
                  <span class="detail-value text-xs">{{ corr.externalId }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type</span>
                  <span class="detail-value">
                    <v-chip
                      size="x-small"
                      :color="
                        videoStore.getStreamDisplayInfo(corr.externalId).protocolLabel === 'RTSP'
                          ? '#e67e22'
                          : '#3498db'
                      "
                      variant="flat"
                      label
                      class="text-white"
                    >
                      {{ videoStore.getStreamDisplayInfo(corr.externalId).protocolLabel }}
                    </v-chip>
                  </span>
                </div>
                <div v-if="videoStore.getStreamDisplayInfo(corr.externalId).resolution !== '...'" class="detail-row">
                  <span class="detail-label">Resolution</span>
                  <span class="detail-value">
                    {{ videoStore.getStreamDisplayInfo(corr.externalId).resolution }}
                    <template v-if="videoStore.getStreamDisplayInfo(corr.externalId).fps">
                      @ {{ videoStore.getStreamDisplayInfo(corr.externalId).fps }}
                    </template>
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <p class="text-xs text-gray-500 mt-1">
          {{ affectedWidgetCount }} widget{{ affectedWidgetCount === 1 ? '' : 's' }} will be updated.
        </p>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { VideoStreamCorrespondency } from '@/types/video'
import type { MiniWidget, Widget } from '@/types/widgets'
import { MiniWidgetType, WidgetType } from '@/types/widgets'

import InteractionDialog, { type Action } from './InteractionDialog.vue'

const videoStore = useVideoStore()
const widgetStore = useWidgetManagerStore()

const STABILIZATION_DELAY_MS = 15000

const showDialog = ref(false)
const dialogTriggered = ref(false)
const stabilizationDone = ref(false)
const dismissedReplacements = useBlueOsStorage<string[]>('cockpit-dismissed-camera-replacements', [])
const replacementMap = ref<Record<string, string>>({})

let stabilizationTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  stabilizationTimer = setTimeout(() => {
    stabilizationDone.value = true
  }, STABILIZATION_DELAY_MS)
})

onBeforeUnmount(() => {
  if (stabilizationTimer) clearTimeout(stabilizationTimer)
})

/**
 * Check whether a correspondency entry's stream is currently live
 * @param {VideoStreamCorrespondency} corr - The stream correspondency to check
 * @returns {boolean} True if the stream is currently available
 */
const isStreamCurrentlyAvailable = (corr: VideoStreamCorrespondency): boolean => {
  if ((corr.protocol ?? 'webrtc') === 'webrtc') {
    return videoStore.namesAvailableWebRTCStreams.includes(corr.externalId)
  }
  return videoStore.streamInformation.some((s) => s.rtspSourceUrl === corr.rtspUrl)
}

const allVideoPlayerWidgets = computed((): Widget[] => {
  return widgetStore.currentProfile.views
    .flatMap((v) => v.widgets)
    .filter((w) => w.component === WidgetType.VideoPlayer)
})

const allMiniVideoRecorders = computed((): MiniWidget[] => {
  const fixedContainers = widgetStore.currentMiniWidgetsProfile.containers
  const viewContainers = widgetStore.currentProfile.views.flatMap((v) => v.miniWidgetContainers)
  return [...fixedContainers, ...viewContainers]
    .flatMap((c) => c.widgets)
    .filter((w) => w.component === MiniWidgetType.MiniVideoRecorder)
})

const allSnapshotTools = computed((): MiniWidget[] => {
  const fixedContainers = widgetStore.currentMiniWidgetsProfile.containers
  const viewContainers = widgetStore.currentProfile.views.flatMap((v) => v.miniWidgetContainers)
  return [...fixedContainers, ...viewContainers]
    .flatMap((c) => c.widgets)
    .filter((w) => w.component === MiniWidgetType.SnapshotTool)
})

const allWidgetStreamNames = computed((): string[] => {
  return [
    ...allVideoPlayerWidgets.value.map((w) => w.options.internalStreamName as string | undefined),
    ...allMiniVideoRecorders.value.map((w) => w.options.internalStreamName as string | undefined),
    ...allSnapshotTools.value.flatMap((w) => (w.options.selectedStreams as string[] | undefined) ?? []),
  ].filter((name): name is string => name !== undefined && name !== null)
})

const orphanedWidgetStreams = computed(() => {
  const uniqueNames = [...new Set(allWidgetStreamNames.value)]
  const results: {
    /**
     * Internal name of the stream
     */
    internalName: string
    /**
     * External ID of the stream
     */
    externalId: string
    /**
     * Number of widgets that use this stream
     */
    widgetCount: number
    /**
     * Display information about the stream
     */
    displayInfo: {
      /**
       * Source of the stream
       */
      source: string
      /**
       * Resolution of the stream
       */
      resolution: string
      /**
       * FPS of the stream
       */
      fps: string
      /**
       * Protocol label of the stream
       */
      protocolLabel: string
    }
  }[] = []

  for (const name of uniqueNames) {
    const corr = videoStore.streamsCorrespondency.find((c) => c.name === name)
    if (!corr) continue
    if (dismissedReplacements.value.includes(corr.externalId)) continue
    if (!isStreamCurrentlyAvailable(corr)) {
      results.push({
        internalName: name,
        externalId: corr.externalId,
        widgetCount: allWidgetStreamNames.value.filter((n) => n === name).length,
        displayInfo: videoStore.getStreamDisplayInfo(corr.externalId),
      })
    }
  }

  return results
})

const unusedAvailableStreams = computed(() => {
  const usedNames = new Set(allWidgetStreamNames.value)

  return videoStore.streamsCorrespondency.filter((corr) => {
    if (usedNames.has(corr.name)) return false
    return isStreamCurrentlyAvailable(corr)
  })
})

const replacementItems = computed(() => {
  return unusedAvailableStreams.value.map((corr) => {
    const info = videoStore.getStreamDisplayInfo(corr.externalId)
    return {
      internalName: corr.name,
      label: `${corr.name} (${info.protocolLabel} - ${info.resolution})`,
    }
  })
})

const affectedWidgetCount = computed((): number => {
  return orphanedWidgetStreams.value.reduce((sum, o) => sum + o.widgetCount, 0)
})

const initReplacementMap = (): void => {
  const map: Record<string, string> = {}
  const defaultTarget = unusedAvailableStreams.value[0]?.name
  for (const orphan of orphanedWidgetStreams.value) {
    map[orphan.internalName] = replacementMap.value[orphan.internalName] ?? defaultTarget ?? ''
  }
  replacementMap.value = map
}

const markDismissed = (): void => {
  const ids = orphanedWidgetStreams.value.map((o) => o.externalId)
  const newDismissed = ids.filter((id) => !dismissedReplacements.value.includes(id))
  if (newDismissed.length > 0) {
    dismissedReplacements.value = [...dismissedReplacements.value, ...newDismissed]
  }
}

const replaceStreams = (): void => {
  for (const orphan of orphanedWidgetStreams.value) {
    const newInternalName = replacementMap.value[orphan.internalName]
    if (!newInternalName) continue

    for (const widget of allVideoPlayerWidgets.value) {
      if (widget.options.internalStreamName === orphan.internalName) {
        widget.options.internalStreamName = newInternalName
      }
    }
    for (const miniWidget of allMiniVideoRecorders.value) {
      if (miniWidget.options.internalStreamName === orphan.internalName) {
        miniWidget.options.internalStreamName = newInternalName
      }
    }
    for (const snapshotWidget of allSnapshotTools.value) {
      const streams = snapshotWidget.options.selectedStreams as string[] | undefined
      if (!streams) continue
      const idx = streams.indexOf(orphan.internalName)
      if (idx !== -1) {
        streams[idx] = newInternalName
      }
    }

    videoStore.deleteStreamCorrespondency(orphan.externalId)
  }

  markDismissed()
  showDialog.value = false
}

const handleDialogClose = (value: boolean): void => {
  if (!value) {
    showDialog.value = false
  }
}

const dialogActions = computed((): Action[] => [
  {
    text: 'Dismiss',
    action: () => {
      markDismissed()
      showDialog.value = false
    },
  },
  {
    text: 'Replace stream',
    color: 'white',
    action: replaceStreams,
  },
])

watch(
  [stabilizationDone, orphanedWidgetStreams, unusedAvailableStreams],
  () => {
    if (!stabilizationDone.value) return

    const hasOrphans = orphanedWidgetStreams.value.length > 0
    const hasReplacements = unusedAvailableStreams.value.length > 0

    if (!hasOrphans || !hasReplacements) {
      if (showDialog.value) showDialog.value = false
      dialogTriggered.value = false
      return
    }

    if (dialogTriggered.value) return

    dialogTriggered.value = true
    initReplacementMap()
    showDialog.value = true
  },
  { immediate: true }
)
</script>

<style scoped>
.stream-card {
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stream-card.unavailable {
  background-color: rgba(198, 40, 40, 0.1);
  border: 1px solid rgba(198, 40, 40, 0.3);
}

.stream-card.available {
  background-color: rgba(46, 125, 50, 0.1);
  border: 1px solid rgba(46, 125, 50, 0.3);
}

.stream-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stream-card-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 26px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  min-width: 70px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
