<template>
  <RecipeDialog
    :model-value="modelValue"
    :title="t`Read recipe`"
    :items="items"
    :dependencies="dependencies"
    :selected="selected"
    :conflicts="conflicts"
    :primary-text="t`Read recipe`"
    :primary-disabled="recipe === undefined || selected.length === 0"
    @update:model-value="emit('update:modelValue', $event)"
    @update:selected="selected = $event"
    @primary="confirmAndApply"
  >
    <template #general>
      <div class="flex items-center justify-between gap-x-3">
        <div v-if="recipe" class="flex flex-col min-w-0">
          <span class="text-h6 truncate">{{ recipe.name }}</span>
          <span v-if="recipe.createdAt" class="text-caption text-white/60">
            {{ t`Created` }} {{ new Date(recipe.createdAt).toLocaleString() }}
          </span>
        </div>
        <span v-else class="text-body-2 text-white/70">{{ t`Choose a recipe file to see what it holds.` }}</span>
        <v-btn
          size="small"
          class="bg-[#FFFFFF22] text-white shrink-0"
          prepend-icon="mdi-file-upload-outline"
          @click="chooseFile"
        >
          {{ recipe ? t`Choose another file` : t`Choose recipe file` }}
        </v-btn>
      </div>
      <template v-if="recipe">
        <p v-if="recipe.description" class="text-body-2 whitespace-pre-wrap">{{ recipe.description }}</p>
        <p class="text-body-2">
          {{ t`${selected.length} of ${items.length} item(s) chosen.` }}
          <span v-if="conflicts.length > 0">{{ t`${conflicts.length} already exist here and will be replaced.` }}</span>
        </p>
        <div v-for="warning in warnings" :key="warning" class="flex items-start gap-x-3 rounded-lg bg-[#FFFFFF11] p-3">
          <v-icon size="20" color="amber">mdi-alert-outline</v-icon>
          <span class="text-body-2">{{ warning }}</span>
        </div>
      </template>
    </template>
  </RecipeDialog>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { applyRecipe, existingItemKeys, withoutCockpitOwnedEntries } from '@/libs/recipe-local-setup'
import { missingDependencies, parseRecipe, pickRecipeItems, recipeDependencies, recipeItems } from '@/libs/recipes'
import { pickFilesFromDisk } from '@/libs/utils'
import { customActionTypes } from '@/types/cockpit-actions'
import type { CockpitRecipe } from '@/types/recipes'

import RecipeDialog from './RecipeDialog.vue'

