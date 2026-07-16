<template>
  <v-dialog
    :model-value="modelValue"
    width="540"
    persistent
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card class="relative pa-4 text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="flex justify-center items-center text-lg font-medium">BlueOS Cloud login</v-card-title>
      <v-btn icon="mdi-close" variant="text" size="small" class="absolute right-2 top-2" @click="closeDialog" />
      <v-card-text class="px-2 py-4">
        <div v-if="step === 'intro'" class="flex flex-col gap-3">
          <p class="text-sm leading-snug">
            Connect Cockpit to your BlueOS Cloud account to create missions and upload recorded videos directly from
            this app.
          </p>
          <ol class="text-sm list-decimal list-inside opacity-90 space-y-1">
            <li>Click <span class="font-semibold">Start login</span> below.</li>
            <li>A short verification code will be displayed.</li>
            <li>Open the link, sign in to BlueOS Cloud and confirm the code.</li>
            <li>Cockpit will detect the authorization automatically.</li>
          </ol>
          <p v-if="errorMessage" class="text-sm text-red-300 break-words">{{ errorMessage }}</p>
        </div>

        <div v-else-if="step === 'awaiting'" class="flex flex-col items-center gap-4 text-center">
          <p class="text-sm leading-snug">
            Open the link below in your browser, sign in and confirm the verification code:
          </p>
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs uppercase tracking-wider opacity-70">Verification code</span>
            <span class="font-mono text-3xl font-semibold tracking-[0.2em]">{{ deviceAuthorization?.user_code }}</span>
          </div>
          <v-btn
            v-if="deviceAuthorization?.verification_uri_complete"
            class="bg-[#FFFFFF22]"
            variant="flat"
            prepend-icon="mdi-open-in-new"
            @click="openVerificationUrl"
          >
            Open BlueOS Cloud login page
          </v-btn>
          <p class="text-xs opacity-70 break-all">{{ deviceAuthorization?.verification_uri_complete }}</p>
          <div class="flex items-center gap-2 mt-2">
            <v-progress-circular indeterminate size="18" width="2" color="white" />
            <span class="text-sm">Waiting for authorization...</span>
          </div>
          <p v-if="errorMessage" class="text-sm text-red-300 break-words">{{ errorMessage }}</p>
        </div>

        <div v-else-if="step === 'success'" class="flex flex-col items-center gap-3 text-center">
          <v-icon color="green" size="44">mdi-check-circle</v-icon>
          <p class="text-base font-medium">You're connected!</p>
          <div v-if="cloudStore.user" class="flex items-center gap-3 px-4 py-2 rounded bg-[#FFFFFF11]">
            <v-avatar size="40">
              <img
                v-if="cloudStore.user.picture"
                :src="cloudStore.user.picture"
                alt="BlueOS Cloud profile picture"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover"
              />
              <v-icon v-else>mdi-account</v-icon>
            </v-avatar>
            <div class="flex flex-col items-start">
              <span class="font-medium">{{ cloudStore.displayName }}</span>
              <span v-if="cloudStore.user.email" class="text-xs opacity-80">{{ cloudStore.user.email }}</span>
            </div>
          </div>
        </div>
      </v-card-text>
      <v-divider class="opacity-20 mx-4 mb-3 mt-1" />
      <v-card-actions class="px-4 py-2">
        <template v-if="step === 'success'">
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Done</v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-spacer />
          <v-btn
            v-if="step === 'intro'"
            variant="flat"
            class="bg-[#FFFFFF33] text-white"
            :loading="isStartingLogin"
            @click="startLogin"
          >
            Start login
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  DeviceAuthorizationCancelled,
  pollForDeviceAuthorizationToken,
  requestDeviceAuthorization,
} from '@/libs/blueos-cloud/auth'
import { DeviceAuthorizationResponse } from '@/libs/blueos-cloud/types'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

type WizardStep = 'intro' | 'awaiting' | 'success'

const props = defineProps<{
  /**
   * Controls whether the wizard dialog is visible.
   */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const interfaceStore = useAppInterfaceStore()
const cloudStore = useBlueOsCloudStore()

const step = ref<WizardStep>('intro')
const isStartingLogin = ref(false)
const errorMessage = ref<string | null>(null)
const deviceAuthorization = ref<DeviceAuthorizationResponse | null>(null)
let pollAbortController: AbortController | null = null

const resetState = (): void => {
  step.value = cloudStore.isAuthenticated ? 'success' : 'intro'
  errorMessage.value = null
  isStartingLogin.value = false
  deviceAuthorization.value = null
  pollAbortController?.abort()
  pollAbortController = null
}

const closeDialog = (): void => {
  logUserAction('Closed the BlueOS Cloud login dialog')
  pollAbortController?.abort()
  pollAbortController = null
  emit('update:modelValue', false)
}

const openVerificationUrl = (): void => {
  if (!deviceAuthorization.value) return
  logUserAction('Opened the BlueOS Cloud verification page')
  window.open(deviceAuthorization.value.verification_uri_complete, '_blank', 'noopener,noreferrer')
}

const startLogin = async (): Promise<void> => {
  logUserAction('Started BlueOS Cloud login')
  errorMessage.value = null
  isStartingLogin.value = true
  try {
    const authorization = await requestDeviceAuthorization()
    deviceAuthorization.value = authorization
    step.value = 'awaiting'
    isStartingLogin.value = false

    pollAbortController?.abort()
    pollAbortController = new AbortController()

    const tokens = await pollForDeviceAuthorizationToken(authorization, pollAbortController.signal)
    await cloudStore.persistSession(tokens)
    cloudStore.isIntegrationEnabled = true
    step.value = 'success'
    logUserAction('Signed in to BlueOS Cloud')
  } catch (error) {
    if (error instanceof DeviceAuthorizationCancelled) {
      step.value = 'intro'
      isStartingLogin.value = false
      return
    }
    errorMessage.value = (error as Error).message
    step.value = 'intro'
    isStartingLogin.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetState()
    } else {
      pollAbortController?.abort()
      pollAbortController = null
    }
  },
  { immediate: true }
)
</script>
