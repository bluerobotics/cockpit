<template>
  <GlassModal
    :is-visible="showTutorial"
    class="pa-5 z-[1000000]"
    :draggable="true"
    storage-key="cockpit-tutorial-modal"
    is-persistent
  >
    <div class="w-[600px]" :class="tallContent ? 'h-[350px]' : 'h-[280px]'">
      <v-window v-model="currentTutorialStep" class="w-full h-full cursor-move" reverse>
        <v-window-item v-for="step in steps" :key="step.id" :value="step.id" class="flex justify-center items-center">
          <v-timeline direction="horizontal" class="custom-timeline">
            <v-timeline-item
              :key="step.id"
              ref="timelineItems"
              fill-dot
              size="x-large"
              elevation="3"
              class="cursor-move"
              :dot-color="vehicleStore.isVehicleOnline ? '#4fa483' : '#2c614c'"
            >
              <div
                v-if="vehicleStore.isVehicleOnline && currentTutorialStep === 5"
                class="fixed left-5 top-5 h-6 pa-1 rounded-md bg-[#3b7e64] border-[1px] border-[#FFFFFF88] mb-10 elevation-1"
                :style="{ opacity: isVehicleConnectedVisible ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }"
              >
                <p class="text-xs">Vehicle Connected</p>
              </div>
              <template #icon>
                <v-avatar
                  size="x-large"
                  class="border-1 border-[#FFFFFF88]"
                  :class="vehicleStore.isVehicleOnline ? 'ripple' : ''"
                >
                  <img :src="CockpitLogo" class="p-[7px] mt-1" />
                </v-avatar>
              </template>
              <div>
                <div class="flex justify-center text-h6 text-center -mt-1">
                  {{ step.title }}
                </div>
                <p class="text-center" :class="step.content ? 'mt-3' : 'mt-0'">{{ step.content }}</p>
              </div>
              <template #opposite>
                <p class="text-center">{{ step.opposite }}</p>
              </template>
            </v-timeline-item>
          </v-timeline>
        </v-window-item>
      </v-window>
    </div>
    <div class="fixed top-1 right-1">
      <v-btn
        v-if="currentTutorialStep !== steps.length"
        icon="mdi-close"
        size="small"
        variant="text"
        class="text-lg"
        @click="closeTutorial"
      ></v-btn>
    </div>
    <div class="fixed bottom-0 flex justify-between w-full -ml-5 pa-4">
      <v-btn v-if="currentTutorialStep > 1" variant="text" @click="backTutorialStep">Previous</v-btn>
      <v-btn
        variant="text"
        :class="{ 'mr-11 opacity-[50%]': currentTutorialStep > 1 }"
        @click="
          () => {
            interfaceStore.userHasSeenTutorial ? alwaysShowTutorialOnStartup() : dontShowTutorialAgain()
          }
        "
        >{{ interfaceStore.userHasSeenTutorial ? 'Show on startup' : `Don't show again` }}</v-btn
      >
      <v-btn
        variant="flat"
        class="bg-[#3B78A8] opacity-1 shadow-md"
        @click="nextTutorialStep"
        @keydown.enter="nextTutorialStep"
      >
        {{ currentTutorialStep === steps.length ? 'Close' : currentTutorialStep === 1 ? 'Start' : 'Next' }}
      </v-btn>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo-minimal.png'
