<template>
  <v-dialog v-model="dialog.show" max-width="540px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{
        $t('views.ConfigurationActionsView.actionLink.automaticTriggers')
      }}</v-card-title>
      <v-card-subtitle class="text-caption text-center"
        >{{ $t('views.ConfigurationActionsView.actionLink.action') }}:
        {{ dialog.action?.name ?? $t('views.ConfigurationActionsView.actionLink.unknown') }}</v-card-subtitle
      >
      <v-card-text class="px-8">
        <p class="text-subtitle-1 font-weight-bold mb-2">
          {{ $t('views.ConfigurationActionsView.actionLink.whenVariablesChange') }}
        </p>

        <v-autocomplete
          v-model="dialog.selectedVariables"
          :items="availableDataLakeVariables"
          :label="$t('views.ConfigurationActionsView.actionLink.dataLakeVariables')"
          multiple
          chips
          variant="outlined"
          density="compact"
          theme="dark"
          closable-chips
          clearable
          prepend-inner-icon="mdi-magnify"
        />

        <v-text-field
          v-model="frequencyHz"
          :label="$t('views.ConfigurationActionsView.actionLink.noFasterThan')"
          :suffix="$t('views.ConfigurationActionsView.actionLink.changesPerSecond')"
          theme="dark"
          type="number"
          min="0"
          variant="outlined"
          density="compact"
          class="mt-4"
        />

        <div class="mt-4">
          <p class="text-subtitle-1 font-weight-bold mb-2">
            {{ $t('views.ConfigurationActionsView.actionLink.timeBased') }}
          </p>
          <v-radio-group v-model="dialog.autoRunType" inline class="mt-2">
            <v-radio
              class="mx-2"
              value="none"
              :label="$t('views.ConfigurationActionsView.actionLink.noTimeTrigger')"
            ></v-radio>
            <v-radio
              class="mx-2"
              value="once"
              :label="$t('views.ConfigurationActionsView.actionLink.onStartup')"
            ></v-radio>
            <v-radio
              class="mx-2"
              value="interval"
              :label="$t('views.ConfigurationActionsView.actionLink.repeatedly')"
            ></v-radio>
          </v-radio-group>
          <div v-if="dialog.autoRunType !== 'none'" class="mt-4">
            <v-slider
              v-model="runDelaySeconds"
              :min="dialog.autoRunType === 'interval' ? 0.1 : 0"
              :max="10"
              :step="dialog.autoRunType === 'interval' ? 0.1 : 0.1"
              :label="
                dialog.autoRunType === 'interval'
                  ? $t('views.ConfigurationActionsView.actionLink.runEvery')
                  : $t('views.ConfigurationActionsView.actionLink.runAfter')
              "
              thumb-label
            >
              <template #append>
                <v-text-field
                  v-model="runDelaySeconds"
                  type="number"
                  density="compact"
                  style="width: 140px"
                  variant="outlined"
                  :suffix="
                    runDelaySeconds == 1
                      ? $t('views.ConfigurationActionsView.actionLink.second')
                      : $t('views.ConfigurationActionsView.actionLink.seconds')
                  "
                  hide-details
                  theme="dark"
                />
              </template>
            </v-slider>
          </div>
        </div>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn variant="text" @click="closeDialog">{{ $t('common.cancel') }}</v-btn>
          <v-btn :disabled="!isFormValid" @click="saveConfig">{{ $t('common.save') }}</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSnackbar } from '@/composables/snackbar'
import { getActionLink, removeActionLink, saveActionLink } from '@/libs/actions/action-links'
import { getAutoRunConfig, removeAutoRunConfig, saveAutoRunConfig } from '@/libs/actions/auto-run'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { ActionConfig } from '@/types/cockpit-actions'

const { t } = useI18n()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const emit = defineEmits<{
  (e: 'save', action: ActionConfig, variables: string[], minInterval: number): void
}>()

const defaultDialogConfig = {
  show: false,
  action: null as ActionConfig | null,
  selectedVariables: [] as string[],
  minInterval: 1000, // Default to every 1 second
  autoRunType: 'none' as 'none' | 'once' | 'interval',
  delayMs: 1000, // Default to 1 second
}

const dialog = ref(defaultDialogConfig)

const runDelaySeconds = computed({
  get: () => {
    return dialog.value.delayMs > 0 ? dialog.value.delayMs / 1000 : 0
  },
  set: (value: number) => {
    dialog.value.delayMs = Math.round(value * 1000)
  },
})

const frequencyHz = computed({
  get: () => {
    return dialog.value.minInterval > 0 ? 1000 / dialog.value.minInterval : 0
  },
  set: (value: number) => {
    dialog.value.minInterval = value > 0 ? 1000 / value : 0
  },
})

const availableDataLakeVariables = computed(() => {
  const variables = getAllDataLakeVariablesInfo()
  return Object.values(variables).map((variable) => ({
    title: variable.id,
    value: variable.id,
  }))
})

const isFormValid = computed(() => {
  return (
    dialog.value.action &&
    dialog.value.minInterval >= 0 &&
    (dialog.value.autoRunType === 'none' || dialog.value.delayMs >= 0)
  )
})

const openDialog = (item: ActionConfig): void => {
  const existingLink = getActionLink(item.id)
  const autoRunConfig = getAutoRunConfig(item.id)

  dialog.value = {
    show: true,
    action: item,
    selectedVariables: existingLink?.variables || [],
    minInterval: existingLink?.minInterval || 1000,
    autoRunType: autoRunConfig?.type || 'none',
    delayMs: ['once', 'interval'].includes(autoRunConfig?.type || 'none') ? autoRunConfig?.delayMs ?? 1000 : 1000,
  }
}

const closeDialog = (): void => {
  dialog.value = defaultDialogConfig
}

const saveConfig = (): void => {
  if (!dialog.value.action) {
    openSnackbar({ message: t('views.ConfigurationActionsView.actionLink.actionRequired'), variant: 'error' })
    return
  }

  if (dialog.value.minInterval <= 0) {
    openSnackbar({ message: t('views.ConfigurationActionsView.actionLink.frequencyError'), variant: 'error' })
    return
  }

  if (dialog.value.autoRunType === 'interval' && dialog.value.delayMs < 1) {
    openSnackbar({ message: t('views.ConfigurationActionsView.actionLink.intervalError'), variant: 'error' })
    return
  }

  if (dialog.value.autoRunType === 'once' && dialog.value.delayMs < 0) {
    openSnackbar({ message: t('views.ConfigurationActionsView.actionLink.startupDelayError'), variant: 'error' })
    return
  }

  // Always remove the existing link first
  removeActionLink(dialog.value.action.id)

  // Only create a new link if variables are selected
  if (dialog.value.selectedVariables.length > 0) {
    saveActionLink(
      dialog.value.action.id,
      dialog.value.action.type,
      dialog.value.selectedVariables,
      dialog.value.minInterval
    )
  }

  // Handle auto-run configuration
  removeAutoRunConfig(dialog.value.action.id)

  if (['once', 'interval'].includes(dialog.value.autoRunType)) {
    saveAutoRunConfig(dialog.value.action.id, {
      type: dialog.value.autoRunType,
      delayMs: parseInt(dialog.value.delayMs as unknown as string, 10),
    })
  }

  emit('save', dialog.value.action, dialog.value.selectedVariables, dialog.value.minInterval)
  closeDialog()
}

defineExpose({
  openDialog,
})
</script>
