<template>
  <div>
    <v-card>
      <v-card-title>Counter card</v-card-title>
      <v-card-text>
        <p>Clicked the button {{ store.counter }} times.</p>
        <p>Double this value is {{ store.doubleCount }}.</p>
        <p>Text in the input is: {{ text }}.</p>
        <input v-model="text" />
      </v-card-text>
      <v-card-actions>
        <v-btn @click="store.increment">Click me!</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useCounterStore } from '@/stores/counter'

const store = useCounterStore()
const text = ref('')
</script>

<style scoped>
div {
  background-color: rgb(13, 255, 0);
}
</style>
