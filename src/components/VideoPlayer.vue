<template>
  <div v-if="openDialog" class="modal">
    <div class="overlay" @click="closeDialog">
      <span class="close-icon mdi mdi-close" @click.stop="closeDialog"></span>
    </div>
    <div class="modal-content">
      <video id="video-player" class="w-[100%]" controls autoplay preload="auto">
        <source :src="videoFileUrl" />
      </video>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watchEffect } from 'vue'

const props = defineProps({
  videoUrl: {
    type: String,
    default: '',
  },
  openVideoPlayerDialog: Boolean,
})

const emit = defineEmits(['update:openVideoPlayerDialog'])

const videoFileUrl = ref(props.videoUrl)
const openDialog = ref(props.openVideoPlayerDialog)

const closeDialog = (): void => {
  openDialog.value = false
  emit('update:openVideoPlayerDialog', false)
}

watchEffect(() => {
  videoFileUrl.value = props.videoUrl
  openDialog.value = props.openVideoPlayerDialog
})
</script>

<style scoped>
.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  background-color: rgba(255, 255, 255, 0.2);
  z-index: 990;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.close-icon {
  position: absolute;
  top: 0px;
  right: 5px;
  cursor: pointer;
  color: white;
  font-size: 24px;
  border-radius: 8px;
}

.modal-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  padding: 5px;
  width: 1000px;
  height: 565px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1200;
}

video {
  height: 580px;
}
</style>
