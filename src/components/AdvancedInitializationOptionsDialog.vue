<template>
  <teleport to="body">
    <InteractionDialog v-model:show-dialog="internalShowDialog" max-width="680" variant="text-only" persistent>
      <template #title>
        <div class="relative flex items-center w-full justify-center">
          <span>Advanced initialization options</span>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col w-full -mt-6 gap-4 mb-2 max-h-[60vh] overflow-y-auto pr-1">
          <p class="text-sm text-white/85">
            These options change how Cockpit itself starts up, and are meant for working around graphics and video
            problems on specific computers. They only take effect after a restart. If Cockpit fails to start with an
            option enabled, it is turned off automatically on the next launch.
          </p>

          <div
            v-if="disabledAfterFailedStartup.length > 0"
            class="rounded-md bg-[#FFCC0022] border border-[#FFCC0055] px-3 py-3"
          >
            <div class="flex items-center gap-2">
              <v-icon size="18" color="#FFCC00">mdi-alert-outline</v-icon>
              <span class="text-[14px] font-semibold text-white">Options turned off after a failed startup</span>
            </div>
            <p class="text-[12px] text-white/70 leading-snug mt-1">
              Cockpit could not finish starting with {{ disabledAfterFailedStartup.map(withDashes).join(', ') }}, so it
              started without them.
            </p>
          </div>

          <div
            v-for="option in availableOptions"
            :key="option.entry"
            role="switch"
            tabindex="0"
            :aria-checked="isEnabled(option.entry)"
            class="rounded-md bg-white/[0.04] border border-white/10 px-3 py-3 cursor-pointer hover:bg-white/[0.06] transition-colors duration-150"
            @click="setOptionEnabled(option, !isEnabled(option.entry))"
            @keydown.enter.prevent="setOptionEnabled(option, !isEnabled(option.entry))"
            @keydown.space.prevent="setOptionEnabled(option, !isEnabled(option.entry))"
          >
            <div class="flex items-center gap-3">
              <span class="text-[14px] font-semibold text-white">{{ option.title }}</span>
              <v-switch
                :model-value="isEnabled(option.entry)"
                hide-details
                density="compact"
                color="#4fa483"
                class="ml-auto -my-1 scale-75"
                inset
                :aria-label="option.title"
                @click.stop
                @update:model-value="setOptionEnabled(option, Boolean($event))"
              />
            </div>
            <code class="text-[11px] text-[#8ecfae] font-mono">{{ withDashes(option.entry) }}</code>
            <p class="text-[12px] text-white/70 leading-snug mt-1">{{ option.description }}</p>
          </div>

          <div class="rounded-md bg-white/[0.04] border border-white/10 px-3 py-3">
            <span class="text-[14px] font-semibold text-white">Custom options</span>
            <p class="text-[12px] text-white/70 leading-snug mt-1 mb-2">
              Add a switch only if you were asked to. Unknown switches are ignored by Cockpit, but a valid one can still
              stop it from rendering.
            </p>
            <div class="flex items-start gap-2">
              <v-text-field
                v-model="customEntry"
                density="compact"
                variant="outlined"
                hide-details="auto"
                placeholder="disable-gpu-compositing"
                aria-label="Custom initialization switch"
                :error-messages="customEntryError ? [customEntryError] : []"
                class="flex-1"
                @keydown.enter.prevent="addCustomEntry"
              />
              <v-btn
                variant="flat"
                size="small"
                class="bg-[#FFFFFF33] text-white mt-1"
                :disabled="!canAddCustomEntry"
                @click="addCustomEntry"
              >
                Add
              </v-btn>
            </div>
            <div v-if="customEntries.length > 0" class="flex flex-wrap gap-2 mt-3">
              <v-chip
                v-for="entry in customEntries"
                :key="entry"
                size="small"
                closable
                variant="outlined"
                @click:close="removeCustomEntry(entry)"
              >
                {{ withDashes(entry) }}
              </v-chip>
            </div>
          </div>
        </div>
      </template>
      <template #actions>
        <div class="flex w-full justify-end items-center gap-2 px-1">
          <v-btn variant="text" size="small" @click="cancel">Cancel</v-btn>
          <v-btn
            variant="flat"
            size="small"
            class="bg-[#FFFFFF33] text-white"
            :disabled="!hasChanges"
            @click="saveAndRestart"
          >
            Save and restart
          </v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  type PredefinedChromiumSwitch,
  predefinedChromiumSwitches,
  validateChromiumSwitchEntry,
} from '@/libs/chromium-switches'
import { Platform } from '@/types/platform'

