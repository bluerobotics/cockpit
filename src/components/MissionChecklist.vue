<template>
  <v-dialog v-model="openDialog" max-width="600" scrollable persistent>
    <v-card :style="interfaceStore.globalGlassMenuStyles" class="rounded-lg">
      <v-card-title class="text-center relative pt-3">
        <h6 class="ml-4">Warning! Your vehicle is about to be armed</h6>
        <v-btn icon variant="text" color="white" class="absolute right-1 top-1" aria-label="Close" @click="onCancel">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text class="mt-[-10px]">
        <v-list lines="one" theme="dark" class="bg-transparent">
          <v-list-item v-for="item in checklistItems" :key="item.id" theme="dark">
            <template #prepend>
              <v-checkbox
                v-model="doneById[item.id]"
                class="mt-0"
                hide-details
                density="compact"
                :disabled="!missionStore.showChecklistBeforeArm"
              />
            </template>
            <v-list-item-title
              :class="[
                { 'line-through opacity-60': doneById[item.id] },
                { 'opacity-50': !missionStore.showChecklistBeforeArm },
              ]"
            >
              {{ item.text }}
            </v-list-item-title>
            <template v-if="isOnEditMode && checklistItems.length > 1" #append>
              <v-btn icon variant="text" :disabled="!missionStore.showChecklistBeforeArm" @click="removeItem(item.id)">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
        <div class="flex justify-end">
          <div v-if="!isOnEditMode" class="fixed top-[80px] right-5">
            <v-btn
              prepend-icon="mdi-format-list-checks"
              :disabled="!missionStore.showChecklistBeforeArm"
              variant="text"
              color="white"
              size="small"
              class="elevation-1 bg-[#FFFFFF15] hover:bg-[#FFFFFF22]"
              @click="isOnEditMode = true"
            >
              Edit Items
            </v-btn>
          </div>
          <div v-else class="flex w-full items-center">
            <v-text-field
              v-if="isOnEditMode"
              ref="newItemInput"
              v-model="newItemText"
              :disabled="!missionStore.showChecklistBeforeArm"
              variant="filled"
              density="compact"
              placeholder="Type an item and press Enter"
              hide-details
              class="ml-6 w-[80%]"
              append-inner-icon="mdi-plus"
              @keyup.enter="addItem"
              @click:append-inner="addItem"
            />
            <v-btn
              prepend-icon="mdi-check"
              :disabled="!missionStore.showChecklistBeforeArm"
              variant="text"
              color="white"
              size="small"
              class="elevation-1 bg-[#FFFFFF15] hover:bg-[#FFFFFF22] ml-10"
              @click="
                () => {
                  isOnEditMode = false
                  addItem()
                }
              "
              >Done</v-btn
            >
          </div>
        </div>
      </v-card-text>
      <v-divider class="flex center w-[80%]" inset />
      <v-card-actions>
        <div class="flex justify-between w-full py-1 px-2 pt-3">
          <v-btn variant="text" @click="onCancel">Cancel</v-btn>
          <div class="flex items-center">
            <v-checkbox
              :model-value="!missionStore.showChecklistBeforeArm"
              class="mt-0 scale-[0.8]"
              hide-details
              density="compact"
              @update:model-value="(val) => (missionStore.showChecklistBeforeArm = !val)"
            />
            <p class="text-xs text-center ml-2">Don't show this checklist again</p>
          </div>
          <v-btn
            color="#ffffff33"
            :class="{ 'opacity-30': !isArmingEnabled }"
            variant="flat"
            :disabled="!isArmingEnabled"
            @click="onConfirm"
            >Go</v-btn
          >
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onMounted } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

type ChecklistItem = {
  /**
   * Unique identifier for the checklist item
   */
  id: number
  /**
   * Text description of the checklist item
   */
  text: string
}

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()

const props = defineProps<{
  /**
   * Whether the dialog is open
   */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirmed', value: boolean): void
  (e: 'dismissed'): void
}>()

const checklistItems = useBlueOsStorage<ChecklistItem[]>('cockpit-pre-arm-checklist', [])

const doneById = ref<Record<number, boolean>>({})
const newItemText = ref('')
const newItemInput = ref<any>(null)
const isOnEditMode = ref(false)

const openDialog = computed(() => props.modelValue)

const resetDoneState = (): void => {
  const next: Record<number, boolean> = {}
  for (const i of checklistItems.value ?? []) next[i.id] = false
  doneById.value = next
}

const isArmingEnabled = computed<boolean>(() => {
  if (!missionStore.showChecklistBeforeArm) return true
  const list = checklistItems.value ?? []
  return list.length > 0 && list.every((i) => doneById.value[i.id] === true)
})

watch(
  () => openDialog.value,
  (open) => {
    if (open) {
      resetDoneState()
      nextTick(() => newItemInput.value?.focus?.())
    } else {
      doneById.value = {}
      isOnEditMode.value = false
    }
  }
)

watch(
  () => checklistItems.value,
  (list) => {
    if (!openDialog.value) return
    const current = { ...doneById.value }
    const keep: Record<number, true> = {}
    for (const i of list ?? []) {
      keep[i.id] = true
      if (!(i.id in current)) current[i.id] = false
    }
    for (const idStr of Object.keys(current)) {
      const id = Number(idStr)
      if (!keep[id]) delete current[id]
    }
    doneById.value = current
  },
  { deep: true }
)

const addItem = async (): Promise<void> => {
  const text = newItemText.value.trim()
  if (!text) return
  const newEntry: ChecklistItem = { id: Date.now(), text }
  checklistItems.value.push(newEntry)
  if (openDialog.value) doneById.value[newEntry.id] = false
  newItemText.value = ''
  await nextTick()
  newItemInput.value?.focus?.()
}

const removeItem = (id: number): void => {
  checklistItems.value = checklistItems.value.filter((i) => i.id !== id)
  if (id in doneById.value) {
    const copy = { ...doneById.value }
    delete copy[id]
    doneById.value = copy
  }
}

const onCancel = (): void => {
  emit('dismissed')
  emit('update:modelValue', false)
}

const onConfirm = (): void => {
  emit('confirmed', true)
  emit('update:modelValue', false)
}

onMounted(() => {
  if (checklistItems.value.length === 0) {
    checklistItems.value = [{ id: Date.now(), text: 'Ensure the vehicle is safe to launch' }]
  }
  if (openDialog.value) {
    resetDoneState()
  }
})

watch(
  () => missionStore.showChecklistBeforeArm,
  (value) => {
    if (!value) {
      openSnackbar({
        message: `Pre-arm checklist disabled. You can re-enable it in Settings → Mission → Enable pre-arm checklist.`,
        variant: 'info',
        duration: 5000,
      })
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.line-through {
  text-decoration: line-through;
}
</style>
