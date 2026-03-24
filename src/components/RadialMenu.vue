<template>
  <div
    v-if="visible"
    ref="menuEl"
    class="radial-menu"
    :class="{ open: isOpen }"
    :style="{ position: 'absolute', left: `${x}px`, top: `${y}px`, zIndex: zIndex, pointerEvents: 'auto' }"
  >
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="radial-btn"
      :style="itemTransformStyle(idx)"
      :title="item.tooltip"
      @click.stop="emit('select', idx)"
    >
      <div class="radial-btn-inner">
        <span class="mdi" :class="item.icon" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Describes a single item rendered in the radial menu.
 */
export interface RadialMenuItem {
  /** MDI icon class, e.g. 'mdi-pencil' */
  icon: string
  /** Tooltip text shown on hover */
  tooltip: string
}

/* eslint-disable jsdoc/require-jsdoc */
const props = withDefaults(
  defineProps<{
    visible: boolean
    x: number
    y: number
    items: RadialMenuItem[]
    radius?: number
    spreadDeg?: number
    startDeg?: number
    zIndex?: number
  }>(),
  {
    radius: 44,
    spreadDeg: 50,
    startDeg: -90,
    zIndex: 670,
  }
)
/* eslint-enable jsdoc/require-jsdoc */

const emit = defineEmits<{
  (event: 'select', index: number): void
  (event: 'dismiss'): void
}>()

const menuEl = ref<HTMLDivElement | null>(null)
const isOpen = ref(false)
let pendingDismissListener: ((e: MouseEvent) => void) | null = null

const cleanupListener = (): void => {
  if (pendingDismissListener) {
    window.removeEventListener('click', pendingDismissListener)
    pendingDismissListener = null
  }
}

const itemAngles = computed(() => {
  const count = props.items.length
  if (count <= 1) return [props.startDeg]
  return props.items.map((_, i) => props.startDeg + (i - (count - 1) / 2) * props.spreadDeg)
})

const itemTransformStyle = (idx: number): Record<string, string> => {
  if (!isOpen.value) return {}
  const angleDeg = itemAngles.value[idx]
  const rad = (angleDeg * Math.PI) / 180
  const tx = Math.cos(rad) * props.radius
  const ty = Math.sin(rad) * props.radius
  return {
    opacity: '1',
    transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1)`,
    transitionDelay: `${idx * 30}ms`,
  }
}

watch(
  () => menuEl.value,
  async (el) => {
    cleanupListener()
    if (!el) {
      isOpen.value = false
      return
    }
    await nextTick()
    requestAnimationFrame(() => {
      isOpen.value = true
    })

    const handler = (e: MouseEvent): void => {
      if (el.contains(e.target as Node)) return
      pendingDismissListener = null
      emit('dismiss')
    }
    pendingDismissListener = handler
    setTimeout(() => window.addEventListener('click', handler, { once: true }), 0)
  }
)

onBeforeUnmount(cleanupListener)
</script>

<style scoped>
.radial-menu {
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.radial-btn {
  position: absolute;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
  transition: opacity 150ms ease, transform 150ms ease;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}

.radial-btn:hover {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
}

.radial-btn-inner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #333333ee;
  border: 1px solid #ffffff44;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  transition: transform 150ms ease;
}

.radial-btn:hover .radial-btn-inner {
  transform: scale(1.18);
}

.radial-btn-inner span {
  color: white;
  font-size: 16px;
}
</style>
