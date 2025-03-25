<template>
  <v-form class="d-flex flex-column gap-2">
    <div class="d-flex align-center justify-space-between mb-2">
      <h3 class="text-subtitle-2 font-weight-bold">JavaScript Code</h3>
      <!-- eslint-disable-next-line prettier/prettier -->
      <div v-pre class="text-caption">Use {{ variable-id }} to access data lake variables</div>
    </div>
    <v-textarea
      v-model="newActionConfig.code"
      label="JavaScript Code"
      :error-messages="codeError"
      rows="10"
      variant="outlined"
      density="compact"
      @update:model-value="validateCode"
    />
    <div class="flex justify-end">
      <v-btn variant="text" @click="testAction">Test Action</v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { executeActionCode, JavascriptActionConfig } from '@/libs/actions/free-javascript'

/**
 * Props for the JavascriptActionConfig component
 */
const props = defineProps<{
  /** The configuration for the JavaScript action */
  actionConfig: JavascriptActionConfig
}>()

/**
 * Emits for the JavascriptActionConfig component
 */
const emit = defineEmits<{
  /** Emitted when the action configuration is updated */
  (e: 'update:action-config', config: JavascriptActionConfig): void
}>()

const newActionConfig = ref<JavascriptActionConfig>({
  name: '',
  code: '',
})

const codeError = ref('')

const isValid = computed(() => {
  return newActionConfig.value.code && !codeError.value
})

const validateCode = (code: string): void => {
  try {
    new Function(code)
    codeError.value = ''
  } catch (error) {
    codeError.value = `Invalid JavaScript: ${error}`
  }
  emit('update:action-config', newActionConfig.value)
}

const reset = (): void => {
  newActionConfig.value = {
    name: '',
    code: '',
  }
  codeError.value = ''
  emit('update:action-config', newActionConfig.value)
}

const testAction = (): void => {
  executeActionCode(newActionConfig.value.code)
}

// Watch for changes in the parent's actionConfig
watch(
  () => props.actionConfig,
  (newConfig) => {
    if (newConfig) {
      newActionConfig.value = { ...newConfig }
    }
  },
  { immediate: true }
)

// Watch for local changes to emit updates
watch(
  newActionConfig,
  (newValue) => {
    emit('update:action-config', newValue)
  },
  { deep: true }
)

defineExpose({
  isValid,
  reset,
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
