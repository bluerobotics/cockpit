<template>
  <div
    class="flex flex-col w-full h-full min-h-[200px] bg-[#00000033] rounded-lg overflow-hidden border border-[#FFFFFF11]"
  >
    <div class="flex items-center gap-2 flex-wrap px-2 py-1 border-b border-[#FFFFFF22]">
      <v-text-field
        v-model="searchText"
        density="compact"
        variant="outlined"
        hide-details
        placeholder="Filter…"
        clearable
        class="max-w-[240px]"
      />
      <v-btn
        size="small"
        variant="text"
        icon
        :color="invertSearch ? 'white' : 'grey'"
        :title="invertSearch ? 'Excluding lines that match the filter' : 'Including lines that match the filter'"
        @click="invertSearch = !invertSearch"
      >
        <v-icon>{{ invertSearch ? 'mdi-filter-minus' : 'mdi-filter' }}</v-icon>
      </v-btn>
      <div class="flex items-center gap-1 flex-wrap">
        <v-chip
          v-for="lvl in availableLevels"
          :key="lvl"
          size="x-small"
          label
          :variant="activeLevels.includes(lvl) ? 'flat' : 'outlined'"
          :color="levelColor(lvl)"
          class="cursor-pointer uppercase"
          @click="toggleLevel(lvl)"
        >
          {{ lvl }}
        </v-chip>
      </div>
      <v-spacer />
      <span class="text-xs text-gray-400 whitespace-nowrap">{{ displayedEvents.length }} / {{ totalCount }}</span>
      <v-btn
        size="small"
        variant="text"
        icon
        :color="autoScroll ? 'white' : 'grey'"
        :title="autoScroll ? 'Auto-scroll on' : 'Auto-scroll paused'"
        @click="toggleAutoScroll"
      >
        <v-icon>{{ autoScroll ? 'mdi-arrow-down-bold-box' : 'mdi-pause-box' }}</v-icon>
      </v-btn>
      <v-btn size="small" variant="text" class="text-white" icon title="Copy visible logs" @click="copyVisible">
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>
      <v-btn size="small" variant="text" class="text-white" icon title="Clear view" @click="clearView">
        <v-icon>mdi-broom</v-icon>
      </v-btn>
    </div>

    <div class="relative flex-1 min-h-0">
      <RecycleScroller
        ref="scrollerRef"
        v-slot="{ item }"
        class="h-full w-full font-mono text-xs py-1"
        :items="displayedEvents"
        :item-size="20"
        key-field="id"
        @scroll="onScroll"
      >
        <div class="flex items-center gap-2 h-[20px] leading-[20px] px-2">
          <span class="shrink-0 text-gray-500">{{ formatTime(item.epoch) }}</span>
          <span class="shrink-0 w-[42px] font-bold uppercase" :style="{ color: levelHex(item.level) }">{{
            item.level
          }}</span>
          <span class="truncate text-gray-200" :title="item.msg">{{ item.msg }}</span>
        </div>
      </RecycleScroller>

      <div
        v-if="displayedEvents.length === 0"
        class="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-gray-500 pointer-events-none"
      >
        <span v-if="!loggingEnabled">System logging is disabled — enable it above to capture console output.</span>
        <span v-else>No log entries{{ isFiltering ? ' match the current filter' : ' captured yet' }}.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { type SystemLogViewerEvent, getRecentSystemLogEvents, subscribeToSystemLogEvents } from '@/libs/system-logging'

defineProps<{
  /**
   * Whether system logging (console capture) is currently enabled. Used only to show a helpful empty state.
   */
  loggingEnabled?: boolean
}>()

// Keep the rendered/working set bounded so filtering and memory stay cheap regardless of log volume.
const maxRows = 2000
// Coalesce incoming events into a single reactive update at this cadence, instead of one render per log.
const flushIntervalMs = 150

const availableLevels = ['error', 'warn', 'info', 'debug', 'trace', 'log']

// Master list is a plain (non-reactive) array; only the filtered result is reactive (shallow) for the scroller.
let allEvents: SystemLogViewerEvent[] = []
let pending: SystemLogViewerEvent[] = []
const displayedEvents = shallowRef<SystemLogViewerEvent[]>([])
const totalCount = ref(0)

