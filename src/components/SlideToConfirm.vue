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
        text="slide to confirm"
        success-text="action confirmed"
        name="slideunlock"
        class="slide-unlock"
        @completed="onSlideConfirmed()"
      />
      <button class="w-12 h-12 flex items-center justify-center rounded-full bg-white text-gray" @click="cancelAction">
        X
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlideUnlock from 'vue-slide-unlock'

import { confirmed, showSlideToConfirm } from '@/libs/slide-to-confirm'

const onSlideConfirmed = (): void => {
  showSlideToConfirm.value = false
  confirmed.value = true
  console.log('Slide confirmed!')
}

const cancelAction = (): void => {
  showSlideToConfirm.value = false
  confirmed.value = false
  console.log('Slide canceled!')
}
</script>