const props = defineProps<{
  /**
   * Whether the dialog should be shown.
   */
  showDialog: boolean
}>()

const emit = defineEmits<{
  /**
   * Fired when the dialog opens or closes.
   */
  (event: 'update:showDialog', value: boolean): void
}>()

const { openSnackbar } = useSnackbar()

const internalShowDialog = computed({
  get: () => props.showDialog,
  set: (value: boolean) => emit('update:showDialog', value),
})

const entries = ref<string[]>([])
const savedEntries = ref<string[]>([])
const disabledAfterFailedStartup = ref<string[]>([])
const platform = ref<string>('')
const customEntry = ref('')

const normalize = (entry: string): string => entry.trim().replace(/^-+/, '')
const withDashes = (entry: string): string => `--${entry}`

// Falling back to every option keeps the list usable if the platform cannot be read.
const availableOptions = computed(() => {
  const current = platform.value as Platform
  if (!Object.values(Platform).includes(current)) return predefinedChromiumSwitches
  return predefinedChromiumSwitches.filter(({ platforms }) => platforms.includes(current))
})

// Options saved on another platform have no card here, so they are listed as custom rather than left invisible.
const customEntries = computed(() =>
  entries.value.filter((entry) => !availableOptions.value.some((option) => option.entry === entry))
)

const customEntryError = computed(() => {
  if (customEntry.value.trim() === '') return undefined
  const normalized = normalize(customEntry.value)
  if (entries.value.includes(normalized)) return 'This switch was already added.'
  return validateChromiumSwitchEntry(customEntry.value)
})

const canAddCustomEntry = computed(() => customEntry.value.trim() !== '' && customEntryError.value === undefined)

const hasChanges = computed(() => {
  const current = [...entries.value].sort()
  const saved = [...savedEntries.value].sort()
  return current.length !== saved.length || current.some((entry, index) => entry !== saved[index])
})

const isEnabled = (entry: string): boolean => entries.value.includes(entry)

const load = async (): Promise<void> => {
  const state = await window.electronAPI?.getChromiumSwitches()
  entries.value = (state?.entries ?? []).map(normalize)
  savedEntries.value = [...entries.value]
  disabledAfterFailedStartup.value = (state?.disabledAfterFailedStartup ?? []).map(normalize)
  platform.value = (await window.electronAPI?.getSystemInfo())?.platform ?? ''
  customEntry.value = ''
}

watch(
  () => props.showDialog,
  (isOpen) => {
    if (isOpen) load()
  },
  { immediate: true }
)

const setOptionEnabled = (option: PredefinedChromiumSwitch, enabled: boolean): void => {
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} the "${option.title}" initialization option`)
  entries.value = enabled
    ? [...new Set([...entries.value, option.entry])]
    : entries.value.filter((entry) => entry !== option.entry)
}

const addCustomEntry = (): void => {
  if (!canAddCustomEntry.value) return
  const normalized = normalize(customEntry.value)
  logUserAction(`Added the custom initialization switch "${withDashes(normalized)}"`)
  entries.value = [...entries.value, normalized]
  customEntry.value = ''
}

const removeCustomEntry = (entry: string): void => {
  logUserAction(`Removed the custom initialization switch "${withDashes(entry)}"`)
  entries.value = entries.value.filter((current) => current !== entry)
}

const cancel = (): void => {
  logUserAction('Cancelled the advanced initialization options changes')
  entries.value = [...savedEntries.value]
  customEntry.value = ''
  internalShowDialog.value = false
}

const saveAndRestart = async (): Promise<void> => {
  const requested = entries.value.map(withDashes).join(' ') || '(none)'
  logUserAction(`Saved the advanced initialization options and restarted Cockpit: ${requested}`)
  try {
    await window.electronAPI?.setChromiumSwitches(entries.value)
  } catch (error) {
    openSnackbar({ message: `Could not save the initialization options. ${error}`, variant: 'error' })
    return
  }
  await window.electronAPI?.relaunchApp()
}
</script>
