<template>
  <v-dialog v-if="modelValue" :model-value="modelValue" max-width="500px" persistent :z-index="5200">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="pb-0 pt-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <v-icon color="warning" size="24">mdi-alert</v-icon>
          <h2 class="text-xl font-semibold">Replace existing configuration?</h2>
        </div>
      </v-card-title>

      <v-card-text class="px-6 pb-2">
        <p class="text-center text-sm">
          This will <strong>permanently delete your current {{ viewsCount }} view(s)</strong> and replace them with the
          selected default view(s) for {{ vehicleTypeName }}. This action cannot be undone.
        </p>
      </v-card-text>

      <v-card-actions class="justify-space-between px-6 pb-4">
        <v-btn variant="text" @click="$emit('cancel')">Cancel</v-btn>
        <v-btn color="error" @click="$emit('confirm')">Replace</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useAppInterfaceStore } from '@/stores/appInterface'

defineProps<{
  /** Whether the confirmation dialog is currently open */
  modelValue: boolean
  /** Number of views the user currently has, shown in the warning copy */
  viewsCount: number
  /** Friendly vehicle type name shown in the warning copy */
  vehicleTypeName: string | undefined
}>()

defineEmits<{
  /** Emitted when the user confirms the destructive replace */
  (e: 'confirm'): void
  /** Emitted when the user cancels the confirmation */
  (e: 'cancel'): void
}>()

const interfaceStore = useAppInterfaceStore()
</script>
