<template>
  <BaseConfigurationView>
    <template #title>Recipes</template>
    <template #content>
      <div class="flex flex-col gap-y-4 py-3" :class="interfaceStore.isOnSmallScreen ? 'w-[80vw]' : 'w-[480px]'">
        <p class="text-body-2 text-white/70">
          A recipe bundles your data lake variables, actions, WebSocket connections and DIY widgets in one file, to set
          up another Cockpit the same way or share a setup with others.
        </p>
        <div class="flex gap-x-3">
          <v-btn class="flex-1 bg-[#FFFFFF22] text-white" prepend-icon="mdi-file-export-outline" @click="openCreate">
            Create recipe
          </v-btn>
        </div>
      </div>
      <CreateRecipeDialog v-model="showCreateDialog" />
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import CreateRecipeDialog from '@/components/recipes/CreateRecipeDialog.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const showCreateDialog = ref(false)

const openCreate = (): void => {
  logUserAction('Opened the "Create recipe" dialog')
  showCreateDialog.value = true
}
</script>
