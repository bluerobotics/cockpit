<template>
  <GlassModal :is-visible="showTutorial" class="pa-5 z-[1000000]">
    <div class="w-[600px]" :class="tallContent ? 'h-[350px]' : 'h-[280px]'">
      <v-window v-model="currentTutorialStep" class="w-full h-full" reverse>
        <v-window-item v-for="step in steps" :key="step.id" :value="step.id" class="flex justify-center items-center">
          <v-timeline direction="horizontal" class="custom-timeline">
            <v-timeline-item
              :key="step.id"
              ref="timelineItems"
              fill-dot
              size="x-large"
              elevation="3"
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
      <v-btn icon="mdi-close" size="small" variant="text" class="text-lg" @click="closeTutorial"></v-btn>
    </div>
    <div class="fixed bottom-0 flex justify-between w-full -ml-5 pa-4">
      <v-btn v-if="currentTutorialStep > 1" variant="text" @click="backTutorialStep">Previous</v-btn>
      <v-btn
        v-if="currentTutorialStep === 1"
        variant="text"
        @click="
          () => {
            userHasSeenTutorial ? alwaysShowTutorialOnStartup() : dontShowTutorialAgain()
          }
        "
        >{{ userHasSeenTutorial ? 'Show on startup' : `Don't show again` }}</v-btn
      >
      <v-btn
        variant="flat"
        class="bg-[#3B78A8] opacity-1 shadow-md"
        @click="nextTutorialStep"
        @keydown.enter="nextTutorialStep"
      >
        {{ currentTutorialStep === steps.length ? 'Close' : 'Next' }}
      </v-btn>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo-minimal.png'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import GlassModal from './GlassModal.vue'

const { showSnackbar } = useSnackbar()
const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()

const props = defineProps<{
  /**
   *
   */
  showTutorial?: boolean
}>()

const emits = defineEmits(['update:showTutorial'])

const showTutorial = ref(props.showTutorial || false)
const currentTutorialStep = ref(1)
const isVehicleConnectedVisible = ref(false)
const tallContent = ref(false)
const userHasSeenTutorial = useBlueOsStorage('cockpit-has-seen-tutorial', false)

const steps = [
  {
    id: 1,
    title: 'Welcome to Cockpit!',
    opposite:
      "This guide will assist you in configuring your vehicle's main connections and customizing the user interface to suit your needs.",
  },
  {
    id: 2,
    title: 'Main Menu',
    content: `To open the main menu you can click on the highlighted tab to access
      Cockpit's features and configurations.`,
    opposite: `Give it a try! It's in the center-left part of the screen.`,
  },
  {
    id: 3,
    title: 'Vehicle Setup',
    opposite: `In the 'Settings' menu item you will find what you need to setup your vehicle, its components and functions.`,
  },
  {
    id: 4,
    title: 'General Configuration',
    content: `Your vehicle address settings are located within the 'General' submenu. Let's open it and take a look inside.`,
    opposite: `In this panel, you will also find a user selection screen. Different users can have their own settings and can set up
      personalized vehicle operation methods. This settings will be saved on the vehicle's operating system and will be accessible on
      any Cockpit instance connected to it.`,
  },
  {
    id: 5,
    title: 'Vehicle Address',
    content: `This setting is on the 'Vehicle network connection' panel. Look for the highlighted item on the left.`,
    opposite: `If your vehicle isn't already connected, check where it's located inside your network, change the value on the panel and click 'apply'. Cockpit
      will restart and you'll be redirected to this point of the guide so we can continue the config process.`,
  },
  {
    id: 6,
    title: 'Interface Configuration',
    opposite: `Here, you'll find some parameters that control the interface transparency and color; you can relocate the main menu
      and switch between imperial and metric systems.`,
  },
  {
    id: 7,
    title: 'Joystick Configuration',
    content: `Connect a controller and move an axis or press any button. The panel should present a summary of functions you can
      remap and personalize`,
    opposite: `If you have a standard and supported joystick, Cockpit will present a specific setup screen for your model. If
      you are using a custom model or a non standard controller, you can use the mapping table to associate your device's inputs with
      the vehicle functions and actions.`,
  },
  {
    id: 8,
    title: 'Video Configuration',
    content: `If you already configured your video sources on BlueOS, they should be listed and available for setup here.`,
    opposite: `You'll also find here the video library preferences, where you can set up the video processing and storage options.`,
  },
  {
    id: 9,
    title: 'Telemetry Options',
    opposite: `In this panel you can set up the telemetry data to display on your recorded videos. This overlay data is
      recorded on a subtitle file and its contents can be configured here.`,
  },
  {
    id: 10,
    title: 'Alerts Configuration',
    opposite: `Voice alerts can be very useful when operating a vehicle. They can warn you about specific conditions during a
      mission without the need of visual or interactive elements.`,
  },
  {
    id: 11,
    title: 'Dev Settings',
    opposite: `Here, you can access system logs and change some advanced parameters. We recommend keeping these settings as they are.`,
  },
  {
    id: 12,
    title: 'Mission Configuration',
    opposite: `In this config panel you'll be able to define which Cockpit and vehicle action will require confirmation.
      Some actions like arming and disarming the vehicle can be mission-critical or a safety concern and may require confirmation to be applied.`,
  },
  {
    id: 13,
    title: 'Tutorial Completed',
    content: 'This guide can be reopened via the Settings > General menu.',
    opposite: "If you need further support, please reach out to us through the channels listed on the 'About' menu.",
  },
]