const searchText = ref('')
const invertSearch = ref(false)
const activeLevels = ref<string[]>([...availableLevels])
const autoScroll = ref(true)
const scrollerRef = ref<{
  /** Root scroll element of the virtual scroller */
  $el?: HTMLElement
  /** Scrolls the virtual scroller to the bottom, when supported by the version in use */
  scrollToBottom?: () => void
} | null>(null)

const isFiltering = computed(() => searchText.value.trim() !== '' || activeLevels.value.length < availableLevels.length)

let unsubscribe: (() => void) | undefined
let flushTimer: ReturnType<typeof setInterval> | undefined

const matchesFilter = (event: SystemLogViewerEvent): boolean => {
  if (!activeLevels.value.includes(event.level)) return false
  const query = searchText.value.trim().toLowerCase()
  if (query) {
    const hit = event.msg.toLowerCase().includes(query)
    if (invertSearch.value ? hit : !hit) return false
  }
  return true
}

const rebuildDisplayed = (): void => {
  displayedEvents.value = allEvents.filter(matchesFilter)
}

const scrollToBottom = (): void => {
  const scroller = scrollerRef.value
  if (!scroller) return
  if (typeof scroller.scrollToBottom === 'function') {
    scroller.scrollToBottom()
  } else if (scroller.$el) {
    scroller.$el.scrollTop = scroller.$el.scrollHeight
  }
}

const flush = (): void => {
  if (pending.length === 0) return
  allEvents = allEvents.concat(pending)
  if (allEvents.length > maxRows) allEvents = allEvents.slice(allEvents.length - maxRows)
  pending = []
  totalCount.value = allEvents.length
  // While paused (scrolled up), keep the rendered list frozen so the user can read it without it shifting as
  // old events are evicted from the buffer. New events are still buffered and shown once following resumes.
  if (!autoScroll.value) return
  rebuildDisplayed()
  nextTick(scrollToBottom)
}

// Follow only while pinned to the bottom: scrolling up (off the bottom edge) stops following entirely;
// scrolling back to the bottom resumes it.
const bottomThresholdPx = 16
const onScroll = (): void => {
  const el = scrollerRef.value?.$el
  if (!el) return
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight <= bottomThresholdPx
}

const toggleLevel = (level: string): void => {
  activeLevels.value = activeLevels.value.includes(level)
    ? activeLevels.value.filter((l) => l !== level)
    : [...activeLevels.value, level]
}

const toggleAutoScroll = (): void => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) nextTick(scrollToBottom)
}

const clearView = (): void => {
  allEvents = []
  pending = []
  totalCount.value = 0
  displayedEvents.value = []
}

const copyVisible = (): void => {
  const text = displayedEvents.value.map((e) => `${formatTime(e.epoch)} [${e.level}] ${e.msg}`).join('\n')
  navigator.clipboard?.writeText(text)
}

const levelHexByLevel: Record<string, string> = {
  error: '#ff6b6b',
  warn: '#ffd166',
  info: '#4dabf7',
  debug: '#9aa0a6',
  trace: '#b197fc',
  log: '#e0e0e0',
}
const levelHex = (level: string): string => levelHexByLevel[level] ?? '#e0e0e0'

const levelColor = (level: string): string => {
  switch (level) {
    case 'error':
      return 'red'
    case 'warn':
      return 'amber'
    case 'info':
      return 'blue'
    case 'trace':
      return 'purple'
    default:
      return 'grey'
  }
}

const formatTime = (epoch: number): string => {
  const date = new Date(epoch)
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

watch([searchText, invertSearch, activeLevels], () => {
  rebuildDisplayed()
  if (autoScroll.value) nextTick(scrollToBottom)
})

// When following resumes (scrolled back to the bottom or toggled on), catch the view up to the latest events.
watch(autoScroll, (following) => {
  if (!following) return
  rebuildDisplayed()
  nextTick(scrollToBottom)
})

onMounted(() => {
  allEvents = getRecentSystemLogEvents()
  if (allEvents.length > maxRows) allEvents = allEvents.slice(allEvents.length - maxRows)
  totalCount.value = allEvents.length
  rebuildDisplayed()

  unsubscribe = subscribeToSystemLogEvents((event) => pending.push(event))
  flushTimer = setInterval(flush, flushIntervalMs)

  nextTick(scrollToBottom)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  if (flushTimer) clearInterval(flushTimer)
})
</script>
