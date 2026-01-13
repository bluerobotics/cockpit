<template>
  <div
    class="survey-vertex-list flex flex-col h-full w-full justify-start overflow-y-auto"
    :style="interfaceStore.globalGlassMenuStyles"
  >
    <ExpansiblePanel
      mark-expanded
      compact
      elevation-effect
      no-bottom-divider
      darken-content
      invert-chevron
      :is-expanded="true"
    >
      <template #title>
        <p class="ml-10 text-center text-[13px] font-normal">Survey Polygon Vertices</p>
      </template>
      <template #content>
        <div class="flex flex-col gap-y-1 p-2 overflow-y-auto max-h-[calc(100vh-150px)]">
          <div
            v-for="(vertex, index) in vertexes"
            :key="index"
            class="flex flex-col bg-[#EEEEEE11] py-1 px-2 rounded-md mb-1"
          >
            <div class="flex justify-between items-center">
              <span class="text-[11px] font-bold opacity-80">Vertex {{ index + 1 }}</span>
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                class="!h-5 !w-5 font-[16px] -mr-1"
                @click="removeVertex(index)"
              />
            </div>
            <v-divider class="border-white opacity-10 w-full my-1" />
            <div class="flex flex-col justify-center w-full items-center text-white">
              <div class="flex w-full gap-x-4 my-[2px] justify-between text-[11px] text-center">
                <p class="w-[50px] text-start opacity-70">Latitude:</p>
                <input
                  type="number"
                  step="0.000001"
                  :value="vertex.lat"
                  class="text-right w-[130px] bg-transparent h-[15px] border-transparent focus:outline-none text-[11px]"
                  @input="updateLat(index, $event)"
                />
                <p class="w-[10px] opacity-70">°</p>
              </div>
              <div class="flex w-full gap-x-4 my-[2px] justify-between text-[11px] text-center">
                <p class="w-[50px] text-start opacity-70">Longitude:</p>
                <input
                  type="number"
                  step="0.000001"
                  :value="vertex.lng"
                  class="text-right w-[130px] bg-transparent h-[15px] border-transparent focus:outline-none text-[11px]"
                  @input="updateLng(index, $event)"
                />
                <p class="w-[10px] opacity-70">°</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
  </div>
</template>

<script setup lang="ts">
import L from 'leaflet'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * The vertices of the survey polygon
   */
  vertexes: L.LatLng[]
}>()

const emit = defineEmits<{
  (event: 'updateVertex', index: number, latlng: L.LatLng): void
  (event: 'removeVertex', index: number): void
}>()

const updateLat = (index: number, event: Event): void => {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    const newLatLng = L.latLng(val, props.vertexes[index].lng)
    emit('updateVertex', index, newLatLng)
  }
}

const updateLng = (index: number, event: Event): void => {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    const newLatLng = L.latLng(props.vertexes[index].lat, val)
    emit('updateVertex', index, newLatLng)
  }
}

const removeVertex = (index: number): void => {
  emit('removeVertex', index)
}
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
