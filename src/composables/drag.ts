import { useMouse, useMouseInElement, useMousePressed } from '@vueuse/core'
import { type Ref, computed, ref, watch } from 'vue'

import type { Point2D } from '@/types/general'

/**
 * @returns {void}
 * @param {Ref<HTMLElement | undefined>} targetElement
 * @param {Point2D} initialPosition
 * @param {Ref<boolean>} allowDragging
 * @param {Ref<boolean>} snapToGrid
 * @param {number} gridInterval
 */
export default function useDragInElement(
  targetElement: Ref<HTMLElement | undefined>,
  initialPosition: Point2D,
  allowDragging: Ref<boolean>,
  snapToGrid: Ref<boolean>,
  gridInterval: number
): {
  /**
   * Calculated position of the element
   */
  position: Ref<Point2D>
  /**
   * If the element is being dragged or not
   */
  dragging: Ref<boolean>
  /**
   * If the element is being hovered or not
   */
  hovering: Ref<boolean>
  /**
   * If the element is being pressed or not
   */
  pressing: Ref<boolean>
} {
  const dragging = ref(false)
  const position = ref(initialPosition)
  const mouseOffset = ref({ x: 0, y: 0 })
  const { pressed: pressing } = useMousePressed({ target: targetElement })
  const { isOutside: notHovering } = useMouseInElement(targetElement)
  const hovering = computed(() => !notHovering.value)
  const { x: mouseX, y: mouseY } = useMouse()

  watch(pressing, async (isPressing: boolean, wasPressing: boolean) => {
    if (!wasPressing && isPressing && targetElement.value !== undefined) {
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

  const mousePosition = computed(() => ({
    x: mouseX.value,
    y: mouseY.value,
  }))

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
