<template>
  <v-sheet rounded color="rgba(0, 0, 0, 0)" class="main-sheet">
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
    <template v-if="widget.options.showMissionName">
      <p class="text-left text-white text-h3">{{ store.missionName }}</p>
    </template>
    <template v-if="widget.options.showMissionUptime">
      <p class="text-left text-white text-h5">Uptime: {{ missionUptimeString }}</p>
    </template>
  </v-sheet>
  <v-dialog v-model="showOptionsDialog" width="50%">
    <v-card class="pa-2">
      <v-card-title>Mission Info widget config</v-card-title>
      <v-card-text>
        <v-checkbox v-model="widget.options.showMissionName" label="Show mission name" hide-details />
        <v-text-field v-model="store.missionName" hide-details="auto" label="Mission name" />
        <v-checkbox v-model="widget.options.showMissionUptime" label="Show mission uptime" hide-details />
        <v-btn class="ma-1" @click="store.missionStartTime = new Date()"> Reset mission uptime </v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { formatDistance } from 'date-fns'
import { computed, onBeforeMount, ref, toRefs } from 'vue'

import { useMissionStore } from '@/stores/mission'
import type { Widget } from '@/types/widgets'

const store = useMissionStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget
const showOptionsDialog = ref(false)

const timeNow = useTimestamp({ interval: 1000 })
const missionUptimeString = computed(() => {
  return formatDistance(store.missionStartTime, new Date(timeNow.value), {
    includeSeconds: true,
  })
})

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showMissionName: true,
      showMissionUptime: true,
    }
  }
  if (store.missionName === '') {
    store.missionName = 'Add a name to this mission'
  }
})
</script>

<style scoped>
.main-sheet {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.main-sheet p {
  text-shadow: 1px 1px 1px black;
}
</style>
