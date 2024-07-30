<template>
  <v-dialog v-model="internalShowDialog" :persistent="persistent" :width="maxWidth || 'auto'">
    <v-card
      :width="maxWidth || 'auto'"
      class="main-dialog px-2 rounded-lg"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <v-card-title>
        <div
          v-if="title"
          class="flex justify-center align-center text-center pt-2 mb-1 font-bold text-nowrap text-ellipsis overflow-x-hidden"
          :class="interfaceStore.isOnPhoneScreen ? 'text-[18px]' : 'text-[20px]'"
        >
          {{ title }}
        </div>
        <slot name="title"></slot>
      </v-card-title>
      <v-card-text class="pb-2">
        <div class="flex justify-center align-center w-full mb-3">
          <v-icon v-if="variant !== 'text-only'" size="46" :color="iconColor" class="mr-8 ml-2">{{ iconType }}</v-icon>
          <div
            v-if="isArrayMessage"
            class="flex flex-col mb-3 gap-y-2 w-[90%] text-start"
            :class="interfaceStore.isOnPhoneScreen ? 'text-[13px] px-2' : 'text-lg px-5'"
          >
            <li v-for="messageUnit in message" :key="messageUnit">
              {{ messageUnit }}
            </li>
          </div>
          <div v-else class="text-center" :class="interfaceStore.isOnPhoneScreen ? 'text-xs' : 'text-lg'">
            {{ message }}
          </div>
        </div>
        <slot name="content"></slot>
        <template v-if="contentComponent">
          <component :is="contentComponent"></component>
        </template>
      </v-card-text>
      <v-progress-linear
        v-if="props.timer"
        :color="props.variant === 'error' ? 'red' : 'green'"
        striped
        :model-value="timerCounter"
        height="5"
        class="w-full"
      />
      <div class="flex justify-center w-full px-10">
        <v-divider v-if="!props.timer" class="opacity-10 border-[#fafafa]"></v-divider>
      </div>
      <v-card-actions>
        <slot v-if="hasActionsSlot" name="actions"></slot>
        <template v-else>
          <div
            v-if="actions && actions.length > 0"
            class="flex w-full"
            :class="[
              actions.length === 1 ? 'justify-end' : 'justify-between',
              interfaceStore.isOnPhoneScreen ? 'px-0 py-1' : 'px-1 py-2',
            ]"
          >
            <v-btn
              v-for="(button, index) in actions"
              :key="index"
              :size="button.size || 'default'"
              :color="button.color || undefined"
              :class="button.class || undefined"
              :disabled="button.disabled || false"
              @click="handleAction(button.action)"
            >
              {{ button.text }}
            </v-btn>
          </div>
          <div v-else class="flex w-full px-1 py-2 justify-end">
            <v-btn size="small" variant="text" @click="handleAction(() => (internalShowDialog = false))">Close</v-btn>
          </div>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'

const { closeDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()

const slots = useSlots()

/**
 * Interface to an array of buttons for the Interaction Dialog's footer
 */
interface Action {
  /**
   * Button Text
   */
  text: string
  /**
   * Button size
   */
  size?: string
  /**
   * Button color
   */
  color?: string
  /**
   * Tailwind class for the button element
   */
  class?: string
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
  /**
   * Callback to button action
   */
  action: () => void
}

/**
 * Interface representing the properties for the dialog component.
 */
interface Props {
  /**
   * Whether the dialog should be shown.
   */
  showDialog?: boolean
  /**
   * The title of the dialog.
   */
  title?: string
  /**
   * The component to be rendered in the content slot of the dialog.
   */
  contentComponent?: string
  /**
   * The maximum width of the dialog.
   */
  maxWidth?: string | number
  /**
   * The actions to be displayed in the dialog's footer.
   */
  actions?: Action[]
  /**
   * The variant of the dialog, determining the icon and color.
   */
  variant?: 'info' | 'success' | 'error' | 'warning' | 'text-only'
  /**
   * Message to display in the dialog. If an array, elements will be displayed as an item list.
   */
  message?: string | string[]
  /**
   * Persistent dialogs can't be closed with 'esc' or a backdrop click.
   */
  persistent?: boolean
  /**
   *
   */
  timer?: number
}

const props = withDefaults(defineProps<Props>(), {
  showDialog: false,
  title: '',
  contentComponent: '',
  maxWidth: 'auto',
  actions: () => [],
  variant: 'info',
  message: '',
  persistent: false,
  timer: 0,
})

const emit = defineEmits(['update:showDialog', 'confirmed', 'dismissed'])

const internalShowDialog = ref(props.showDialog)
const isArrayMessage = computed(() => Array.isArray(props.message))
const timerCounter = ref(100)
const timerId = ref<number | null>(null)

const iconType = computed(() => {
  switch (props.variant) {
    case 'info':
      return 'mdi-information'
    case 'warning':
      return 'mdi-alert-rhombus'
    case 'error':
      return 'mdi-alert-circle'
    default:
      return 'mdi-check-circle'
  }
})

const iconColor = computed(() => {
  return props.variant === 'success' ? 'green' : 'yellow'
})

const hasActionsSlot = computed(() => !!slots.actions)

watch(
  () => props.showDialog,
  (newVal) => {
    internalShowDialog.value = newVal
  }
)

onMounted(() => {
  if (props.timer) {
    startTimer()
  }
})

const startTimer = (): void => {
  timerCounter.value = 100
  const interval = 100
  const step = (interval / props.timer) * 100

  timerId.value = setInterval(() => {
    timerCounter.value -= step
    if (timerCounter.value <= 0) {
      stopTimer()
      handleAction(() => (internalShowDialog.value = false))
      emit('dismissed')
    }
  }, interval) as unknown as number
}

const stopTimer = (): void => {
  console.log('🚀 ~ stopTimer:')
  if (timerId.value !== null) {
    clearInterval(timerId.value)
    timerId.value = null
  }
}

onUnmounted(() => {
  stopTimer()
})

watch(internalShowDialog, (newVal) => {
  if (!newVal) {
    stopTimer()
    emit('update:showDialog', newVal)
    emit('dismissed')
    closeDialog()
  }
})

const handleAction = (action: () => void): void => {
  action()
  emit('confirmed')
}
</script>

<style scoped>
.main-dialog {
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
}
</style>
