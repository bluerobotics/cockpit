<template>
  <teleport to="body">
    <dialog ref="dialogRef" class="modal">
      <div
        ref="dialogContentRef"
        v-bind="$attrs"
        class="flex flex-col items-center justify-center w-full h-full p-5 backdrop-blur-sm"
      >
        <slot></slot>
      </div>
    </dialog>
  </teleport>
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs, watch } from 'vue'

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
  dialogRef.value.addEventListener(
    'cancel',
    (e: Event) => {
      // In case ESC is pressed, prevents default HTML dialog behavior
      show.value = false
      e.preventDefault()
      e.stopImmediatePropagation()
    },
    { passive: false }
  )
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
  background-color: rgba(71, 85, 105, 0.3);
  backdrop-filter: blur(1px);
  box-shadow: 0 0 20px 5px rgba(0, 0, 0, 0.25);
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
