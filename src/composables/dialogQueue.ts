import { Component, computed, defineComponent, h, Ref, ref } from 'vue'

/**
 *  Queued component to be displayed. Usually a dialog.
 */
export interface QueuedDialog {
  /**
   * The component reference (e.g. Tutorial or VehicleDiscoveryDialog)
   */
  component: Component
  /**
   * Optional props to pass into the component
   */
  props?: Record<string, unknown>
}

/**
 * Component queue to manage the order of components to be displayed.
 */
export interface DialogQueue {
  /**
   * Enqueue a dialog to be displayed.
   */
  enqueueDialog: (item: QueuedDialog) => void
  /**
   * Clear the queue.
   */
  clear: () => void
  /**
   * The queue itself.
   */
  queue: Ref<QueuedDialog[]>
  /**
   * The current dialog to be displayed.
   */
  currentDialog: Ref<QueuedDialog | null>
  /**
   * Whether the dialog is visible or not.
   */
  isDialogVisible: Ref<boolean>
  /**
   * The wrapped dialog component.
   */
  WrappedDialog: Ref<Component | null>
}

export const useDialogQueue = (): DialogQueue => {
  const queue: Ref<QueuedDialog[]> = ref([])
  const isDialogVisible: Ref<boolean> = ref(true)

  const enqueueDialog = (item: QueuedDialog): void => {
    queue.value.push(item)
  }

  const clear = (): void => {
    queue.value = []
  }

  const currentDialog = computed(() => queue.value[0] || null)

  const closeCurrentDialog = (): void => {
    queue.value.shift()
    isDialogVisible.value = true
  }

  const WrappedDialog = computed(() => {
    if (!currentDialog.value) return null

    return defineComponent({
      name: 'WrappedDialog',
      setup() {
        const handleUpdate = (value: boolean): void => {
          if (!value) {
            closeCurrentDialog()
          }
        }

        return () =>
          h(currentDialog.value!.component, {
            ...currentDialog.value!.props,
            'modelValue': isDialogVisible.value,
            'onUpdate:modelValue': handleUpdate,
          })
      },
    })
  })

  return {
    enqueueDialog,
    clear,
    queue,
    currentDialog,
    isDialogVisible,
    WrappedDialog,
  }
}
