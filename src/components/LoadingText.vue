<template>
  <span class="loading-dots inline-flex items-center h-5 whitespace-nowrap opacity-80" role="status"><slot /></span>
</template>

<style scoped>
/* Sized for three dots, so the text beside it does not shift as they cycle. */
.loading-dots::after {
  content: '.';
  display: inline-block;
  width: 1.2em;
  animation: loading-dots 1.2s steps(1, end) infinite;
}

@keyframes loading-dots {
  33% {
    content: '..';
  }
  66% {
    content: '...';
  }
}
</style>
