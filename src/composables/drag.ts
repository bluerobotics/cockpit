import {
  useMouse,
  useMouseInElement,
  useMousePressed,
  useWindowSize,
} from '@vueuse/core'
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
  const { x: mousePixelsX, y: mousePixelsY } = useMouse()
  const { width: windowWidth, height: windowHeight } = useWindowSize()

  watch(pressing, async (isPressing: boolean, wasPressing: boolean) => {
    if (!wasPressing && isPressing && targetElement.value !== undefined) {
      dragging.value = true
      const elementLimPixels = targetElement.value.getBoundingClientRect()
      mouseOffset.value = {
        x: (mousePixelsX.value - elementLimPixels.x) / windowWidth.value || 1,
        y: (mousePixelsY.value - elementLimPixels.y) / windowHeight.value || 1,
      }
    } else if (wasPressing && !isPressing) {
      dragging.value = false
    }
  })

  const mousePosition = computed(() => ({
    x: mousePixelsX.value / windowWidth.value || 1,
    y: mousePixelsY.value / windowHeight.value || 1,
  }))

  watch(mousePosition, async () => {
    if (!dragging.value || !allowDragging.value) {
      return
    }
    let positionX = mousePosition.value.x - mouseOffset.value.x
    let positionY = mousePosition.value.y - mouseOffset.value.y
    if (snapToGrid.value) {
      const gridTolerance = gridInterval / 2
      const distanceFromGridX = ((100 * positionX) % (100 * gridInterval)) / 100
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
