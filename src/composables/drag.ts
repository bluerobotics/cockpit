import { useEventListener, useMouse, useMouseInElement, useMousePressed } from '@vueuse/core'
import { type Ref, onMounted, ref, computed, watch } from 'vue'

export default function useDrag(
  targetElement: Ref<HTMLElement>,
  initialX: number,
  initialY: number
): {
  x: Ref<number>,
  y: Ref<number>,
  dragging: Ref<boolean>,
  trashed: Ref<boolean>,
} {
  const trashed = ref(false)
  const dragging = ref(false)
  const x = ref(initialX)
  const y = ref(initialY)
  const mouseOffsetX = ref(0)
  const mouseOffsetY = ref(0)

  onMounted(() => {
    if (targetElement.value === undefined) {
      return
    }
    useEventListener(targetElement, 'dragstart', (event: DragEvent) => {
      if (event.dataTransfer === null) {
        return
      }
      document.body.style.cursor = 'grabbing'
      dragging.value = true
      mouseOffsetX.value = event.x - x.value
      mouseOffsetY.value = event.y - y.value
      const img = new Image()
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D'
      event.dataTransfer.setDragImage(
        img,
        window.outerWidth,
        window.outerHeight
      )
    })
    useEventListener(targetElement, 'dragover', (event: DragEvent) => {
      if (event.dataTransfer === null) {
        return
      }
      event.dataTransfer.dropEffect = 'move'

      event.preventDefault()
    }, false)

    useEventListener(targetElement, 'dragenter', (event: DragEvent) => {
      event.preventDefault()
    }, false)

    useEventListener(targetElement, 'drop', (event: DragEvent) => {
      const trash = document.getElementById('trash')
      if (trash === null) {
        return
      }
      const trashLimits = trash.getBoundingClientRect()
      if (event.x > trashLimits.left && event.x < trashLimits.right && event.y > trashLimits.top && event.y < trashLimits.bottom) {
        trashed.value = true
      }
    })

    useEventListener(targetElement, 'drag', (event: DragEvent) => {
      x.value = event.x - mouseOffsetX.value
      y.value = event.y - mouseOffsetY.value
    })
    useEventListener(targetElement, 'dragend', (event: DragEvent) => {
      document.body.style.cursor = 'auto'
      dragging.value = false
      x.value = event.x - mouseOffsetX.value
      y.value = event.y - mouseOffsetY.value
    })
    useEventListener(targetElement, 'touchstart', (event: TouchEvent) => {
      event.preventDefault()
      dragging.value = true
      mouseOffsetX.value = Math.round(event.targetTouches[0].clientX - x.value)
      mouseOffsetY.value = Math.round(event.targetTouches[0].clientY - y.value)
    })
    useEventListener(targetElement, 'touchmove', (event: TouchEvent) => {
      x.value = Math.round(event.targetTouches[0].clientX - mouseOffsetX.value)
      y.value = Math.round(event.targetTouches[0].clientY - mouseOffsetY.value)
    }, { passive: true })
    useEventListener(targetElement, 'touchend', () => {
      dragging.value = false
    })
  })

  return { x, y, dragging, trashed }
}

export function useDragInElement(
  targetElement: Ref<HTMLElement>,
  initialX: number,
  initialY: number
): {
  elementX: Ref<number>,
  elementY: Ref<number>,
  dragging: Ref<boolean>,
  hovering: Ref<boolean>,
  trashed: Ref<boolean>,
} {
  const trashed = ref(false)
  const dragging = ref(false)
  const hovering = ref(false)
  const elementX = ref(0)
  const elementY = ref(0)
  const mouseOffsetX = ref(0)
  const mouseOffsetY = ref(0)
  // const { pressed } = useMousePressed({ target: targetElement })
  const { x: mouseX, y: mouseY } = useMouse()
  // const { isOutside } = useMouseInElement(targetElement)
  // const hovering = computed(() => !isOutside)

  // const mousePosition = computed(() => {
  //   return { x: mouseX.value, y: mouseY.value }
  // })

  // watch(mousePosition, () => {
  //   if (pressed.value) {
  //     dragging.value = true
  //   }
  //   dragging.value = false
  // })

  // watch(dragging, () => {
  //   const elementLimits = targetElement.value.getBoundingClientRect()
  //   mouseOffsetX.value = mouseX.value - elementLimits.x
  //   mouseOffsetY.value = mouseY.value - elementLimits.y
  //   elementX.value = mouseX.value - mouseOffsetX.value
  //   elementY.value = mouseY.value - mouseOffsetY.value
  // })

  return { elementX, elementY, dragging, hovering, trashed }
}
