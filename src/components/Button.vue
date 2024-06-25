<template>
  <button
    class="px-4 py-1 text-lg font-medium text-white uppercase transition-all rounded-md shadow-md action-button bg-[#00000055] hover:bg-[#00000033]"
    v-bind="$attrs"
  >
    <slot></slot>
  </button>
</template>
