import type { InjectionKey, Ref } from 'vue'
import { provide, watch } from 'vue'

import type { Point2D, SizeRect2D } from '@/types/general'
import type { Widget } from '@/types/widgets'

export const widgetLivePositionKey: InjectionKey<Ref<Point2D>> = Symbol('widgetLivePosition')
export const widgetLiveSizeKey: InjectionKey<Ref<SizeRect2D>> = Symbol('widgetLiveSize')
export const widgetDraggingKey: InjectionKey<Ref<boolean>> = Symbol('widgetDragging')

/**
 * Manages a widget's geometry: keeps live position/size refs decoupled from the persisted widget while dragging or
 * resizing, and exposes the live values to descendants (e.g. teleported iframes) that cannot rely on stale
 * widget.position during a gesture.
 * @param {Ref<Widget>} widget - Persisted widget reference
 * @param {Ref<Point2D>} position - Live position updated during drag
 * @param {Ref<SizeRect2D>} size - Live size updated during resize
 * @param {Ref<boolean>} draggingWidget - Whether the widget is being dragged
 * @param {Ref<boolean>} isResizing - Whether the widget is being resized
 * @returns {{ syncPositionToWidget: () => void, syncSizeToWidget: () => void }} Flush helpers for drag/resize end
 */
export function useWidgetGeometry(
  widget: Ref<Widget>,
  position: Ref<Point2D>,
  size: Ref<SizeRect2D>,
  draggingWidget: Ref<boolean>,
  isResizing: Ref<boolean>
): {
  /**
   * Persists the current local position to the widget model
   */
  syncPositionToWidget: () => void
  /**
   * Persists the current local size to the widget model
   */
  syncSizeToWidget: () => void
} {
  const syncPositionToWidget = (): void => {
    widget.value.position = { ...position.value }
  }

  const syncSizeToWidget = (): void => {
    widget.value.size = { ...size.value }
  }

  watch(position, (newPosition) => {
    if (draggingWidget.value || isResizing.value) return
    widget.value.position = newPosition
  })
  watch(size, (newSize) => {
    if (draggingWidget.value || isResizing.value) return
    widget.value.size = newSize
  })

  provide(widgetLivePositionKey, position)
  provide(widgetLiveSizeKey, size)
  provide(widgetDraggingKey, draggingWidget)

  return { syncPositionToWidget, syncSizeToWidget }
}
