<template>
  <v-dialog v-model="show" persistent :max-width="maxWidth || 600">
    <v-card :max-width="maxWidth || 600" class="main-dialog px-2 rounded-lg">
      <v-card-title>
        <div
          class="flex justify-center test-center pt-2 text-[18px] font-bold text-nowrap text-ellipsis overflow-x-hidden"
          :class="`w-[${maxWidth}px]`"
        >
          {{ title }}
        </div>
      </v-card-title>
      <v-card-text class="pb-6">
        <slot name="content"></slot>
        <template v-if="contentComponent"> <component :is="contentComponent"></component></template>
      </v-card-text>
      <div class="flex justify-center w-full px-10">
        <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
      </div>
      <v-card-actions v-if="actions!.length > 0">
        <div class="flex w-full px-1 py-2" :class="actions!.length === 1 ? 'justify-end' : 'justify-between'">
          <v-btn
            v-for="(button, index) in actions"
            :key="index"
            :size="button.size || 'default'"
            :color="button.color || undefined"
            :class="button.class || undefined"
            :disabled="button.disabled || false"
            @click="button.action"
          >
            {{ button.text }}
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'

/* eslint-disable vue/require-default-prop */
const props = defineProps({
  showDialog: Boolean,
  title: String,
  contentComponent: String,
  maxWidth: Number,
  actions: Object,
})

const show = ref(props.showDialog)
const title = ref(props.title)
const contentComponent = ref(props.contentComponent)
const maxWidth = ref(props.maxWidth)
const actions = ref(props.actions)

watchEffect(() => {
  show.value = props.showDialog
  title.value = props.title
  actions.value = props.actions
})
</script>
<style scoped>
.main-dialog {
  color: white;
  border: 1px solid #fafafa44;
  background-color: #aaaaaa99;
  backdrop-filter: blur(30px);
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
}
</style>
