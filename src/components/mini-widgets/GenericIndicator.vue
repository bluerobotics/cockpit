<template>
  <div
    class="flex items-center w-[6.25rem] h-12 py-1 text-white justify-center cursor-pointer hover:bg-slate-100/20 transition-all"
    @click="showConfigurationMenu = !showConfigurationMenu"
  >
    <span class="relative w-[2rem] mdi icon-symbol" :class="[options.iconName]"></span>
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <span class="text-xl font-semibold leading-6 w-fit">{{ parsedState }} {{ options.variableUnit }}</span>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">{{ options.variableName }}</span>
    </div>
  </div>
  <Dialog v-model:show="showConfigurationMenu" class="w-72">
    <div class="w-full h-full">
      <div class="flex flex-col items-center justify-around">
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Name</span>
          <div class="w-40">
            <Dropdown v-model="options.variableName" :options="Object.keys(store.genericVariables)" />
          </div>
        </div>
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Unit</span>
          <input v-model="options.variableUnit" class="w-40 px-2 py-1 rounded-md bg-slate-200" />
        </div>
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Multiplier</span>
          <input v-model="options.variableMultiplier" class="w-40 px-2 py-1 rounded-md bg-slate-200" />
        </div>
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Icon</span>
          <div class="relative w-40">
            <input v-model="options.iconName" class="w-full py-1 pl-2 pr-8 rounded-md bg-slate-200" />
            <span
              class="absolute right-0.5 m-1 text-2xl -translate-y-1 cursor-pointer text-slate-500 mdi"
              :class="[options.iconName]"
            />
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { toReactive } from '@vueuse/core'
import { computed, onBeforeMount, ref, toRefs, watch } from 'vue'

import Dropdown from '@/components/Dropdown.vue'
import { round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Dialog from '../Dialog.vue'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  options: Record<string, unknown>
}>()
const options = toReactive(toRefs(props).options)

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(options).length === 0) {
    Object.assign(options, {
      variableName: '',
      iconName: 'mdi-help-box',
      variableUnit: '%',
      variableMultiplier: 1,
    })
  }
})

const store = useMainVehicleStore()

const currentState = ref<unknown>(0)
const parsedState = computed(() => round(Number(options.variableMultiplier) * Number(currentState.value)))

const updateVariableState = (): void => {
  currentState.value = store.genericVariables[options.variableName as string]
}
watch(store.genericVariables, updateVariableState)
watch(options, updateVariableState)


const showConfigurationMenu = ref(false)
</script>

<style>
.icon-symbol {
  font-size: 2rem;
  line-height: 2rem;
}
</style>
