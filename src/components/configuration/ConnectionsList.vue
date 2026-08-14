<template>
  <div class="flex flex-col w-full mt-2 pb-8">
    <div v-if="rows.length > 0" class="mb-4">
      <div
        v-for="row in rows"
        :key="row.key"
        class="flex items-center justify-between py-2 px-3 mb-2 rounded bg-[#FFFFFF11]"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <v-icon :color="getLoadingStatusColor(row.status)" size="small">
            {{ getLoadingStatusIcon(row.status) }}
          </v-icon>
          <span class="truncate text-sm" :title="row.title ?? row.address">{{ row.address }}</span>
          <span class="text-xs opacity-60">({{ row.statusLabel }})</span>
          <span v-if="row.details" class="text-xs opacity-60 truncate">{{ row.details }}</span>
        </div>
        <v-btn
          v-tooltip.bottom="removeTooltip"
          :aria-label="removeTooltip"
          icon="mdi-delete"
          size="x-small"
          variant="text"
          @click="emit('remove', row.key)"
        />
      </div>
    </div>
    <div v-else class="text-sm opacity-60 mb-4">{{ emptyMessage }}</div>
    <slot name="warning" />
    <div class="flex justify-start items-center">
      <v-text-field
        :model-value="modelValue"
        variant="outlined"
        type="input"
        density="compact"
        :label="addressLabel"
        :placeholder="addressPlaceholder"
        hide-details
        @update:model-value="emit('update:modelValue', $event)"
        @keyup.enter="emit('add')"
      />
      <v-btn
        :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
        :disabled="!modelValue.trim()"
        class="bg-transparent"
        :class="interfaceStore.isOnSmallScreen ? 'ml-1' : 'ml-5'"
        variant="text"
        @click="emit('add')"
      >
        {{ addButtonLabel }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConnectionStatus } from '@/libs/utils/ui'
import { getLoadingStatusColor, getLoadingStatusIcon } from '@/libs/utils/ui'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * One configured connection, as shown in the list.
 */
interface ConnectionRow {
  /**
   * Identifier passed back on removal.
   */
  key: string
  /**
   * Address shown to the user.
   */
  address: string
  /**
   * Full address for the hover title, when the shown one is abbreviated.
   */
  title?: string
  /**
   * Status the icon and its color come from.
   */
  status: ConnectionStatus
  /**
   * Status as shown to the user.
   */
  statusLabel: string
  /**
   * Extra information shown after the status.
   */
  details?: string
}

const interfaceStore = useAppInterfaceStore()

defineProps<{
  /**
   * Connections currently configured.
   */
  rows: ConnectionRow[]
  /**
   * Address being typed into the new-connection field.
   */
  modelValue: string
  /**
   * Line shown when nothing is configured.
   */
  emptyMessage: string
  /**
   * Label of the new-connection field.
   */
  addressLabel: string
  /**
   * Example address shown while the new-connection field is empty.
   */
  addressPlaceholder: string
  /**
   * Label of the button that adds what was typed.
   */
  addButtonLabel: string
  /**
   * Accessible name and tooltip of each row's remove button.
   */
  removeTooltip: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'add'): void
  (e: 'remove', key: string): void
}>()
</script>
