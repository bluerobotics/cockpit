<template>
  <v-snackbar
    v-model="visibility"
    attach="#snackbar-container"
    class="stacked-snackbar"
    elevation="4"
    rounded="lg"
    :color="selectedVariantColor"
    :timeout="messageDuration"
    content-class="bg-[#4f4f4f44] backdrop-filter backdrop-blur-lg text-white"
  >
    {{ message }}
    <template v-if="closeButton" #actions>
      <v-btn color="white" variant="text" @click="closeSnackbar">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  showSnackbar: { type: Boolean, default: true },
  closeButton: { type: Boolean, default: true },
  message: { type: String, default: '' },
  duration: { type: Number, default: 3000 },
  variant: { type: String, default: 'info' },
})

const emits = defineEmits(['update:showSnackbar'])

const visibility = ref(props.showSnackbar)
const messageDuration = ref(props.duration || 3000)
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
}
</style>
