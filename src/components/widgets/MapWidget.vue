<template>
  <div class="root">
    <l-map
      v-model="zoom"
      v-model:zoom="zoom"
      :center="[-27.5935, -48.55854]"
      @move="console.log('move')"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      ></l-tile-layer>
    </l-map>
  </div>
</template>

<script>
import 'leaflet/dist/leaflet.css'

import { LMap, LTileLayer } from '@vue-leaflet/vue-leaflet'

export default {
  name: 'MyAwesomeMap',
  components: {
    LMap,
    LTileLayer,
  },
  data() {
    return {
      zoom: 10,
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.$refs.myMap.leafletObject.ANY_LEAFLET_MAP_METHOD()
    })
  },
}
</script>

<style scoped>
.root {
  width: 100%;
  height: 88%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
