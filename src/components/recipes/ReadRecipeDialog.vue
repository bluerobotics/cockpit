<template>
  <RecipeDialog
    :model-value="modelValue"
    title="Read recipe"
    :items="items"
    :dependencies="dependencies"
    :selected="selected"
    :conflicts="conflicts"
    primary-text="Read recipe"
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
            Created {{ new Date(recipe.createdAt).toLocaleString() }}
          </span>
        </div>
        <span v-else class="text-body-2 text-white/70">Choose a recipe file to see what it holds.</span>
        <v-btn
          size="small"
          class="bg-[#FFFFFF22] text-white shrink-0"
          prepend-icon="mdi-file-upload-outline"
          @click="chooseFile"
        >
          {{ recipe ? 'Choose another file' : 'Choose recipe file' }}
        </v-btn>
      </div>
      <template v-if="recipe">
        <p v-if="recipe.description" class="text-body-2 whitespace-pre-wrap">{{ recipe.description }}</p>
        <p class="text-body-2">
          {{ selected.length }} of {{ items.length }} item(s) chosen.
          <span v-if="conflicts.length > 0">{{ conflicts.length }} already exist here and will be replaced.</span>
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
      ? ['run code in Cockpit']
      : []),
    ...(actionTypes.includes(customActionTypes.mavlinkMessage) ? ['send messages to the vehicle'] : []),
    ...(actionTypes.includes(customActionTypes.httpRequest) || chosen.websocketConnections.length > 0
      ? ['connect to other computers']
      : []),
    ...(chosen.actions.some((action) => action.link) ? ['run actions by themselves when variables change'] : []),
  ]
  const leftOut = selected.value.length < items.value.length
  const leftOutNeeded = Object.keys(missingDependencies(selected.value, dependencies.value)).length > 0
  return [
    ...(effects.length > 0 ? [`Only read recipes you trust. The chosen items ${effects.join(', ')}.`] : []),
    // The dialog itself warns when what is left out is needed, so this only covers the rest.
    ...(leftOut && !leftOutNeeded
      ? ['The recipe is meant to be read as a whole. Leaving items out may stop the rest from working.']
      : []),
    ...(droppedEntries.value > 0
      ? [`${droppedEntries.value} item(s) of the file are damaged or would replace Cockpit's own, and are not listed.`]
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
    openSnackbar({
      message: `Could not read ${file.name}: ${(error as Error).message}`,
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
  const diyNote = recipe.value.diyWidgets.length > 0 ? ' DIY widgets are in Settings > DIY widgets.' : ''
  if (result.failed.length > 0) {
    openSnackbar({
      message: `Read "${name}", but ${result.failed.length} item(s) failed: ${result.failed.join('; ')}`,
      variant: 'error',
      duration: 10000,
    })
  } else {
    openSnackbar({
      message: `Read "${name}": ${result.applied} item(s) added.${diyNote}`,
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
  showDialog({
    title: 'Read part of the recipe?',
    variant: 'warning',
    maxWidth: 520,
    message: [
      `${items.value.length - selected.value.length} item(s) of the recipe were left out, so it may not work as made.`,
      ...(missingNames.length > 0 ? [`Chosen items need: ${missingNames.join(', ')}.`] : []),
    ],
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction('Cancelled reading part of a recipe')
          closeDialog()
        },
      },
      {
        text: 'Read anyway',
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
