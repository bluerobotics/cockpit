<template>
  <v-snackbar
    v-model="visibility"
    attach="#snackbar-container"
    class="stacked-snackbar"
    rounded="lg"
    :color="selectedVariantColor"
    :timeout="messageDuration"
    content-class="bg-[#4f4f4f44] backdrop-filter backdrop-blur-lg text-white"
    @pointerenter="id !== undefined && pauseSnackbar(id)"
    @pointerleave="id !== undefined && resumeSnackbar(id)"
  >
    {{ message }}
    <template v-if="closeButton || action || suppress" #actions>
      <v-btn v-if="action" color="white" variant="text" @click="triggerAction">{{ action.label }}</v-btn>
      <v-tooltip v-if="suppress" :text="suppress.tooltip" location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            color="white"
            variant="text"
            :aria-label="suppress.tooltip"
            @click="triggerSuppression"
          >
            <v-icon>mdi-eye-off</v-icon>
          </v-btn>
        </template>
      </v-tooltip>
      <v-btn v-if="closeButton" color="white" variant="text" aria-label="Dismiss" @click="closeSnackbar">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { onMounted, PropType, ref, watch } from 'vue'

import {
  closeSnackbar as removeSnackbar,
  pauseSnackbar,
  resumeSnackbar,
  SnackbarAction,
  SnackbarSuppression,
} from '@/composables/snackbar'

const props = defineProps({
  id: { type: Number, default: undefined },
  showSnackbar: { type: Boolean, default: true },
  closeButton: { type: Boolean, default: true },
  message: { type: String, default: '' },
  duration: { type: Number, default: 3000 },
  variant: { type: String, default: 'info' },
  persistent: { type: Boolean, default: false },
  action: { type: Object as PropType<SnackbarAction>, default: undefined },
  suppress: { type: Object as PropType<SnackbarSuppression>, default: undefined },
})

const emits = defineEmits(['update:showSnackbar'])

const visibility = ref(props.showSnackbar)
const messageDuration = ref(props.persistent ? -1 : props.duration || 3000)
const selectedVariantColor = ref('')

const setVariantColor = (variant: string): void => {
  switch (variant) {
    case 'success':
      selectedVariantColor.value = '#4CAF5044'
      break
    case 'error':
      selectedVariantColor.value = '#F4433644'
      break
    case 'warning':
      selectedVariantColor.value = '#FFC10744'
      break
    case 'info':
      selectedVariantColor.value = '#2196F344'
      break
    default:
      selectedVariantColor.value = '#FFFFFF33'
      break
  }
}

setVariantColor(props.variant)

watch(
  (): string => props.variant,
  (newVal: string): void => setVariantColor(newVal)
)

const closeSnackbar = (): void => {
  visibility.value = false
  emits('update:showSnackbar', false)
  if (props.id !== undefined) removeSnackbar(props.id)
}

const triggerAction = (): void => {
  logUserAction(`Took the '${props.action?.label}' action from a snackbar`)
  closeSnackbar()
  props.action?.handler()
}

const triggerSuppression = (): void => {
  logUserAction(`Chose to stop showing the snackbar '${props.message}'`)
  closeSnackbar()
  props.suppress?.handler()
}

watch(
  (): boolean => props.showSnackbar,
  (newVal: boolean): void => {
    visibility.value = newVal
  }
)

onMounted((): void => {
  switch (props.variant) {
    case 'error':
      console.error('Snackbar error message:', props.message)
      break
    case 'warning':
      console.warn('Snackbar warning message:', props.message)
      break
    case 'info':
      console.info('Snackbar info message:', props.message)
      break
    case 'success':
      console.debug('Snackbar success message:', props.message)
      break
    default:
      console.log('Snackbar message:', props.message)
  }
})
</script>

<style scoped>
.stacked-snackbar {
  position: static !important;
  margin-bottom: 10px;
  height: fit-content;
  width: 80vw;
  display: inline-block;
}

::v-deep .v-snackbar__wrapper {
  max-width: 1200px !important;
  box-shadow: 0px 5px 6px 0px rgba(0, 0, 0, 0.21), 0px 10px 16px 8px rgba(0, 0, 0, 0.105);
  pointer-events: auto;
}
</style>