import { useSnackbar } from '@/composables/snackbar'
import { SubMenuComponentName, SubMenuName, useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import GlassModal from './GlassModal.vue'

const { openSnackbar } = useSnackbar()
const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()

const showTutorial = ref(true)
const currentTutorialStep = useStorage('cockpit-last-tutorial-step', 1)
const isVehicleConnectedVisible = ref(false)
const tallContent = ref(false)

const steps = [
  {
    id: 1,
    title: 'Welcome to Cockpit!',
    content: 'Thank you for trying our control station software - we hope you make it your own!',
    opposite:
      'This guide will assist you in connecting to your vehicle, and walk you through the available menu pages.',
  },
  {
    id: 2,
    title: 'Main Menu',
    content: `Cockpit's configuration options and tools are accessed through its sidebar.`,
    opposite: `Open it by clicking the highlighted tab on the left side of the screen.`,
  },
  {
    id: 3,
    title: 'Connections and Behaviour',
    opposite: `The 'Settings' menu allows configuring Cockpit's connections and behavior.`,
  },
  {
    id: 4,
    title: 'General Configuration',
    content: `The 'General' page allows switching the active user, and the vehicle connection settings.`,
    opposite: `Each user can have their own settings, interface profiles, and joystick mappings, which can be
      stored on and synchronized through the connected vehicle.`,
  },
  {
    id: 5,
    title: 'Vehicle Address',
    content: `Cockpit connects to a vehicle's network using a global address.`,
    opposite: `This is usually found automatically, but if necessary you can specify a custom domain to connect
      to and search for the relevant vehicle components.`,
  },
  {
    id: 6,
    title: 'Interface Configuration',
    opposite: `Here, you'll find options to control the interface style, move the sidebar access point, and switch
      the display units between imperial and metric, for widgets that support it.`,
  },
  {
    id: 7,
    title: 'Joystick Configuration',
    content: `Connect a controller and move a joystick or press a button to see the current function mapping.`,
    opposite: `Fully supported joysticks have a visual configuration interface available, but there's also a
      mapping table provided for custom or uncommon controllers. Actions can be related to vehicle functions,
      can influence the display, or can run custom requests or code.`,
  },
  {
    id: 8,
    title: 'Video Configuration',
    content: `Video sources (from MAVLink Camera Manager / BlueOS) can be given custom names, and you can
      configure Cockpit's receiver settings to improve performance.`,
    opposite: `There are also preferences for the video recording library, to automatically process recorded chunks
      into video files, and zip together files when downloading multiple videos or a video with telemetry subtitles.`,
  },
  {
    id: 9,
    title: 'Telemetry Recording',
    opposite: `Subtitle overlays of telemetry data can be recorded with videos. This panel allows choosing which
      variables to include, where they appear on the screen, how the subtitles are styled, and the update rate.`,
  },
  {
    id: 10,
    title: 'Alerts Configuration',
    opposite: `Voice alerts can announce notifications and issues during operation, without covering the screen.
      The voice and reported alert severities can be configured here.`,
  },
  {
    id: 11,
    title: 'Dev Settings',
    content: `This section includes settings and Cockpit logs to help with development and advanced troubleshooting.`,
    opposite: `We recommend leaving the default values, but if you prefer to you can stop Cockpit from synchronizing
      its settings with BlueOS vehicles, and/or disable sending the anonymous usage statistics and error messages that
      help the development team to find performance issues and bugs.`,
  },
  {
    id: 12,
    title: 'Mission Configuration',
    opposite: `This panel allows selecting which vehicle commands require an extra confirmation step before sending,
      to avoid triggering mission- or safety-critical functions accidentally.`,
  },
  {
    id: 13,
    title: 'Tutorial Completed',
    content: `You're ready to go!`,
    opposite: `If you want to see it again, this guide can be reopened through 'Settings' > 'General'.
      For further support, please reach out through the channels listed in the 'About' section of the sidebar.`,
  },
]

const handleStepChange = (newStep: number): void => {
  switch (newStep) {
    case 1:
      interfaceStore.isMainMenuVisible = false
      interfaceStore.mainMenuCurrentStep = 1
      interfaceStore.componentToHighlight = 'none'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.currentSubMenuName = null
      break
    case 2:
      interfaceStore.isMainMenuVisible = false
      interfaceStore.mainMenuCurrentStep = 1
      interfaceStore.componentToHighlight = 'menu-trigger'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.currentSubMenuName = null
      interfaceStore.userHasSeenTutorial = false
      break
    case 3:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.componentToHighlight = 'settings-menu-item'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.userHasSeenTutorial = false
      break
    case 4:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsGeneral
      tallContent.value = true
      interfaceStore.userHasSeenTutorial = false
      interfaceStore.componentToHighlight = 'General'
      break
    case 5:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsGeneral
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.componentToHighlight = 'vehicle-address'
      setVehicleConnectedVisible()
      break
    case 6:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsInterface
      tallContent.value = false
      interfaceStore.userHasSeenTutorial = false
      interfaceStore.componentToHighlight = 'Interface'
      break
    case 7:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsJoystick
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.componentToHighlight = 'Joystick'
      break
    case 8:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsVideo
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.componentToHighlight = 'Video'
      break
    case 9:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsTelemetry
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = true
      interfaceStore.componentToHighlight = 'Telemetry'
      break
    case 10:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsAlerts
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Alerts'
      break
    case 11:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsDev
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Dev'
      break
    case 12:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsMission
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Mission'
      break
    case 13:
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.componentToHighlight = 'none'
      break
    default:
      break
  }
}

const dontShowTutorialAgain = (): void => {
  interfaceStore.userHasSeenTutorial = true
  showTutorial.value = false
  currentTutorialStep.value = 1
  openSnackbar({
    message: 'This guide can be reopened via the Settings > General menu',
    variant: 'info',
    closeButton: true,
    duration: 5000,
  })
}

const alwaysShowTutorialOnStartup = (): void => {
  interfaceStore.userHasSeenTutorial = false
  showTutorial.value = true
}

const nextTutorialStep = (): void => {
  if (currentTutorialStep.value === steps.length) {
    dontShowTutorialAgain()
    closeTutorial()
    return
  }
  currentTutorialStep.value++
  handleStepChange(currentTutorialStep.value)
}

const backTutorialStep = (): void => {
  currentTutorialStep.value--
  handleStepChange(currentTutorialStep.value)
}

const closeTutorial = (): void => {
  showTutorial.value = false
  interfaceStore.componentToHighlight = 'none'
  interfaceStore.userHasSeenTutorial = true
  interfaceStore.isTutorialVisible = false
}

const setVehicleConnectedVisible = (): void => {
  setTimeout(() => {
    isVehicleConnectedVisible.value = true
  }, 900)
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.shiftKey && event.key === 'Enter' && showTutorial.value) {
    backTutorialStep()
  } else if (event.key === 'Enter' && showTutorial.value) {
    nextTutorialStep()
  }
}

watch(
  () => interfaceStore.isTutorialVisible,
  (val) => {
    showTutorial.value = val
  }
)

watch(showTutorial, (newVal) => {
  interfaceStore.isTutorialVisible = newVal
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  handleStepChange(currentTutorialStep.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
<style>
.custom-timeline .v-timeline-divider__after {
  background-color: #ffffff44;
}
.custom-timeline .v-timeline-divider__before {
  background-color: #ffffff44;
}

@keyframes rotateAndRipple {
  100% {
    transform: rotate(720deg);
  }
}

@keyframes rippleEffect {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.rotate-and-ripple {
  position: relative;
  animation: rotateAndRipple 1.2s ease-in-out forwards;
}

.ripple {
  position: relative;
  animation: ripple 1.2s ease-in-out forwards;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: rippleEffect 1s ease-out forwards;
  animation-delay: 1s;
  pointer-events: none;
}
</style>
