<template>
  <div class="main">
    <h1>General configuration</h1>
    <v-card class="pa-5 pb-2 ma-4">
      <v-icon :icon="mainVehicleStore.isVehicleOnline() ? 'mdi-lan-connect' : 'mdi-lan-disconnect'" class="mr-3" />
      <span class="text-h6">Vehicle connection</span>
      <div class="my-6">
        <span class="text-caption font-weight-thin"> Current connection link: </span>
        <br />
        <span class="text-body-1">
          {{ mainVehicleStore.mainConnectionURI }}
        </span>
      </div>
      <v-form
        ref="connectionForm"
        v-model="connectionFormValid"
        class="d-flex justify-center align-center"
        @submit.prevent="addNewConnection"
      >
        <v-text-field
          v-model="newConnectionURI"
          label="Mavlink2Rest URI"
          variant="underlined"
          type="input"
          hint="URI of a Mavlink2Rest web-socket"
          class="uri-input"
          :rules="[isValidConnectionURI]"
        />
        <v-btn icon="mdi-check" class="pa-0 mx-1 mb-5" rounded="lg" flat type="submit" />
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const newConnectionURI = ref('')
const connectionForm = ref()
const connectionFormValid = ref(false)
const mainVehicleStore = useMainVehicleStore()

const isValidConnectionURI = computed(() => {
  try {
    const conn = new Connection.URI(newConnectionURI.value)
    if (conn.type() !== Connection.Type.WebSocket) {
      throw new Error('URI should be of type WebSocket')
    }
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
})

// Adds a new connection, which right now is the same as changing the main one
const addNewConnection = async (): Promise<void> => {
  await connectionForm.value.validate()
  try {
    ConnectionManager.addConnection(new Connection.URI(newConnectionURI.value), Protocol.Type.MAVLink)
  } catch (error) {
    console.error(error)
    alert(`Could not update main connection. ${error}.`)
    return
  }
  alert('New connection successfully configured.')
}
</script>

<style scoped>
.main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.uri-input {
  min-width: 350px;
}
</style>