const handleStepChangeUp = (newStep: number): void => {
  switch (newStep) {
    case 2:
      interfaceStore.componentToHighlight = 'menu-trigger'
      break
    case 3:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.componentToHighlight = 'config-menu-item'
      break
    case 4:
      if (!interfaceStore.isMainMenuVisible) {
        interfaceStore.isMainMenuVisible = true
      }
      localStorage.setItem('last-tutorial-step', '1')
      interfaceStore.mainMenuCurrentStep = 2
      tallContent.value = true
      interfaceStore.componentToHighlight = 'General'
      break
    case 5:
      if (!interfaceStore.isMainMenuVisible) {
        interfaceStore.isMainMenuVisible = true
        interfaceStore.mainMenuCurrentStep = 2
      }
      interfaceStore.configComponent = 0
      tallContent.value = true
      interfaceStore.componentToHighlight = 'vehicle-address'
      setVehicleConnectedVisible()
      localStorage.setItem('last-tutorial-step', '5')
      break
    case 6:
      localStorage.setItem('last-tutorial-step', '1')
      tallContent.value = false
      interfaceStore.componentToHighlight = 'Interface'
      interfaceStore.configComponent = 1
      break
    case 7:
      interfaceStore.configComponent = 2
      tallContent.value = true
      interfaceStore.componentToHighlight = 'Joystick'
      break
    case 8:
      interfaceStore.configComponent = 3
      tallContent.value = false
      interfaceStore.componentToHighlight = 'Video'
      break
    case 9:
      interfaceStore.configComponent = 4
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = true
      interfaceStore.componentToHighlight = 'Telemetry'
      break
    case 10:
      interfaceStore.configComponent = 5
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Alerts'
      break
    case 11:
      interfaceStore.configComponent = 6
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Dev'
      break
    case 12:
      interfaceStore.configComponent = 7
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Mission'
      break
    case 13:
      interfaceStore.configComponent = -1
      interfaceStore.isMainMenuVisible = false
      userHasSeenTutorial.value = true
      break
    default:
      break
  }
}

