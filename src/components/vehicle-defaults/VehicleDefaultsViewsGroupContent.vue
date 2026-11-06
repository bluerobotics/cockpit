<template>
  <div>
    <div v-if="showImportUi" class="space-y-3">
      <p class="text-sm opacity-80">
        {{
          t`Cockpit ships with the following default views for ${evaluation.vehicleTypeName}. Pick which ones to import, choose how to apply them, then check the preview below.`
        }}
      </p>

      <v-card variant="outlined" class="px-3 py-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-semibold">
            {{ t`Default views (${evaluation.views.defaultProfile.views.length})` }}
          </span>
          <div class="flex gap-1">
            <v-btn size="x-small" variant="text" @click="selectAllDefaultViews">{{ t`All` }}</v-btn>
            <v-btn size="x-small" variant="text" @click="selectNoneDefaultViews">{{ t`None` }}</v-btn>
          </div>
        </div>
        <div class="flex flex-col">
          <v-checkbox
            v-for="view in evaluation.views.defaultProfile.views"
            :key="view.hash"
            v-model="selectedDefaultViewNames"
            :value="view.name"
            density="compact"
            hide-details
            class="m-0 p-0"
          >
            <template #label>
              <span class="text-sm">
                {{ view.name }}
                <span class="ml-1 text-xs">· {{ t`${view.widgets.length} widgets` }}</span>
              </span>
            </template>
          </v-checkbox>
        </div>
      </v-card>

      <v-card v-if="!isCurrentViewsGroupBlank" variant="outlined" class="px-3 py-2">
        <div class="mb-1 text-sm font-semibold">{{ t`How to apply` }}</div>
        <v-radio-group v-model="viewsMode" hide-details density="compact" class="mt-0">
          <v-radio value="append">
            <template #label>
              <span class="text-sm">
                <strong>{{ t`Append` }}</strong> {{ t`after your existing view(s)` }}
              </span>
            </template>
          </v-radio>
          <v-radio value="replace">
            <template #label>
              <span class="text-sm">
                <strong>{{ t`Replace` }}</strong> {{ t`your current view(s)` }}
              </span>
            </template>
          </v-radio>
        </v-radio-group>
      </v-card>

      <v-card variant="outlined" class="px-3 py-2">
        <div class="mb-1 text-sm font-semibold">{{ t`Views group preview` }}</div>
        <div class="rounded-md bg-gray-600/60 px-2 py-2">
          <div class="mb-2 grid grid-cols-[1fr_auto_1fr] gap-x-2.5">
            <p class="text-right text-[11px] leading-none text-gray-300/50">{{ t`Before` }}</p>
            <div class="w-4" />
            <p class="text-left text-[11px] leading-none text-gray-300/50">{{ t`After` }}</p>
          </div>
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2.5">
            <div class="flex flex-col items-end gap-0.5">
              <span
                v-for="(name, index) in viewsPreviewBeforeNames"
                :key="`before-${index}-${name}`"
                class="text-right text-xs leading-snug text-gray-300"
              >
                {{ name }}
              </span>
              <span v-if="viewsPreviewBeforeNames.length === 0" class="text-right text-xs leading-snug text-gray-300">
                {{ t`No views` }}
              </span>
            </div>
            <div class="flex self-stretch items-center justify-center px-0.5">
              <v-icon size="16" color="green" class="shrink-0">mdi-arrow-right</v-icon>
            </div>
            <div class="flex flex-col items-start gap-0.5">
              <span
                v-for="(name, index) in viewsPreviewAfterNames"
                :key="`after-${index}-${name}`"
                class="text-left text-xs leading-snug text-green-400"
              >
                {{ name }}
              </span>
              <span v-if="viewsPreviewAfterNames.length === 0" class="text-left text-xs leading-snug text-green-400">
                {{ t`No views` }}
              </span>
            </div>
          </div>
        </div>
      </v-card>
    </div>

    <div v-else-if="variant === 'wizard' && evaluation?.views.defaultProfile && !hasImportOffer" class="space-y-3">
      <p class="text-sm text-center opacity-80">
        {{ t`Your views group already includes the default views for ${evaluation.vehicleTypeName}. Click` }}
        <strong>{{ t`Next` }}</strong> {{ t`to finish.` }}
      </p>
    </div>

    <div v-else class="py-2 text-center text-sm opacity-80">
      <template v-if="variant === 'wizard'">
        {{ t`No default views are available for ${vehicleTypeName}. Click` }}
        <strong>{{ t`Next` }}</strong> {{ t`to finish.` }}
      </template>
      <template v-else>
        {{ t`No default views are available for ${vehicleTypeName}.` }}
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed } from 'vue'

import { useVehicleDefaultsViewsImportInject } from '@/composables/vehicleDefaults/useVehicleDefaultsViewsImport'

const props = withDefaults(
  defineProps<{
    /** Wizard steps reference Next; standalone always shows import UI when defaults exist */
    variant?: 'wizard' | 'standalone'
  }>(),
  { variant: 'standalone' }
)

const {
  evaluation,
  hasDefaultProfile,
  hasImportOffer,
  selectedDefaultViewNames,
  viewsMode,
  viewsPreviewBeforeNames,
  viewsPreviewAfterNames,
  isCurrentViewsGroupBlank,
  selectAllDefaultViews,
  selectNoneDefaultViews,
} = useVehicleDefaultsViewsImportInject()

const showImportUi = computed(() => (props.variant === 'standalone' ? hasDefaultProfile.value : hasImportOffer.value))
const vehicleTypeName = computed(() => evaluation.value?.vehicleTypeName ?? t`this vehicle`)
</script>
