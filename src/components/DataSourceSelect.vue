<template>
  <div class="flex flex-col gap-y-2">
    <v-select
      v-if="!config.configUseCustomVariable.value"
      :model-value="config.configVariableId.value"
      :label="label"
      :items="presets"
      item-title="title"
      item-value="value"
      :value-comparator="isSameDataLakeVariableId"
      hide-details
      theme="dark"
      variant="outlined"
      density="compact"
      @update:model-value="config.onSourceSelected"
    />
    <v-autocomplete
      v-else
      :model-value="config.configVariableId.value"
      :items="config.availableDataLakeNumberVariables.value"
      item-title="name"
      item-value="id"
      :value-comparator="isSameDataLakeVariableId"
      :label="label"
      :hint="customHint"
      persistent-hint
      theme="dark"
      variant="outlined"
      density="compact"
      clearable
      prepend-inner-icon="mdi-magnify"
      @update:model-value="config.onSourceSelected"
    />
    <v-checkbox
      :model-value="config.configUseCustomVariable.value"
      :label="t`Use custom data lake variable`"
      hide-details
      @update:model-value="config.onUseCustomVariableToggled"
    />
  </div>
</template>

<script setup lang="ts">
import type { DataSourceConfig } from '@/composables/useDataSourceConfig'
import { isSameDataLakeVariableId } from '@/libs/actions/data-lake'
import type { DataSourcePreset } from '@/libs/data-sources/source-options'

defineProps<{
  /** Draft source config returned by useDataSourceConfig. */
  config: DataSourceConfig
  /** Preset sources listed when no custom variable is picked. */
  presets: DataSourcePreset[]
  /** Field label. */
  label: string
  /** Hint under the custom variable picker, stating the unit a custom variable is read in. */
  customHint: string
}>()
</script>
