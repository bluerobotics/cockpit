<template>
  <div id="snackbar-container" class="snackbar-container">
    <Snackbar v-for="snack in snackbars" :key="snack.id" v-bind="snack" />
  </div>
</template>

<script setup lang="ts">
import Snackbar from '@/components/Snackbar.vue'
import { useSnackbar } from '@/composables/snackbar'

const { snackbars } = useSnackbar()
</script>

<style scoped>
.snackbar-container {
  position: fixed;
  bottom: 97px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 35px;
  z-index: 800;
}
</style>