const props = defineProps<{
  /**
   * Whether the dialog is open
   */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { openSnackbar } = useSnackbar()
const { showDialog, closeDialog } = useInteractionDialog()

const recipe = ref<CockpitRecipe>()
const droppedEntries = ref(0)
const selected = ref<string[]>([])
const conflicts = ref<string[]>([])
const items = computed(() => (recipe.value ? recipeItems(recipe.value) : []))
const dependencies = computed(() => (recipe.value ? recipeDependencies(recipe.value) : {}))

watch(
  () => props.modelValue,
  (open) => {
    if (open) recipe.value = undefined
  }
)

const warnings = computed(() => {
  if (!recipe.value) return []
  const chosen = pickRecipeItems(recipe.value, selected.value)
  const actionTypes = chosen.actions.map((action) => action.type)
  // Anything here starts working as soon as the recipe is read, with no further step from the user.
  const effects = [
    ...(chosen.diyWidgets.length > 0 || actionTypes.includes(customActionTypes.javascript)
      ? [t`run code in Cockpit`]
      : []),
    ...(actionTypes.includes(customActionTypes.mavlinkMessage) ? [t`send messages to the vehicle`] : []),
    ...(actionTypes.includes(customActionTypes.httpRequest) || chosen.websocketConnections.length > 0
      ? [t`connect to other computers`]
      : []),
    ...(chosen.actions.some((action) => action.link) ? [t`run actions by themselves when variables change`] : []),
    ...(chosen.actions.some((action) => action.autoRun) ? [t`run actions by themselves on a timer`] : []),
  ]
  const leftOut = selected.value.length < items.value.length
  const leftOutNeeded = Object.keys(missingDependencies(selected.value, dependencies.value)).length > 0
  const effectList = effects.join(', ')
  return [
    ...(effects.length > 0 ? [t`Only read recipes you trust. The chosen items ${effectList}.`] : []),
    // The dialog itself warns when what is left out is needed, so this only covers the rest.
    ...(leftOut && !leftOutNeeded
      ? [t`The recipe is meant to be read as a whole. Leaving items out may stop the rest from working.`]
      : []),
    ...(droppedEntries.value > 0
      ? [t`${droppedEntries.value} item(s) of the file are damaged or would replace Cockpit's own, and are not listed.`]
      : []),
  ]
})

const chooseFile = async (): Promise<void> => {
  logUserAction('Opened the file picker to read a recipe')
  const [file] = await pickFilesFromDisk('application/json,.json', false)
  if (file === undefined) return
  try {
    const parsed = parseRecipe(await file.text())
    const usable = withoutCockpitOwnedEntries(parsed.recipe)
    recipe.value = usable.recipe
    droppedEntries.value = parsed.droppedEntries + usable.droppedEntries
    selected.value = recipeItems(usable.recipe).map((item) => item.key)
    const existing = new Set(existingItemKeys())
    conflicts.value = selected.value.filter((key) => existing.has(key))
    logUserAction(`Loaded recipe "${parsed.recipe.name}" from file`)
  } catch (error) {
    const errorMessage = (error as Error).message
    openSnackbar({
      message: t`Could not read ${file.name}: ${errorMessage}`,
      variant: 'error',
      duration: 5000,
    })
  }
}

const apply = (): void => {
  if (!recipe.value) return
  const result = applyRecipe(pickRecipeItems(recipe.value, selected.value))
  const name = recipe.value.name
  logUserAction(`Read recipe "${name}", adding ${result.applied} item(s)`)
  const diyNote = recipe.value.diyWidgets.length > 0 ? ` ${t`DIY widgets are in Settings > DIY widgets.`}` : ''
  if (result.failed.length > 0) {
    const failures = result.failed.join('; ')
    openSnackbar({
      message: t`Read "${name}", but ${result.failed.length} item(s) failed: ${failures}`,
      variant: 'error',
      duration: 10000,
    })
  } else {
    openSnackbar({
      message: t`Read "${name}": ${result.applied} item(s) added.${diyNote}`,
      variant: 'success',
      duration: 5000,
    })
  }
  emit('update:modelValue', false)
}

const confirmAndApply = (): void => {
  if (selected.value.length === items.value.length) {
    apply()
    return
  }
  const missing = Object.values(missingDependencies(selected.value, dependencies.value)).flat()
  const missingNames = [...new Set(missing)].map((key) => items.value.find((item) => item.key === key)?.name ?? key)
  logUserAction('Opened the confirmation to read part of a recipe')
  const leftOutCount = items.value.length - selected.value.length
  const missingList = missingNames.join(', ')
  showDialog({
    title: t`Read part of the recipe?`,
    variant: 'warning',
    maxWidth: 520,
    message: [
      t`${leftOutCount} item(s) of the recipe were left out, so it may not work as made.`,
      ...(missingNames.length > 0 ? [t`Chosen items need: ${missingList}.`] : []),
    ],
    actions: [
      {
        text: t`Cancel`,
        action: () => {
          logUserAction('Cancelled reading part of a recipe')
          closeDialog()
        },
      },
      {
        text: t`Read anyway`,
        class: 'bg-[#FFFFFF33] text-white',
        action: () => {
          logUserAction('Confirmed reading part of a recipe')
          closeDialog()
          apply()
        },
      },
    ],
  })
}
</script>
