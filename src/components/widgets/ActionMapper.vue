<template>
  <div id="action-mapper" class="main-style">
    <h3 class="center">Action Mapper</h3>

    <v-col align="center">
      <v-row>
        <v-btn
          id="hotkeyButton"
          class="ma-2"
          :loading="waitingShortcut"
          :disabled="waitingShortcut"
          color="success"
          @click="startShortcutCapture()"
        >
          Set shortcut
          <template #loader>
            <span>Waiting...</span>
          </template>
        </v-btn>

        <v-chip
          v-for="(button, index) in userShortcut"
          :key="index"
          class="ma-2"
        >
          {{ button === ' ' ? 'space' : button }}
        </v-chip>

        Action:
        <v-autocomplete :items="actions" clearable></v-autocomplete>

        <v-btn class="ml-2" icon="mdi-plus" size="small" rounded="lg" />
      </v-row>
    </v-col>
  </div>
</template>

<script setup lang="ts">
import hotkeys from 'hotkeys-js'
import html2canvas from 'html2canvas'
import { computed, onMounted, ref } from 'vue'

import { Action, allActions } from '@/libs/input-map/actions'
// TODO: Rename to action mapper
import { inputMapManager } from '@/libs/input-map/manager'

const waitingShortcut = ref(false)
const userShortcut = ref(undefined)

onMounted(() => {
  console.log(allActions())
  inputMapManager.registerAction(Action.App.SCREENSHOT, () => {
    html2canvas(document.body).then(function (canvas) {
      document.body.appendChild(canvas)
    })
  })
})

hotkeys('*', { keydown: true, keyup: true }, function (event) {
  console.log('prevent')
  event.preventDefault()

  if (waitingShortcut.value == false) {
    return
  }

  if (event.type === 'keyup') {
    waitingShortcut.value = false
  }

  const alternativeCombination = []
  if (hotkeys.shift) {
    alternativeCombination.push('shift')
  }

  if (hotkeys.ctrl) {
    alternativeCombination.push('ctrl')
  }

  if (hotkeys.alt) {
    alternativeCombination.push('alt')
  }

  if (hotkeys.cmd) {
    alternativeCombination.push('cmd')
  }

  alternativeCombination.push(event.key)

  console.log(
    `Event ${JSON.stringify(event.key)}, ${JSON.stringify(
      event.code
    )}, ${JSON.stringify(event.type)}`
  )
  userShortcut.value = alternativeCombination
  // console.log(alternativeCombination.join('+'))
})

const startShortcutCapture = (): void => {
  waitingShortcut.value = true
  // Remove focus from all elements for the shortcut event to work
  document.activeElement.blur()
}

const actions = computed(() => allActions())
</script>

<style scoped>
.main-style {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
