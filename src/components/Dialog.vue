<template>
  <dialog ref="dialogRef" class="modal">
    <div ref="dialogContentRef" class="flex flex-col items-center justify-center w-full h-full">
      <slot></slot>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { toRefs } from 'vue'
import { ref, watch } from 'vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['update:show'])

const showProp = toRefs(props).show
const show = ref(showProp.value)
const dialogRef = ref()
const dialogContentRef = ref()

onMounted(() => {
  dialogRef.value.addEventListener('click', (e: MouseEvent) => {
    if (
      !e.target ||
      (e.target instanceof HTMLElement && !e.target.closest('.action-button') && e.target.nodeName !== 'DIALOG')
    )
      return
    // Close the dialog if the dialog (backdrop) or any element with the class 'action-button' was clicked
    show.value = false
  })
})

watch(showProp, () => (show.value = showProp.value))
watch(show, () => {
  if (show.value) {
    dialogRef.value.showModal()
  } else {
    dialogRef.value.setAttribute('closing', '')
    dialogRef.value.addEventListener(
      'animationend',
      () => {
        dialogRef.value.removeAttribute('closing')
        dialogRef.value.close()
      },
      { once: true }
    )
  }
  emit('update:show', show.value)
})
</script>

<style>
.modal {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-right: -50%;
  transform: translate(-50%, -50%);
  height: fit-content;
  width: 300px;
  background-color: rgba(47, 57, 66, 0.8);
  backdrop-filter: blur(1px);
  box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.1);
  border-radius: 5px;
}
.modal::backdrop {
  background-color: rgba(0, 0, 0, 0.3);
  opacity: 0;
}
.modal[open] {
  animation: slide-in 250ms forwards, fade-in 250ms forwards;
}
.modal[open]::backdrop {
  animation: fade-in 250ms forwards;
}
.modal[closing] {
  pointer-events: none;
  animation: fade-out 250ms forwards;
}
.modal[closing]::backdrop {
  animation: fade-out 250ms forwards;
}

@keyframes slide-in {
  0% {
    top: 70%;
  }
  100% {
    top: 50%;
  }
}
@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes fade-out {
  100% {
    opacity: 0;
  }
  0% {
    opacity: 1;
  }
}
</style>
