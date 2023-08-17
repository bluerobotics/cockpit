<template>
  <div class="compass">
    <img
      :class="{ rotated: widget.options.headingStyle === HeadingStyle.HEAD_UP }"
      class="compass-ticks"
      src="@/assets/nautic-compass.svg"
      draggable="false"
    />
    <img
      :class="{ rotated: widget.options.headingStyle === HeadingStyle.NORTH_UP }"
      class="boat"
      src="@/assets/boat.svg"
      draggable="false"
    />
  </div>
  <Dialog v-model:show="showConfigurationMenu" class="w-72">
    <div class="w-full h-full">
      <div class="flex flex-col items-center justify-around">
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Heading style</span>
          <div class="w-40"><Dropdown v-model="widget.options.headingStyle" :options="headingOptions" /></div>
        </div>
      </div>
    </div>
  </Dialog>
  <span class="options-btn mdi mdi-dots-vertical" @click="showConfigurationMenu = !showConfigurationMenu" />
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, toRefs } from 'vue'

import Dialog from '@/components/Dialog.vue'
import Dropdown from '@/components/Dropdown.vue'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const store = useMainVehicleStore()

const angleStyle = computed(() => `${store.attitude.yaw ?? 0}rad`)

/**
 * Possible compass configurations.
 * North-up keeps the cardinal points fixed, while the vehicle rotates.
 * Head-up keeps the vehicle pointing up, while the cardinal points rotate.
 */
enum HeadingStyle {
  NORTH_UP = 'North Up',
  HEAD_UP = 'Head Up',
}
const headingOptions = Object.values(HeadingStyle)

const showConfigurationMenu = ref(false)
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      headingStyle: headingOptions[0],
    }
  }
})
</script>

<style scoped>
.compass {
  position: relative;
}
.compass-ticks {
  transition: -webkit-transform 0.2s;
  user-select: none;
  height: 100%;
  width: 100%;
  opacity: 0.9;
}
.boat {
  position: absolute;
  margin: auto;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  user-select: none;
  height: 55%;
}
.rotated {
  transform: rotate(v-bind('angleStyle'));
}
</style>