const handleStepChangeDown = (newStep: number): void => {
  switch (newStep) {
    case 2:
      interfaceStore.componentToHighlight = 'menu-trigger'
      interfaceStore.isMainMenuVisible = false
      break
    case 3:
      interfaceStore.componentToHighlight = 'config-menu-item'
      if (!interfaceStore.isMainMenuVisible) {
        interfaceStore.isMainMenuVisible = true
      }
      interfaceStore.mainMenuCurrentStep = 1
      tallContent.value = false
      break
    case 4:
      isVehicleConnectedVisible.value = false
      interfaceStore.componentToHighlight = 'General'
      if (!interfaceStore.isMainMenuVisible) {
        interfaceStore.isMainMenuVisible = true
      }
      localStorage.setItem('last-tutorial-step', '1')
      interfaceStore.mainMenuCurrentStep = 1
      interfaceStore.configComponent = -1
      tallContent.value = true
      break
    case 5:
      interfaceStore.componentToHighlight = 'vehicle-address'
      interfaceStore.configComponent = 0
      tallContent.value = true
      break
    case 6:
      interfaceStore.componentToHighlight = 'Interface'
      interfaceStore.configComponent = 1
      tallContent.value = false
      break
    case 7:
      interfaceStore.componentToHighlight = 'Joystick'
      interfaceStore.configComponent = 2
      tallContent.value = true
      break
    case 8:
      interfaceStore.componentToHighlight = 'Video'
      interfaceStore.configComponent = 3
      tallContent.value = true
      break
    case 9:
      interfaceStore.componentToHighlight = 'Telemetry'
      interfaceStore.configComponent = 4
      tallContent.value = false
      break
    case 10:
      interfaceStore.componentToHighlight = 'Alerts'
      interfaceStore.configComponent = 5
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = true
      break
    case 11:
      interfaceStore.componentToHighlight = 'Dev'
      interfaceStore.configComponent = 6
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = true
      break
    case 12:
      interfaceStore.componentToHighlight = 'Mission'
      interfaceStore.isGlassModalAlwaysOnTop = true
      break
    default:
      break
  }
}

const dontShowTutorialAgain = (): void => {
  userHasSeenTutorial.value = true
  showTutorial.value = false
  emits('update:showTutorial', false)
  showSnackbar({
    message: 'This guide can be reopened via the Settings > General menu',
    variant: 'info',
    closeButton: true,
    duration: 5000,
  })
}

const alwaysShowTutorialOnStartup = (): void => {
  userHasSeenTutorial.value = false
  showTutorial.value = true
  emits('update:showTutorial', true)
}

const nextTutorialStep = (): void => {
  if (currentTutorialStep.value === steps.length) {
    dontShowTutorialAgain()
    closeTutorial()
    return
  }
  handleStepChangeUp(currentTutorialStep.value + 1)
  currentTutorialStep.value++
}

const backTutorialStep = (): void => {
  handleStepChangeDown(currentTutorialStep.value - 1)
  currentTutorialStep.value--
}

const closeTutorial = (): void => {
  showTutorial.value = false
  emits('update:showTutorial', false)
}

const setVehicleConnectedVisible = (): void => {
  setTimeout(() => {
    isVehicleConnectedVisible.value = true
  }, 900)
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    if (currentTutorialStep.value !== 5) {
      nextTutorialStep()
      return
    }
    if (currentTutorialStep.value === 5 && vehicleStore.isVehicleOnline) {
      nextTutorialStep()
    }
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

watch(userHasSeenTutorial, (newVal) => {
  interfaceStore.isTutorialVisible = !newVal
  showTutorial.value = !newVal
})

const checkUserHasSeenTutorial = (): void => {
  const lastViewedTutorialStep = localStorage.getItem('last-tutorial-step')
  setTimeout(() => {
    showTutorial.value = !userHasSeenTutorial.value
    interfaceStore.isTutorialVisible = !userHasSeenTutorial.value
    if (lastViewedTutorialStep && showTutorial.value) {
      currentTutorialStep.value = parseInt(lastViewedTutorialStep)
      handleStepChangeUp(parseInt(lastViewedTutorialStep))
    }
  }, 5000)
}

onMounted(() => {
  checkUserHasSeenTutorial()
  window.addEventListener('keydown', handleKeydown)
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
