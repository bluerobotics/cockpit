import { useMouse, useMouseInElement, useMousePressed } from '@vueuse/core'
import { type Ref, computed, onMounted, ref, watch } from 'vue'

import type { Point2D } from '@/types/general'

export default function useDragInElement(
  targetElement: Ref<HTMLElement | undefined | null>,
  initialPosition: Point2D,
  allowDragging: Ref<boolean>,
  snapToGrid: Ref<boolean>,
  gridInterval: number
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
    if (targetElement.value === undefined || targetElement.value === null) {
      return
    }
  })

  watch(pressing, async (isPressing: boolean, wasPressing: boolean) => {
    if (
      !wasPressing &&
      isPressing &&
      targetElement.value !== undefined &&
      targetElement.value !== null
    ) {
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
    if (!dragging.value || !allowDragging.value) {
      return
    }
    let positionX = mousePosition.value.x - mouseOffset.value.x
    let positionY = mousePosition.value.y - mouseOffset.value.y
    if (snapToGrid.value) {
      const gridTolerance = gridInterval / 2
      const distanceFromGridX = positionX % gridInterval
      if (distanceFromGridX < gridTolerance) {
        positionX = positionX - distanceFromGridX
      } else if (distanceFromGridX > gridInterval - gridTolerance) {
        positionX = positionX + (gridInterval - distanceFromGridX)
      }
      const distanceFromGridY = positionY % gridInterval
      if (distanceFromGridY < gridTolerance) {
        positionY = positionY - distanceFromGridY
      } else if (distanceFromGridY > gridInterval - gridTolerance) {
        positionY = positionY + (gridInterval - distanceFromGridY)
      }
    }
    position.value = {
      x: positionX,
      y: positionY,
    }
  })

  return { position, dragging, hovering, pressing }
}
