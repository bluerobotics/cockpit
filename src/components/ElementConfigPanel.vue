<template>
  <div class="flex flex-col text-center">
    <v-btn
      class="absolute top-0 left-0"
      variant="text"
      size="small"
      icon="mdi-close"
      style="z-index: 50000"
      @click="widgetStore.elementToShowOnDrawer = undefined"
    />
    <v-btn
      class="absolute bg-[#FFFFFF44] text-white bottom-2 right-2"
      variant="plain"
      size="small"
      prepend-icon="mdi-delete"
      @click="deleteElement"
    >
      Delete
    </v-btn>
    <ExpansiblePanel v-if="currentElement" mark-expanded compact darken-content invert-chevron :is-expanded="true">
      <template #title>Options</template>
      <template #content>
        <div class="flex flex-col items-center mb-4 -ml-[7px] w-[248px]">
          <div
            v-for="optionKey in sortedOptionKeys"
            :key="optionKey"
            class="flex w-full justify-between items-center border-b-[1px] border-[#FFFFFF44] h-auto"
          >
            <p class="text-start ml-1 text-[14px] w-[60%]">{{ formatLabel(optionKey) }}</p>

            <template
              v-if="
                typeof currentElement.options[optionKey] === 'string' &&
                !Array.isArray(getSelectChoices(optionKey)) &&
                !isColorPicker(optionKey) &&
                optionKey !== 'cockpitAction' &&
                optionKey !== 'cockpitActions'
              "
            >
              <div class="max-w-[120px]">
                <input v-model="currentElement.options[optionKey]" type="text" class="p-2 bg-[#FFFFFF22] w-[123px]" />
              </div>
            </template>

            <template
              v-else-if="
                Array.isArray(currentElement.options[optionKey]) &&
                currentElement.options[optionKey].every((item) => typeof item === 'string') &&
                optionKey !== 'cockpitActions'
              "
              ><div class="flex flex-col">
                <div
                  v-for="(item, index) in currentElement.options[optionKey]"
                  :key="index"
                  class="max-w-[120px] justify-start"
                >
                  <div class="flex items-center">
                    <p class="-ml-[11px] mr-1 text-xs">{{ index + 1 }}</p>
                    <input
                      v-model="currentElement.options[optionKey][index]"
                      type="text"
                      class="p-2 bg-[#FFFFFF22] w-[123px]"
                    />
                  </div>
                </div>
              </div>
            </template>

            <template v-if="optionKey === 'cockpitActions'"
              ><div class="flex flex-col">
                <div
                  v-for="(item, index) in currentElement.options[optionKey]"
                  :key="index"
                  class="max-w-[120px] justify-start"
                >
                  <div class="flex items-center">
                    <p class="-ml-[11px] mr-1 text-xs">{{ index + 1 }}</p>
                    <select v-model="currentElement.options[optionKey][index]" class="p-2 bg-[#FFFFFF22] w-[120px]">
                      <option
                        v-for="cockpitAction in availableCockpitActions"
                        :key="cockpitAction.name"
                        :value="cockpitAction.id"
                        class="bg-[#00000088]"
                      >
                        {{ cockpitAction.name }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="typeof currentElement.options[optionKey] === 'number'">
              <div class="max-w-[120px]">
                <input v-model="currentElement.options[optionKey]" type="number" class="p-2 bg-[#FFFFFF22] w-[128px]" />
              </div>
            </template>

            <template v-else-if="Array.isArray(getSelectChoices(optionKey))">
              <div class="max-w-[120px]">
                <select v-model="currentElement.options[optionKey]" class="p-2 bg-[#FFFFFF22] w-[120px]">
                  <option
                    v-for="choice in getSelectChoices(optionKey)"
                    :key="choice"
                    :value="choice"
                    class="bg-[#00000088]"
                  >
                    {{ choice }}
                  </option>
                </select>
              </div>
            </template>

            <template v-else-if="typeof currentElement.options[optionKey] === 'boolean'">
              <div class="max-w-[120px]">
                <v-checkbox
                  v-model="currentElement.options[optionKey]"
                  hide-details
                  class="p-0 h-10 mb-[12px] text-white mr-5"
                />
              </div>
            </template>

            <template v-else-if="isColorPicker(optionKey)">
              <div class="max-w-[120px]">
                <input v-model="currentElement.options[optionKey]" type="color" class="p-0 w-20 mr-4" />
              </div>
            </template>

            <template v-else-if="optionKey === 'cockpitAction'">
              <div class="max-w-[120px]">
                <select v-model="currentElement.options[optionKey]" class="p-2 bg-[#FFFFFF22] w-[120px]">
                  <option
                    v-for="cockpitAction in availableCockpitActions"
                    :key="cockpitAction.name"
                    :value="cockpitAction.id"
                    class="bg-[#00000088]"
                  >
                    {{ cockpitAction.name }}
                  </option>
                </select>
              </div>
            </template>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
    <div class="mt-10">{{ currentElement?.hash }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { useControllerStore } from '@/stores/controller'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { JoystickAction, JoystickProtocol } from '@/types/joystick'

const controllerStore = useControllerStore()
const widgetStore = useWidgetManagerStore()

const currentElement = ref(widgetStore.elementToShowOnDrawer)
const availableCockpitActions = computed(() => sortJoystickActions(JoystickProtocol.CockpitAction))

watch(
  () => widgetStore.elementToShowOnDrawer,
  (newValue) => {
    currentElement.value = newValue
  }
)

const sortedOptionKeys = computed(() => {
  if (!currentElement.value) return []
  return Object.keys(currentElement.value.options).sort((a, b) => a.localeCompare(b))
})

// Utility function to capitalize and format labels
const formatLabel = (key: string): string => {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
}

// Dynamically generate select options based on the option key
const getSelectChoices = (key: string): string[] | undefined => {
  if (key === 'align') {
    return ['start', 'center', 'end']
  }
  if (key === 'buttonSize') {
    return ['small', 'default', 'large']
  }
  if (key === 'variant') {
    return ['text', 'outlined', 'flat', 'elevated', 'tonal', 'plain']
  }
  if (key === 'size') {
    return ['small', 'medium', 'large']
  }
  if (key === 'weight') {
    return ['normal', 'bold']
  }
  if (key === 'decoration') {
    return ['none', 'underline', 'overline', 'line-through']
  }
  return undefined
}

const isColorPicker = (key: string): boolean => {
  return key.toLowerCase().includes('color')
}

const deleteElement = (): void => {
  if (currentElement.value) {
    widgetStore.removeElementFromCustomWidget(widgetStore.elementToShowOnDrawer!.hash)
    widgetStore.elementToShowOnDrawer = undefined
  }
}

const buttonActionsToShow = computed(() =>
  controllerStore.availableButtonActions.filter((a) => JSON.stringify(a) !== JSON.stringify(modifierKeyActions.regular))
)

const sortJoystickActions = (protocol: string): JoystickAction[] => {
  return buttonActionsToShow.value.filter((action: JoystickAction) => action.protocol === protocol)
}
</script>

<style scoped>
.label-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
