import {
  // useEventListener,
  useMouse,
  useMouseInElement,
  useMousePressed,
} from '@vueuse/core'
import { type Ref, computed, onMounted, ref, watch } from 'vue'

import type { Point2D } from '@/types/general'

// export default function useDrag(
//   targetElement: Ref<HTMLElement>,
//   initialPosition: Point2D
// ): {
//   position: Ref<Point2D>
//   dragging: Ref<boolean>
//   hovering: Ref<boolean>
//   pressing: Ref<boolean>
//   trashed: Ref<boolean>
// } {
//   const trashed = ref(false)
//   const dragging = ref(false)
//   const position = ref(initialPosition)
//   const mouseOffset = ref({ x: 0, y: 0 })
//   const { pressed: pressing } = useMousePressed({ target: targetElement })
//   const { isOutside: notHovering } = useMouseInElement(targetElement)
//   const hovering = computed(() => !notHovering.value)

//   onMounted(() => {
//     if (targetElement.value === undefined) {
//       return
//     }
//     useEventListener(targetElement, 'dragstart', (event: DragEvent) => {
//       if (event.dataTransfer === null) {
//         return
//       }
//       document.body.style.cursor = 'grabbing'
//       dragging.value = true
//       mouseOffset.value = {
//         x: event.x - position.value.x,
//         y: event.y - position.value.y,
//       }
//       const img = new Image()
//       img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D'
//       event.dataTransfer.setDragImage(
//         img,
//         window.outerWidth,
//         window.outerHeight
//       )
//     })
//     useEventListener(
//       targetElement,
//       'dragover',
//       (event: DragEvent) => {
//         if (event.dataTransfer === null) {
//           return
//         }
//         event.dataTransfer.dropEffect = 'move'

//         event.preventDefault()
//       },
//       false
//     )

//     useEventListener(
//       targetElement,
//       'dragenter',
//       (event: DragEvent) => {
//         event.preventDefault()
//       },
//       false
//     )

//     useEventListener(targetElement, 'drop', (event: DragEvent) => {
//       const trash = document.getElementById('trash')
//       if (trash === null) {
//         return
//       }
//       const trashLimits = trash.getBoundingClientRect()
//       if (
//         event.x > trashLimits.left &&
//         event.x < trashLimits.right &&
//         event.y > trashLimits.top &&
//         event.y < trashLimits.bottom
//       ) {
//         trashed.value = true
//       }
//     })

//     useEventListener(targetElement, 'drag', (event: DragEvent) => {
//       position.value = {
//         x: event.x - mouseOffset.value.x,
//         y: event.y - mouseOffset.value.y,
//       }
//     })
//     useEventListener(targetElement, 'dragend', () => {
//       document.body.style.cursor = 'auto'
//       dragging.value = false
//     })
//     useEventListener(
//       targetElement,
//       'touchstart',
//       (event: TouchEvent) => {
//         event.preventDefault()
//         dragging.value = true
//         mouseOffset.value = {
//           x: Math.round(event.targetTouches[0].clientX - position.value.x),
//           y: Math.round(event.targetTouches[0].clientY - position.value.y),
//         }
//       },
//       { passive: true }
//     )
//     useEventListener(
//       targetElement,
//       'touchmove',
//       (event: TouchEvent) => {
//         position.value = {
//           x: Math.round(event.targetTouches[0].clientX - mouseOffset.value.x),
//           y: Math.round(event.targetTouches[0].clientY - mouseOffset.value.y),
//         }
//       },
//       { passive: true }
//     )
//     useEventListener(targetElement, 'touchend', () => {
//       dragging.value = false
//     })
//   })

//   return { position, dragging, hovering, pressing, trashed }
// }

export default function useDragInElement(
  targetElement: Ref<HTMLElement>,
  initialPosition: Point2D
): {
  position: Ref<Point2D>
  dragging: Ref<boolean>
  hovering: Ref<boolean>
  pressing: Ref<boolean>
} {
  const dragging = ref(false)
  const position = ref(initialPosition)
  const mouseOffset = ref({ x: 0, y: 0 })
  const { pressed: pressing } = useMousePressed({ target: targetElement })
  const { isOutside: notHovering } = useMouseInElement(targetElement)
  const hovering = computed(() => !notHovering.value)
  const { x: mouseX, y: mouseY } = useMouse()

  onMounted(() => {
    if (targetElement.value === undefined) {
      return
    }
  })

  watch(pressing, async (isPressing: boolean, wasPressing: boolean) => {
    if (!wasPressing && isPressing) {
      dragging.value = true
      const elementLimits = targetElement.value.getBoundingClientRect()
      mouseOffset.value = {
        x: mouseX.value - elementLimits.x,
        y: mouseY.value - elementLimits.y,
      }
    } else if (wasPressing && !isPressing) {
      dragging.value = false
    }
  })

  const mousePosition = computed(() => {
    return {
      x: mouseX.value,
      y: mouseY.value,
    }
  })

  watch(mousePosition, async () => {
    if (!dragging.value) {
      return
    }
    position.value = {
      x: mousePosition.value.x - mouseOffset.value.x,
      y: mousePosition.value.y - mouseOffset.value.y,
    }
  })

  return { position, dragging, hovering, pressing }
}
