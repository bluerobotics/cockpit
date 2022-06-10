<template>
  <div id="trash" ref="trashRef" class="dropzone">
    <p>This is the trash can. Throw some component here and it will go away.</p>
    <br />
    <p>We can't say the same about your problems.</p>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

const trashRef = ref<HTMLElement>()

useEventListener(
  trashRef,
  'dragover',
  (event) => {
    event.preventDefault()
  },
  false
)

useEventListener(
  trashRef,
  'dragenter',
  (event) => {
    event.preventDefault()
  },
  false
)
useEventListener(
  trashRef,
  'dragleave',
  (event) => {
    event.preventDefault()
  },
  false
)
</script>

<style scoped>
.dropzone {
  width: 300px;
  height: 300px;
  margin: 10px;
  padding: 10px;
  background-color: #80b0de70;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  font-size: 1.5rem;
  color: #3b699b8c;
}
</style>
