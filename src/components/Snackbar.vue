<template>
  <v-snackbar
    v-model="visibility"
    elevation="4"
    rounded="lg"
    color="#ffffff40"
    :timeout="messageDuration"
    location="bottom left"
    content-class="bg-[#4f4f4f44] backdrop-filter backdrop-blur-lg text-white mb-[50px]"
    :style="{ marginBottom: 40 }"
  >
    {{ textMessage }}
    <template v-if="closeButton" #actions>
      <v-btn color="white" variant="text" @click="closeSnackbar"> <v-icon>mdi-close</v-icon> </v-btn></template
    >
  </v-snackbar>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  openSnackbar: Boolean,
  closeButton: Boolean,
  message: {
    type: String,
    default: '',
  },
  duration: {
    type: Number,
    default: 3000,
  },
})

const emits = defineEmits(['update:openSnackbar'])

const visibility = ref(props.openSnackbar)
const textMessage = ref(props.message)
const messageDuration = ref(props.duration || 3000)

const closeSnackbar = (): void => {
  visibility.value = false
  emits('update:openSnackbar', false)
}

watch(
  () => props.openSnackbar,
  (newVal) => {
    visibility.value = newVal
  }
)

watch(
  () => props.message,
  (newVal) => {
    textMessage.value = newVal
  }
)

watch(visibility, (newVal) => {
  if (!newVal) {
    emits('update:openSnackbar', false)
  }
})

onMounted(() => {
  console.debug('Snackbar message:', textMessage.value)
})
</script>
