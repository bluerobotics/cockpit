<template>
  <div>
    <img :src="src" />
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
    <v-dialog v-model="showOptionsDialog" min-width="400" max-width="35%">
      <v-card class="pa-2">
        <v-card-title>Image URL</v-card-title>
        <v-card-text>
          <v-text-field v-model="src" label="Image URL" outlined></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" text @click="showOptionsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const src = ref<string | undefined>()
const showOptionsDialog = ref(false)
</script>

<style scoped>
img {
  object-fit: cover;
  width: 100%;
}
div {
  width: 100%;
  height: 100%;
}
</style>
