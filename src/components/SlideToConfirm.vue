<template>
  <div v-if="showSlideToConfirm">
    <div class="flex items-center space-x-4 mb-3">
      <slide-unlock
        ref="vueslideunlock"
        :auto-width="false"
        :circle="true"
        :disabled="false"
        :noanimate="false"
        :width="400"
        :height="50"
        :text="sliderText"
        :success-text="confirmationSliderText"
        name="slideunlock"
        class="slide-unlock"
        @completed="onSlideConfirmed()"
      />
      <button
        class="flex items-center justify-center w-12 h-12 bg-white rounded-full select-none text-gray"
        @click="cancelAction"
      >
        X
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlideUnlock from 'vue-slide-unlock'

import { confirmationSliderText, confirmed, showSlideToConfirm, sliderText } from '@/libs/slide-to-confirm'

const onSlideConfirmed = (): void => {
  confirmed.value = true

  // show success message for 1.5 second
  setTimeout(() => {
    showSlideToConfirm.value = false
    console.log('Slide confirmed!')
  }, 1500)
}

const cancelAction = (): void => {
  showSlideToConfirm.value = false
  confirmed.value = false
  console.log('Slide canceled!')
}
</script>
