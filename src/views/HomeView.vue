<template>
  <div class="home">
    <h1>This is the home page</h1>
    <counter-card class="ma-4" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

// Components
import CounterCard from '../components/CounterCard.vue'

export default defineComponent({
  name: 'HomeView',

  components: {
    CounterCard,
  },
})
</script>

<style>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
