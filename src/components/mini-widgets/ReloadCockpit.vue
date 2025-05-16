<template>
  <div>
    <v-tooltip :text="'Reload Cockpit'" location="bottom">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps" class="relative cursor-pointer" @click="reloadCockpit">
          <FontAwesomeIcon :icon="'fa-rotate-right'" size="xl" class="text-white transform scale-x-[-1]" />
        </div>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
const reloadCockpit = (): void => {
  window.location.reload()
}
</script>
