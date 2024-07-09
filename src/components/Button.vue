<template>
  <button
    class="action-button rounded-md bg-[#00000055] px-4 py-1 text-lg font-medium uppercase text-white shadow-md transition-all hover:bg-[#00000033]"
    v-bind="$attrs"
  >
    <slot></slot>
  </button>
</template>
