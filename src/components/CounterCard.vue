<template>
  <div>
    <v-card>
      <v-card-title>Counter card</v-card-title>
      <v-card-text>
        <p>Clicked the button {{ store.counter }} times.</p>
        <p>Double this value is {{ store.doubleCount }}.</p>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="store.increment">Click me!</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'

const store = useCounterStore()
</script>
