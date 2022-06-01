<template>
  <div>
    <v-card>
      <v-card-title>Independent counter</v-card-title>
      <v-card-text>
        <p>Clicked the button {{ counter }} times.</p>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="counter += 1">Click me!</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const counter = ref(0)
</script>
