<template>
  <RecipeDialog
    :model-value="modelValue"
    title="Create recipe"
    :items="items"
    :dependencies="dependencies"
    :selected="selected"
    primary-text="Save recipe"
    :primary-disabled="name.trim() === '' || selected.length === 0"
    @update:model-value="emit('update:modelValue', $event)"
    @update:selected="selected = $event"
    @primary="save"
  >
    <template #general>
      <p class="text-body-2 text-white/70">
        Choose, in each tab, what goes in the recipe. Items the chosen ones need are chosen with them.
      </p>
      <v-text-field v-model="name" label="Name" density="compact" variant="outlined" hide-details />
      <v-textarea
        v-model="description"
        label="Description"
        density="compact"
        variant="outlined"
        rows="3"
        auto-grow
        hide-details
      />
      <div class="flex items-center justify-between">
        <span class="text-body-2">{{ selected.length }} of {{ items.length }} item(s) chosen</span>
        <div class="flex gap-x-2">
          <v-btn size="small" variant="text" :disabled="selected.length === 0" @click="selectAll(false)"> Clear </v-btn>
          <v-btn size="small" class="bg-[#FFFFFF22] text-white" @click="selectAll(true)">Choose everything</v-btn>
        </div>
      </div>
    </template>
  </RecipeDialog>
</template>

<script setup lang="ts">
import { saveAs } from 'file-saver'
import { computed, ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { userSetupAsRecipe } from '@/libs/recipe-local-setup'
import { emptyRecipe, pickRecipeItems, recipeDependencies, recipeItems } from '@/libs/recipes'
import { sanitizeFilenameComponent } from '@/libs/utils'

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

const userSetup = ref(emptyRecipe())
const name = ref('')
const description = ref('')
const selected = ref<string[]>([])
const items = computed(() => recipeItems(userSetup.value))
const dependencies = computed(() => recipeDependencies(userSetup.value))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    userSetup.value = userSetupAsRecipe()
    selected.value = []
  }
)

const selectAll = (all: boolean): void => {
  logUserAction(all ? 'Chose every item for the new recipe' : 'Cleared the items chosen for the new recipe')
  selected.value = all ? items.value.map((item) => item.key) : []
}

const save = (): void => {
  const recipe = {
    ...pickRecipeItems(userSetup.value, selected.value),
    name: name.value.trim(),
    description: description.value.trim(),
    createdAt: new Date().toISOString(),
  }
  const fileName = `${sanitizeFilenameComponent(recipe.name)}.cockpit-recipe.json`
  logUserAction(`Saved recipe "${recipe.name}" with ${selected.value.length} item(s)`)
  saveAs(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }), fileName)
  openSnackbar({ message: `Recipe saved as ${fileName}.`, variant: 'success', duration: 5000 })
  emit('update:modelValue', false)
}
</script>
