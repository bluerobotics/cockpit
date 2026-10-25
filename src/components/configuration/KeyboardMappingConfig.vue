<template>
  <ExpansiblePanel no-top-divider no-bottom-divider is-expanded compact follow-window-width>
    <template #title>Key mappings</template>
    <template #info>
      <div class="flex flex-col items-start px-5 font-medium">
        <li>Keys work alongside the joystick, running Cockpit actions or setting data-lake variables.</li>
        <li>
          A variable mapped to a key is 1 while the key is held and 0 once it is released. To move the vehicle, create a
          variable for the key and add it to an axis output's transforming function, like
          <code>{{ axisOutputExample }}</code> for a variable named "forward-key". Mapping a key to the joystick's own
          axis input instead makes the key and the stick overwrite each other.
        </li>
        <li>Axis outputs only reach the vehicle while a joystick is connected. Cockpit actions work without one.</li>
        <li>
          Keys do nothing while you type in a field, while Ctrl, Alt or Cmd is held, or while this page is open. Space
          and Enter are left to a focused button, slider or list, and the arrow keys to a focused slider or list.
        </li>
      </div>
    </template>
    <template #content>
      <div class="flex flex-col w-full px-5 pb-4 gap-y-2">
        <p v-if="mappedKeys.length === 0" class="text-sm text-center opacity-70 py-2">No keys mapped yet.</p>
        <div v-for="code in mappedKeys" :key="code" class="flex items-center gap-x-4">
          <div
            class="min-w-[90px] px-2 py-1 text-center text-sm font-semibold rounded-md border border-[#FFFFFF33]"
            :class="{ 'bg-[#FFFFFF33]': heldKeys.has(code) }"
          >
            {{ keyLabel(code) }}
          </div>
          <v-autocomplete
            :model-value="mapping[code].id"
            :items="assignableActions"
            item-title="name"
            item-value="id"
            variant="filled"
            density="compact"
            hide-details
            theme="dark"
            class="flex-1"
            @update:model-value="(id: string) => setKeyAction(code, id)"
          />
          <v-tooltip location="top" text="Remove key">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete" variant="text" size="small" @click="removeKey(code)" />
            </template>
          </v-tooltip>
        </div>
        <div class="flex justify-center mt-2">
          <v-btn variant="flat" class="bg-[#FFFFFF22]" @click="startKeyCapture">
            {{ capturingKey ? 'Press a key (Esc to cancel)' : 'Add key' }}
          </v-btn>
        </div>
      </div>
    </template>
  </ExpansiblePanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { isAssignableToButton } from '@/libs/joystick/protocols'
import { otherAvailableActions } from '@/libs/joystick/protocols/other'
import { type KeyboardMapping, initializeKeyVariable, keyboardMappingKey, keyLabel } from '@/libs/keyboard'
import { useControllerStore } from '@/stores/controller'
import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

// Written right away, as the keyboard listener reads the stored mapping on every key press
const mapping = useBlueOsStorage<KeyboardMapping>(keyboardMappingKey, {}, { debounceMs: 0 })
const controllerStore = useControllerStore()
const { openSnackbar } = useSnackbar()

const mappedKeys = computed(() => Object.keys(mapping.value))

const axisOutputExample = '{{inputs/mavlink/axis-x}} + {{user/custom/forward-key}} * 500'

// MAVLink manual control button functions are left out, as they are tied to the joystick's buttons on the vehicle
const assignableActions = computed((): ProtocolAction[] => [
  otherAvailableActions.no_function,
  ...controllerStore.availableButtonActions
    .filter((a) => [JoystickProtocol.CockpitAction, JoystickProtocol.DataLakeVariable].includes(a.protocol))
    .filter((a) => isAssignableToButton(a.id))
    .sort((a, b) => a.name.localeCompare(b.name)),
])

const setKeyAction = (code: string, actionId: string): void => {
  const action = assignableActions.value.find((a) => a.id === actionId)
  if (!action) return
  initializeKeyVariable(action)
  mapping.value = { ...mapping.value, [code]: action }
  logUserAction(`Mapped the "${keyLabel(code)}" key to "${action.name}"`)
}

const removeKey = (code: string): void => {
  const newMapping = { ...mapping.value }
  delete newMapping[code]
  mapping.value = newMapping
  logUserAction(`Removed the "${keyLabel(code)}" key from the keyboard mapping`)
}

// Shown on this page only, where mapped keys are paused, so the user can see which key is which
const heldKeys = ref(new Set<string>())
const holdKey = (event: KeyboardEvent): void => {
  heldKeys.value.add(event.code)
}
const releaseKey = (event: KeyboardEvent): void => {
  heldKeys.value.delete(event.code)
}
const releaseAllKeys = (): void => heldKeys.value.clear()

onMounted(() => {
  window.addEventListener('keydown', holdKey)
  window.addEventListener('keyup', releaseKey)
  window.addEventListener('blur', releaseAllKeys)
})

const capturingKey = ref(false)

const stopKeyCapture = (): void => {
  capturingKey.value = false
  window.removeEventListener('keydown', captureKey, true)
}

// Listens on the capture phase, so the key does not reach the keyboard controller or Cockpit's own shortcuts
const captureKey = (event: KeyboardEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  stopKeyCapture()
  if (event.code === 'Escape') {
    logUserAction('Cancelled capturing a key for the keyboard mapping')
    return
  }
  if (event.code === 'Tab') {
    openSnackbar({ message: 'Tab is kept for moving between controls, so it cannot be mapped.', variant: 'warning' })
    logUserAction('Refused the "Tab" key for the keyboard mapping, as it moves between controls')
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    openSnackbar({ message: 'Keys combined with Ctrl, Alt or Cmd cannot be mapped.', variant: 'warning' })
    logUserAction('Refused a key combined with Ctrl, Alt or Cmd for the keyboard mapping')
    return
  }
  if (mapping.value[event.code]) {
    openSnackbar({ message: `The "${keyLabel(event.code)}" key is already mapped.`, variant: 'info' })
    logUserAction(`Refused the "${keyLabel(event.code)}" key for the keyboard mapping, as it is already mapped`)
    return
  }
  mapping.value = { ...mapping.value, [event.code]: otherAvailableActions.no_function }
  logUserAction(`Added the "${keyLabel(event.code)}" key to the keyboard mapping`)
}

const startKeyCapture = (): void => {
  if (capturingKey.value) return
  capturingKey.value = true
  window.addEventListener('keydown', captureKey, true)
  logUserAction('Started capturing a key for the keyboard mapping')
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', holdKey)
  window.removeEventListener('keyup', releaseKey)
  window.removeEventListener('blur', releaseAllKeys)
  stopKeyCapture()
})
</script>
