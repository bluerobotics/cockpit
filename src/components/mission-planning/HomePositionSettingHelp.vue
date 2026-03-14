<template>
  <v-dialog :model-value="modelValue" max-width="560px">
    <v-card :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="font-weight-bold py-4 text-center">
        {{ $t('missionPlanning.homeWaypointNotSet') }}
      </v-card-title>
      <v-card-text class="px-12">
        <div class="flex flex-col items-center gap-4">
          <div class="rounded w-[260px] h-auto border-[#FFFFFF22] border-2 elevation-2">
            <img :src="helpGif" alt="Animated help" class="self-center" />
          </div>
          <p class="text-m mt-2 text-justify">
            {{ $t('missionPlanning.homeWaypointDescription') }}
          </p>
        </div>
      </v-card-text>
      <v-divider inset class="mx-4" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <div />
          <v-btn color="white" variant="text" @click="closeDialog">{{ $t('common.close') }}</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import helpGif from '@/assets/home-wp-help.gif'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

defineProps<{
  /** Whether the dialog is visible */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const closeDialog = (): void => {
  emit('update:modelValue', false)
}
</script>
