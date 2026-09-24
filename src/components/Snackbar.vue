<template>
  <v-snackbar
    v-model="visibility"
    attach="#snackbar-container"
    class="stacked-snackbar"
    rounded="lg"
    :color="selectedVariantColor"
    :timeout="messageDuration"
    :content-class="[
      'bg-[#4f4f4f44] backdrop-filter backdrop-blur-lg text-white',
      { 'opacity-95 order-last': showBanner },
    ]"
  >
    <div class="flex items-center gap-4">
      <v-icon
        v-if="bannerSign"
        class="shrink-0"
        :class="{ blinking: bannerSign.blinks }"
        size="34"
        :color="bannerSign.color"
      >
        {{ bannerSign.icon }}
      </v-icon>
      <span>{{ message }}</span>
    </div>
    <template v-if="closeButton || action" #actions>
      <v-btn v-if="action" color="white" variant="text" @click="triggerAction">{{ action.label }}</v-btn>
      <div v-if="closeButton" class="relative flex items-center justify-center">
        <v-progress-circular
          v-if="showBanner"
          :model-value="timeLeftPercentage"
          :size="42"
          :width="2"
          color="white"
          class="pointer-events-none absolute opacity-20"
          aria-hidden="true"
        />
        <v-btn color="white" variant="text" icon aria-label="Dismiss" @click="closeSnackbar">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { onMounted, PropType, ref, watch } from 'vue'

import { closeSnackbar as removeSnackbar, SnackbarAction } from '@/composables/snackbar'

/**
 * The sign a banner shows beside its message, one per variant.
 */
interface BannerSign {
  /**
   * Material Design Icons name of the sign.
   */
  icon: string
  /**
   * Colour to draw it in, readable over that variant's own fill.
   */
  color: string
  /**
   * Whether it pulses, which only the variants asking to be acted on do.
   */
  blinks: boolean
}

const bannerSigns: Record<string, BannerSign> = {
  error: { icon: 'mdi-alert', color: '#FFC107', blinks: true },
  warning: { icon: 'mdi-alert', color: '#FFC107', blinks: true },
  info: { icon: 'mdi-information', color: '#64B5F6', blinks: false },
  success: { icon: 'mdi-check-circle', color: '#81C784', blinks: false },
}

const props = defineProps({
  id: { type: Number, default: undefined },
  showSnackbar: { type: Boolean, default: true },
  closeButton: { type: Boolean, default: true },
  message: { type: String, default: '' },
  duration: { type: Number, default: 3000 },
  variant: { type: String, default: 'info' },
  persistent: { type: Boolean, default: false },
  action: { type: Object as PropType<SnackbarAction>, default: undefined },
  banner: { type: Boolean, default: false },
})

const emits = defineEmits(['update:showSnackbar'])

const visibility = ref(props.showSnackbar)
const messageDuration = ref(props.persistent ? -1 : props.duration || 3000)
const selectedVariantColor = ref('')
const showBanner = props.banner && messageDuration.value > 0
const bannerSign = showBanner ? bannerSigns[props.variant] : undefined
const timeLeftPercentage = ref(100)

if (showBanner) {
  const openedAt = performance.now()
  // Stopped for us when the snackbar leaves the screen, as vueuse ties the interval to this scope
  useIntervalFn(() => {
    const elapsed = performance.now() - openedAt
    timeLeftPercentage.value = Math.max(0, 100 - (100 * elapsed) / messageDuration.value)
  }, 100)
}

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
/* Vuetify positions the message absolutely inside this root, so the root leaves the layout for the stack to space it. */
.stacked-snackbar {
  display: contents;
}

@keyframes blink {
  50% {
    opacity: 0.15;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .blinking {
    animation: blink 1s ease-in-out infinite;
  }
}

::v-deep .v-snackbar__wrapper {
  position: relative;
  inset: auto;
  margin: 0;
  max-width: 1200px !important;
  box-shadow: 0px 5px 6px 0px rgba(0, 0, 0, 0.21), 0px 10px 16px 8px rgba(0, 0, 0, 0.105);
  pointer-events: auto;
}
</style>
