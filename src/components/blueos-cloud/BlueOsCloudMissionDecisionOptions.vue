<template>
  <div class="flex flex-col gap-3 w-full">
    <v-btn v-if="previousMission" variant="flat" class="bg-[#FFFFFF22] h-auto py-3" @click="onContinuePrevious">
      <div class="flex flex-col items-start gap-1 w-full text-left normal-case">
        <div class="flex items-center gap-2">
          <v-icon size="20">mdi-history</v-icon>
          <span class="font-medium">Continue previous mission</span>
        </div>
        <span class="text-caption opacity-80 font-normal whitespace-normal">
          {{ previousMissionSummary }}
        </span>
      </div>
    </v-btn>

    <v-btn variant="flat" class="bg-[#FFFFFF22]" prepend-icon="mdi-folder-open-outline" @click="onSelectExisting">
      Select existing mission
    </v-btn>

    <v-btn variant="flat" class="bg-[#FFFFFF22]" prepend-icon="mdi-plus" @click="onCreateNew">
      Create a new mission
    </v-btn>

    <v-btn v-if="showSkip" variant="text" class="mt-1" @click="onSkip"> Continue without a mission </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'

const props = withDefaults(
  defineProps<{
    /**
     * Last linked cloud mission, when one is available to continue.
     */
    previousMission?: BlueOsCloudMission | null
    /**
     * Whether to show the "continue without a mission" action (startup dialog).
     */
    showSkip?: boolean
  }>(),
  { previousMission: null, showSkip: false }
)

const emit = defineEmits<{
  (e: 'continue-previous'): void
  (e: 'select-existing'): void
  (e: 'create-new'): void
  (e: 'skip'): void
}>()

const previousMissionSummary = computed(() => {
  const mission = props.previousMission
  if (!mission) return ''
  const parts = [mission.title?.trim() || 'Untitled mission']
  if (mission.description?.trim()) parts.push(mission.description.trim())
  if (mission.start_latitude && mission.start_longitude) {
    const lat = parseFloat(mission.start_latitude)
    const lng = parseFloat(mission.start_longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) parts.push(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }
  return parts.join(' · ')
})

const onContinuePrevious = (): void => {
  logUserAction('Chose to continue the previous BlueOS Cloud mission')
  emit('continue-previous')
}

const onSelectExisting = (): void => {
  logUserAction('Chose to select an existing BlueOS Cloud mission')
  emit('select-existing')
}

const onCreateNew = (): void => {
  logUserAction('Chose to create a new BlueOS Cloud mission')
  emit('create-new')
}

const onSkip = (): void => {
  logUserAction('Chose to continue without a BlueOS Cloud mission')
  emit('skip')
}
</script>
