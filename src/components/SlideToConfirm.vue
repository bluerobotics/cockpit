<template>
  <div v-if="showSlideToConfirm">
    <div class="mb-3 flex items-center space-x-4">
      <slide-unlock
        ref="vueslideunlock"
        :position="sliderPercentage"
        :auto-width="false"
        :circle="true"
        :disabled="cancelled || expired"
        :noanimate="false"
        :width="400"
        :height="50"
        :text="sliderText"
        :success-text="confirmationSliderText"
        name="slideunlock"
        :class="notConfirmedClasses"
        @completed="onSlideConfirmed()"
      />
      <button
        class="text-gray flex h-12 w-12 select-none items-center justify-center rounded-full bg-white"
        @click="cancelAction"
      >
        X
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlideUnlock from '@j2only/slide-unlock'
import { v4 as uuid } from 'uuid'
import { computed, ref, watch } from 'vue'

import {
  confirmationSliderText,
  deniedText,
  expiredText,
  onAction,
  showSlideToConfirm,
  sliderPercentage,
  sliderText,
} from '@/libs/slide-to-confirm'

/**
 * Timeout constant used to keep track of the slide expiration
 * @type {string}
 */
const slideExpireIntervalMs = 5000

// Unique id for each slide open to keep track of timeouts
const slideUniqueId = ref('')

// Local states for slide unlock
const cancelled = ref(false)
const expired = ref(false)

// Watch for changes in showSlideToConfirm to assign new uuid
watch(showSlideToConfirm, (value) => {
  if (value) {
    slideUniqueId.value = uuid()
    // Creates local copy within lambda
    const oldUniqueId = String(slideUniqueId.value)

    setTimeout(() => {
      if (slideUniqueId.value === oldUniqueId) {
        expiresAction()
      }
    }, slideExpireIntervalMs)
  }
})

const notConfirmedClasses = computed(() => {
  if (cancelled.value) {
    return 'slide-not-confirmed slide-unlock-denied'
  } else if (expired.value) {
    return 'slide-not-confirmed slide-unlock-expired'
  }

  return ''
})

const onSlideConfirmed = (): void => {
  // Call action with confirmed
  onAction.value?.(true)
  slideUniqueId.value = ''

  // show success message for 1.5 second
  setTimeout(() => {
    showSlideToConfirm.value = false
  }, 1500)
}

const cancelAction = (): void => {
  // Call action with confirmed
  onAction.value?.(false)
  slideUniqueId.value = ''

  // show denied message for 1.5 second
  cancelled.value = true
  sliderText.value = deniedText.value

  setTimeout(() => {
    cancelled.value = false
    showSlideToConfirm.value = false
  }, 1500)
}

const expiresAction = (): void => {
  // Call action with confirmed
  onAction.value?.(false)
  slideUniqueId.value = ''

  // show expired message for 1.5 second
  expired.value = true
  sliderText.value = expiredText.value

  setTimeout(() => {
    expired.value = false
    showSlideToConfirm.value = false
  }, 1500)
}
</script>

<style scoped>
.slide-not-confirmed {
  opacity: 1;
  --su-icon-handler: '';
  --su-color-text-normal: white;
}
.slide-unlock-denied {
  --su-color-bg: #b34a4d;
}
.slide-unlock-expired {
  --su-color-bg: #e3a008;
}
</style>
