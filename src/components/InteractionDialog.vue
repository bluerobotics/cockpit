<template>
  <v-dialog v-model="internalShowDialog" persistent :max-width="maxWidth || 600">
    <v-card :max-width="maxWidth || 600" class="main-dialog px-2 rounded-lg">
      <v-card-title>
        <div
          class="flex justify-center test-center pt-2 mb-1 text-[20px] font-bold text-nowrap text-ellipsis overflow-x-hidden"
          :class="`w-[${maxWidth}px]`"
        >
          {{ title }}
        </div>
      </v-card-title>
      <v-card-text class="pb-5">
        <div class="flex justify-center align-center w-full mb-3">
          <v-icon v-if="variant" size="46" :color="variant === 'success' ? 'green' : 'yellow'" class="mr-8 ml-2">{{
            variant === 'info'
              ? 'mdi-information'
              : variant === 'warning'
              ? 'mdi-alert-rhombus'
              : variant === 'error'
              ? 'mdi-alert-circle'
              : 'mdi-check-circle'
          }}</v-icon>
          <div class="text-lg">{{ message }}</div>
        </div>
        <slot name="content"></slot>
        <template v-if="contentComponent">
          <component :is="contentComponent"></component>
        </template>
      </v-card-text>
      <div class="flex justify-center w-full px-10">
        <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
      </div>
      <v-card-actions>
        <div
          v-if="actions && actions.length > 0"
          class="flex w-full px-1 py-2"
          :class="actions.length === 1 ? 'justify-end' : 'justify-between'"
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
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'

const { closeDialog } = useInteractionDialog()

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
  maxWidth?: number
  /**
   * The actions to be displayed in the dialog's footer.
   */
  actions?: Action[]
  /**
   * The variant of the dialog, determining the icon and color.
   */
  variant?: string
  /**
   * The text message to be displayed in the dialog if there is no content on the slot.
   */
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  showDialog: false,
  title: '',
  contentComponent: '',
  maxWidth: 600,
  actions: () => [],
  variant: '',
  message: '',
})

const emit = defineEmits(['update:showDialog', 'confirmed', 'dismissed'])

const internalShowDialog = ref(props.showDialog)

watch(
  () => props.showDialog,
  (newVal) => {
    internalShowDialog.value = newVal
  }
)

watch(internalShowDialog, (newVal) => {
  if (!newVal) {
    closeDialog()
    emit('update:showDialog', newVal)
    emit('dismissed')
  }
})

const handleAction = (action: () => void): void => {
  action()
  emit('confirmed')
}
</script>

<style scoped>
.main-dialog {
  color: white;
  border: 1px solid #fafafa33;
  background-color: #aaaaaa44;
  backdrop-filter: blur(30px);
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
}
</style>
