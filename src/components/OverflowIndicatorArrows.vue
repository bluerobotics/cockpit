<template>
  <div class="relative flex flex-col min-h-0">
    <div ref="viewport" class="min-h-0 overflow-y-auto scrollbar-hide" @scroll.passive="updateArrows">
      <div ref="content" :class="contentClass">
        <slot />
      </div>
    </div>
    <v-icon
      size="18"
      class="absolute pointer-events-none text-white drop-shadow-[0_0_3px_#000] transition-opacity duration-150"
      :class="[arrowPositions.up, canScrollUp ? 'opacity-90' : 'opacity-0']"
    >
      mdi-arrow-up-bold
    </v-icon>
    <v-icon
      size="18"
      class="absolute pointer-events-none text-white drop-shadow-[0_0_3px_#000] transition-opacity duration-150"
      :class="[arrowPositions.down, canScrollDown ? 'opacity-90' : 'opacity-0']"
    >
      mdi-arrow-down-bold
    </v-icon>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = withDefaults(
  defineProps<{
    /**
     * Classes applied to the element wrapping the scrolled content, e.g. its padding and layout.
     */
    contentClass?: string
    /**
     * Horizontal side of the container the arrows sit on.
     */
    align?: 'left' | 'center' | 'right'
    /**
     * Whether the arrows overlay the container or float just beyond its edges.
     */
    placement?: 'inside' | 'outside'
  }>(),
  {
    contentClass: undefined,
    align: 'center',
    placement: 'inside',
  }
)

const viewport = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const canScrollUp = ref(false)
const canScrollDown = ref(false)

const arrowPositions = computed(() => {
  const outside = props.placement === 'outside'
  const horizontal = {
    left: outside ? 'right-full' : 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: outside ? 'left-full' : 'right-0',
  }[props.align]
  // Centered outside arrows go above and below the container, since beside it they would not be centered.
  const aboveAndBelow = outside && props.align === 'center'
  return {
    up: `${horizontal} ${aboveAndBelow ? 'bottom-full' : 'top-0'}`,
    down: `${horizontal} ${aboveAndBelow ? 'top-full' : 'bottom-0'}`,
  }
})

const updateArrows = (): void => {
  const el = viewport.value
  if (!el) return
  // One pixel of slack, since scroll offsets are fractional on scaled displays.
  canScrollUp.value = el.scrollTop > 1
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
}

// The viewport covers the panel resizing, the content covers entries being added, removed or expanded.
useResizeObserver(viewport, updateArrows)
useResizeObserver(content, updateArrows)
</script>
