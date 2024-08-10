<template>
  <v-snackbar
    v-model="visibility"
    elevation="4"
    rounded="lg"
    :color="selectedVariantColor"
    :timeout="messageDuration"
    location="bottom left"
    content-class="bg-[#4f4f4f44] backdrop-filter backdrop-blur-lg text-white mb-[50px]"
    :style="{ marginBottom: 40 }"
  >
    {{ message }}
    <template v-if="closeButton" #actions>
      <v-btn color="white" variant="text" @click="closeSnackbar"> <v-icon>mdi-close</v-icon> </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  showSnackbar: Boolean,
  closeButton: Boolean,
  message: {
    type: String,
    default: '',
  },
  duration: {
    type: Number,
    default: 3000,
  },
  variant: {
    type: String,
    default: 'info',
  },
})

const emits = defineEmits(['update:showSnackbar'])

const visibility = ref(props.showSnackbar)
const textMessage = ref(props.message)
const messageDuration = ref(props.duration || 3000)

const selectedVariantColor = ref('')

// Function to set the color based on variant
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
  }
}

// Set the initial color based on the variant prop
setVariantColor(props.variant)

// Watch for changes to the variant prop and update the color accordingly
watch(
  () => props.variant,
  (newVal) => {
    setVariantColor(newVal)
  }
)

const closeSnackbar = (): void => {
  visibility.value = false
  emits('update:showSnackbar', false)
}

watch(
  () => props.showSnackbar,
  (newVal) => {
    visibility.value = newVal
  }
)

onMounted(() => {
  console.debug('Snackbar message:', textMessage.value)
})
</script>
